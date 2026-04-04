import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

const VendorPanel = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('vendor_token'));

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('vendor_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [view, setView] = useState<'dashboard' | 'inventory' | 'orders' | 'messages' | 'payouts'>('dashboard');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutStats, setPayoutStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Chat States
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  const [form, setForm] = useState<any>({
    name: '',
    description: '',
    price: 0,
    stockQty: 0,
    categoryId: '',
    imageUrl: '',
    options: [],
    variants: []
  });
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<any>(null);

  const fetchData = async () => {
    if (!token) return;
    try {
      const statsRes = await fetch(`${API_URL}/api/v1/vendor/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setRecentOrders(data.recentOrders);
      } else { logout(); }

      fetch(`${API_URL}/api/v1/products`, { cache: 'no-cache' }).then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
      fetch(`${API_URL}/api/v1/categories`).then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
      fetch(`${API_URL}/api/v1/payouts`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setPayouts(d));
      fetch(`${API_URL}/api/v1/payouts/stats`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setPayoutStats(d));
      fetch(`${API_URL}/api/v1/chat/vendor/contacts`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setContacts(d));
      
      const analRes = await fetch(`${API_URL}/api/v1/vendor/analytics`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (analRes.ok) setAnalytics(await analRes.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (token) {
      // Chat WebSocket
      const socket = new WebSocket(`ws://localhost:3001/api/v1/chat/ws/me?token=${token}`);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setChatMessages(prev => {
            if (activeContact && (msg.senderId === activeContact.id || (msg.isFromVendor && msg.senderId === activeContact.id))) {
              return [...prev, msg];
            }
            return prev;
          });
          fetch(`${API_URL}/api/v1/chat/vendor/contacts`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setContacts(d));
        } catch (e) {}
      };
      ws.current = socket;

      // Notification WebSocket
      const notifWs = new WebSocket(`ws://localhost:3001/api/v1/notifications/ws?token=${token}`);
      notifWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'INITIAL_STATE') {
          setUnreadCount(data.unreadCount);
        } else if (data.type === 'NOTIFICATION') {
          setNotifications(prev => [data.notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      };

      const fetchNotifications = async () => {
        const res = await fetch(`${API_URL}/api/v1/notifications`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setNotifications(await res.json());
      };
      fetchNotifications();

      return () => {
        socket.close();
        notifWs.close();
      };
    }
  }, [token, activeContact]);

  useEffect(() => {
    if (activeContact && token) {
      fetch(`${API_URL}/api/v1/chat/vendor/history/${activeContact.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => setChatMessages(Array.isArray(data) ? data : []));
    }
  }, [activeContact, token]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !ws.current || !activeContact) return;
    ws.current.send(JSON.stringify({ content: chatInput, customerId: activeContact.id }));
    setChatInput('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('${API_URL}/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.user.role !== 'VENDOR') { alert('Access Denied: Not a vendor'); return; }
        localStorage.setItem('vendor_token', data.token);
        setToken(data.token);
      } else { alert(data.message || 'Login failed'); }
    } catch { alert('Network error'); }
  };

  const logout = () => { localStorage.removeItem('vendor_token'); setToken(null); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('${API_URL}/api/v1/vendor/upload', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
      });
      const data = await res.json();
      if (res.ok) setForm({ ...form, imageUrl: data.url });
    } finally { setIsUploading(false); }
  };

  const addOption = () => {
    setForm({ ...form, options: [...form.options, { name: '', type: 'SELECT', required: true, values: [] }] });
  };

  const updateOption = (idx: number, field: string, value: string) => {
    const newOptions = [...form.options];
    if (field === 'values') {
      newOptions[idx].values = value.split(',').map(v => ({ name: v.trim() }));
    } else {
      newOptions[idx][field] = value;
    }
    setForm({ ...form, options: newOptions });
  };

  const generateVariants = () => {
    if (form.options.length === 0) return;
    
    const combine = (list: any[], n = 0, result: string[] = [], current: string[] = []) => {
      if (n === list.length) {
        result.push(current.join(' / '));
        return result;
      }
      for (const val of list[n].values) {
        combine(list, n + 1, result, [...current, val.name]);
      }
      return result;
    };

    const combinations = combine(form.options);
    const variants = combinations.map(c => ({
      sku: `${form.name.slice(0, 3).toUpperCase()}-${c.replace(/ \/ /g, '-').toUpperCase()}`,
      price: form.price,
      stockQty: form.stockQty,
      imageId: ''
    }));
    setForm({ ...form, variants });
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/api/v1/products/${editingId}` : '${API_URL}/api/v1/products';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...form, categoryIds: [form.categoryId] }),
    });
    if (res.ok) {
      setForm({ name: '', description: '', price: 0, stockQty: 0, categoryId: '', imageUrl: '', options: [], variants: [] });
      setEditingId(null);
      fetchData();
    }
  };

  const editProduct = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      stockQty: p.stockQty,
      categoryId: p.categories?.[0]?.categoryId || '',
      imageUrl: p.images?.[0]?.url || '',
      options: p.options || [],
      variants: p.variants || []
    });
  };

  const deleteProduct = async (id: string) => {
    if(!confirm('Delete this product?')) return;
    const res = await fetch(`${API_URL}/api/v1/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if(res.ok) fetchData();
  };

  const handlePayoutRequest = async () => {
    const res = await fetch('${API_URL}/api/v1/payouts/request', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { alert('Payout requested!'); fetchData(); }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a0f1c' }}>
        <form onSubmit={handleLogin} className="glass" style={{ padding: '3rem', borderRadius: '1.5rem', width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>modcart <span style={{ color: '#8b5cf6' }}>Vendor</span></h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Login to your storefront</p>
          </div>
          <input placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
          <input placeholder="Password" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
          <button type="submit" style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '1rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Authenticate</button>
        </form>
      </div>
    );
  }

  const SidebarItem = ({ id, label, icon }: { id: any, label: string, icon: string }) => (
    <div 
      onClick={() => setView(id)}
      style={{ 
        padding: '0.75rem 1.25rem', 
        cursor: 'pointer', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: view === id ? 'rgba(139,92,246,0.1)' : 'transparent',
        color: view === id ? '#8b5cf6' : '#94a3b8', fontWeight: '600', transition: 'all 0.2s'
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      {label}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0f1c', color: 'white' }}>
      <aside style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div><h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>modcart <span style={{ color: '#8b5cf6' }}>Seller</span></h1></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <SidebarItem id="dashboard" label="Dashboard" icon="📈" />
          <SidebarItem id="inventory" label="Inventory" icon="📦" />
          <SidebarItem id="orders" label="Orders" icon="📑" />
          <SidebarItem id="messages" label="Messages" icon="💬" />
          <SidebarItem id="payouts" label="Payouts" icon="💰" />
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Logged in as Store</p>
          <p style={{ fontSize: '0.9rem', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden' }}>{authEmail}</p>
          <button onClick={logout} style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Sign Out</button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', textTransform: 'capitalize', margin: 0 }}>{view}</h2>
          
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
            <span style={{ fontSize: '1.5rem' }}>🔔</span>
            {unreadCount > 0 && (
              <div style={{ 
                position: 'absolute', top: '-5px', right: '-5px', 
                backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', 
                fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px',
                border: '2px solid #0a0f1c'
              }}>{unreadCount}</div>
            )}

            {showNotifications && (
              <div className="glass" style={{ 
                position: 'absolute', top: '40px', right: '0', width: '320px', 
                maxHeight: '450px', overflowY: 'auto', zIndex: 1000, padding: '1.25rem',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>Notifications</h4>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch(`${API_URL}/api/v1/notifications/read-all`, { 
                        method: 'PATCH', 
                        headers: { 'Authorization': `Bearer ${token}` } 
                      });
                      setUnreadCount(0);
                      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                    }}
                    style={{ fontSize: '0.75rem', color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Mark all as read
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {notifications.map((n: any) => (
                    <div key={n.id} style={{ 
                      padding: '1rem', borderRadius: '0.75rem', 
                      backgroundColor: n.isRead ? 'transparent' : 'rgba(139, 92, 246, 0.05)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      <div style={{ fontWeight: '700', marginBottom: '0.25rem', color: n.isRead ? '#94a3b8' : 'white' }}>{n.title}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{n.message}</div>
                      <div style={{ fontSize: '0.7rem', marginTop: '0.6rem', opacity: 0.4, fontStyle: 'italic' }}>{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.5 }}>
                      <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>👋</p>
                      <p style={{ fontSize: '0.9rem' }}>No notifications for now.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {view === 'dashboard' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
            <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Total GMV</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>${stats.totalEarnings.toLocaleString()}</h3></div>
            <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Orders</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.totalOrders}</h3></div>
            <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Unique Visitors</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{analytics?.visitors || 0}</h3></div>
            <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Conversion Rate</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{analytics?.conversionRate || 0}%</h3></div>
            <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Listings</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.activeProducts}</h3></div>
          </div>
        )}

        {view === 'inventory' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', animation: 'fadeIn 0.3s' }}>
            <section className="glass" style={{ padding: '2rem', height: 'fit-content' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 'bold' }}>{editingId ? 'Edit Product' : 'New Listing'}</h3>
                {editingId && <button onClick={() => { setEditingId(null); setForm({ name: '', description: '', price: 0, stockQty: 0, categoryId: '', imageUrl: '' }) }} className="btn-small">Cancel</button>}
              </div>
              <form onSubmit={saveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ minHeight: '100px' }} />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input type="number" placeholder="Price" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} required />
                  <input type="number" placeholder="Stock" value={form.stockQty} onChange={e => setForm({...form, stockQty: Number(e.target.value)})} required />
                </div>
                <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} required>
                  <option value="">Category</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="upload-box" style={{ padding: '1rem', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', borderRadius: '0.75rem', position: 'relative' }}>
                  {form.imageUrl ? <img src={form.imageUrl} style={{ height: '60px', borderRadius: '0.4rem' }} /> : (isUploading ? 'Uploading...' : 'Click to Upload Image')}
                  <input type="file" onChange={handleImageUpload} style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </div>

                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Product Options</h4>
                    <button type="button" onClick={addOption} className="btn-small">+ Add Attribute</button>
                  </div>
                  {form.options.map((opt: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '0.75rem', position: 'relative' }}>
                      <input placeholder="Attribute (e.g. Size)" value={opt.name} onChange={e => updateOption(idx, 'name', e.target.value)} style={{ width: '100%', marginBottom: '0.5rem' }} />
                      <input placeholder="Values (S, M, L)" value={opt.values.map((v: any) => v.name).join(', ')} onChange={e => updateOption(idx, 'values', e.target.value)} style={{ width: '100%', fontSize: '0.8rem' }} />
                      <button type="button" onClick={() => setForm({ ...form, options: form.options.filter((_: any, i: number) => i !== idx) })} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                  {form.options.length > 0 && (
                    <button type="button" onClick={generateVariants} className="btn-small" style={{ width: '100%', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', marginBottom: '1rem' }}>
                      Generate {form.variants.length > 0 ? 'New' : ''} Variants
                    </button>
                  )}
                </div>

                {form.variants.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem' }}>Variants ({form.variants.length})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {form.variants.map((v: any, idx: number) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '0.5rem', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.sku}</div>
                          <input type="number" placeholder="Price" value={v.price} onChange={e => {
                            const newV = [...form.variants];
                            newV[idx].price = Number(e.target.value);
                            setForm({ ...form, variants: newV });
                          }} style={{ padding: '0.4rem', fontSize: '0.8rem' }} />
                          <input type="number" placeholder="Qty" value={v.stockQty} onChange={e => {
                            const newV = [...form.variants];
                            newV[idx].stockQty = Number(e.target.value);
                            setForm({ ...form, variants: newV });
                          }} style={{ padding: '0.4rem', fontSize: '0.8rem' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-purple">{editingId ? 'Update Product' : 'Add Product'}</button>
              </form>
            </section>
            <div className="glass overflow-hidden">
               <table className="admin-table">
                <thead><tr><th>Image</th><th>Product</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
                <tbody>
                  {products?.map(p => (
                    <tr key={p.id}>
                      <td>{p.images?.[0] ? <img src={p.images[0].url} style={{ width: '40px', borderRadius: '0.4rem' }} alt="" /> : '--'}</td>
                      <td><b>{p.name}</b></td><td>${p.price}</td><td>{p.stockQty}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => editProduct(p)} className="btn-small">Edit</button>
                          <button onClick={() => deleteProduct(p.id)} className="btn-small btn-red">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'orders' && (
          <div className="glass overflow-hidden" style={{ animation: 'fadeIn 0.3s' }}>
             <table className="admin-table">
              <thead><tr><th>Order ID</th><th>Customer</th><th>Earnings</th><th>Status</th></tr></thead>
              <tbody>
                {recentOrders?.map(o => (
                  <tr key={o.id}>
                    <td><span className="mono">#{o?.orderId?.slice(-6).toUpperCase() || '---'}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <b>{o?.order?.user?.firstName || 'Unknown'} {o?.order?.user?.lastName || ''}</b>
                        <span style={{ fontSize: '0.75rem', color: '#8b5cf6' }}>{o?.order?.user?.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="text-green">${o?.vendorEarnings?.toFixed(2)}</td>
                    <td><span className={`badge badge-${o?.status === 'SHIPPED' ? 'green' : 'yellow'}`}>{o?.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'messages' && (
          <section className="glass overflow-hidden" style={{ height: '600px', display: 'flex', animation: 'fadeIn 0.3s' }}>
            <div style={{ width: '250px', borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
              {contacts?.map(c => (
                <div key={c.id} onClick={() => setActiveContact(c)} style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: activeContact?.id === c.id ? 'rgba(139,92,246,0.1)' : 'transparent', color: activeContact?.id === c.id ? '#8b5cf6' : 'inherit' }}>
                   <b>{c.firstName} {c.lastName}</b>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {chatMessages?.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.isFromVendor ? 'flex-end' : 'flex-start', background: m.isFromVendor ? '#8b5cf6' : 'rgba(255,255,255,0.05)', padding: '0.6rem 1rem', borderRadius: '0.8rem', maxWidth: '75%' }}>{m.content}</div>
                ))}
              </div>
              <form onSubmit={sendChatMessage} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <input placeholder="Type here..." value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '0.75rem', padding: '0.8rem 1.2rem', color: 'white' }} />
                <button type="submit" className="btn btn-purple">Send</button>
              </form>
            </div>
          </section>
        )}

        {view === 'payouts' && (
          <div style={{ display: 'grid', gap: '2rem', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div className="glass" style={{ padding: '1.5rem', flex: 1 }}>
                <p className="text-muted">Unpaid Balance</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>${payoutStats?.pending || 0}</h3>
                <button onClick={handlePayoutRequest} className="btn btn-purple" style={{ width: '100%', marginTop: '1rem' }}>Request Withdrawal</button>
              </div>
              <div className="glass" style={{ padding: '1.5rem', flex: 1 }}>
                <p className="text-muted">Already Paid</p><h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>${payoutStats?.processed || 0}</h3>
              </div>
            </div>
            <div className="glass overflow-hidden"><table className="admin-table"><thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payouts?.map(p => (<tr key={p.id}><td>{new Date(p.createdAt).toLocaleDateString()}</td><td className="text-green">${p.amount}</td><td>{p.status}</td></tr>))}</tbody></table></div>
          </div>
        )}
      </main>

      <style>{`
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 1rem; color: #64748b; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .admin-table td { padding: 1.25rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.9rem; }
        .mono { font-family: monospace; }
        .text-muted { color: #64748b; font-size: 0.85rem; }
        .text-green { color: #10b981; }
        .badge { padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.7rem; font-weight: bold; }
        .badge-green { background: rgba(16,185,129,0.1); color: #10b981; }
        .badge-yellow { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .btn { padding: 0.75rem 1.5rem; border-radius: 0.75rem; border: none; font-weight: bold; cursor: pointer; }
        .btn-purple { background: #8b5cf6; color: white; }
        .btn-small { padding: 0.4rem 0.8rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.8rem; background: rgba(255,255,255,0.05); color: white; }
        .btn-red { background: rgba(239,68,68,0.1); color: #ef4444; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input, select, textarea { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.8rem; border-radius: 0.6rem; color: white; outline: none; }
      `}</style>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <VendorPanel />
    </React.StrictMode>
  );
}
