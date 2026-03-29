import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

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
  
  // Chat States
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    stockQty: 0,
    categoryId: '',
    imageUrl: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    try {
      const statsRes = await fetch('http://localhost:3001/api/v1/vendor/stats', { headers: { 'Authorization': `Bearer ${token}` } });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setRecentOrders(data.recentOrders);
      } else { logout(); }

      fetch('http://localhost:3001/api/v1/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
      fetch('http://localhost:3001/api/v1/categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
      fetch('http://localhost:3001/api/v1/payouts', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setPayouts(d));
      fetch('http://localhost:3001/api/v1/payouts/stats', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setPayoutStats(d));
      fetch('http://localhost:3001/api/v1/chat/vendor/contacts', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setContacts(d));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (token && stats) {
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
          fetch('http://localhost:3001/api/v1/chat/vendor/contacts', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => setContacts(d));
        } catch (e) {}
      };
      ws.current = socket;
      return () => socket.close();
    }
  }, [token, stats, activeContact]);

  useEffect(() => {
    if (activeContact && token) {
      fetch(`http://localhost:3001/api/v1/chat/vendor/history/${activeContact.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
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
      const res = await fetch('http://localhost:3001/api/v1/auth/login', {
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
      const res = await fetch('http://localhost:3001/api/v1/vendor/upload', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
      });
      const data = await res.json();
      if (res.ok) setForm({ ...form, imageUrl: data.url });
    } finally { setIsUploading(false); }
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3001/api/v1/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...form, categoryIds: [form.categoryId] }),
    });
    if (res.ok) {
      setForm({ name: '', description: '', price: 0, stockQty: 0, categoryId: '', imageUrl: '' });
      fetchData();
    }
  };

  const deleteProduct = async (id: string) => {
    if(!confirm('Delete this product?')) return;
    const res = await fetch(`http://localhost:3001/api/v1/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if(res.ok) fetchData();
  };

  const handlePayoutRequest = async () => {
    const res = await fetch('http://localhost:3001/api/v1/payouts/request', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
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
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', textTransform: 'capitalize', marginBottom: '2.5rem' }}>{view}</h2>

        {view === 'dashboard' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
            <div className="glass" style={{ padding: '2rem' }}><p className="text-muted">Total Earnings</p><h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>${stats.totalEarnings.toLocaleString()}</h3></div>
            <div className="glass" style={{ padding: '2rem' }}><p className="text-muted">Store Orders</p><h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{stats.totalOrders}</h3></div>
            <div className="glass" style={{ padding: '2rem' }}><p className="text-muted">Active Listings</p><h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{stats.activeProducts}</h3></div>
            <div className="glass" style={{ padding: '2rem' }}><p className="text-muted">Trust Score</p><h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{stats.trustScore.toFixed(1)}</h3></div>
          </div>
        )}

        {view === 'inventory' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', animation: 'fadeIn 0.3s' }}>
            <section className="glass" style={{ padding: '2rem', height: 'fit-content' }}>
              <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold' }}>New Listing</h3>
              <form onSubmit={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                <button type="submit" className="btn btn-purple">Add Product</button>
              </form>
            </section>
            <div className="glass overflow-hidden">
               <table className="admin-table">
                <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
                <tbody>
                  {products?.map(p => (
                    <tr key={p.id}><td><b>{p.name}</b></td><td>${p.price}</td><td>{p.stockQty}</td><td><button onClick={() => deleteProduct(p.id)} className="btn-small btn-red">Delete</button></td></tr>
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
                    <td>{o?.order?.user?.email || 'N/A'}</td>
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
        .btn-small { padding: 0.4rem 0.8rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.8rem; }
        .btn-red { background: rgba(239,68,68,0.1); color: #ef4444; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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
