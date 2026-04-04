import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import './index.css';

if ((import.meta as any).env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: (import.meta as any).env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
const FRONTEND_URL = (import.meta as any).env.VITE_FRONTEND_URL || 'http://localhost:3000';
const VENDOR_URL = (import.meta as any).env.VITE_VENDOR_URL || 'http://localhost:3003';

const AdminPanel = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [view, setView] = useState<'stats' | 'users' | 'products' | 'orders' | 'vendors' | 'logs'>('stats');
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: 0, stockQty: 0, vendorId: '', categoryIds: [] as string[], imageUrls: [] as string[] });
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async (endpoint: string, setter: Function) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setter(data);
      }
    } catch (e) { console.error(`Error fetching ${endpoint}`, e); }
  };

  const fetchGlobal = async (endpoint: string, setter: Function) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/${endpoint}`, { cache: 'no-cache' });
      if (res.ok) setter(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!token) return;

    // WebSocket for Live Notifications
    const wsUrl = API_URL.replace('http', 'ws') + '/api/v1/notifications/ws?token=' + token;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'INITIAL_STATE') {
        setUnreadCount(data.unreadCount);
      } else if (data.type === 'NOTIFICATION') {
        setNotifications(prev => [data.notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        showToast(`New Notification: ${data.notification.title}`);
      }
    };

    const fetchNotifications = async () => {
      const res = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setNotifications(await res.json());
    };
    fetchNotifications();

    if (view === 'stats') {
      fetchData('stats', setStats);
      fetchData('analytics', setAnalytics);
    }
    if (view === 'vendors') fetchData('vendors', setVendors);
    if (view === 'users') fetchData('users', setUsers);
    if (view === 'products') {
       fetchData('products', setProducts);
       fetchData('vendors', setVendors);
       fetchGlobal('categories', setCategories);
    }
    if (view === 'orders') fetchData('orders', setOrders);
    if (view === 'logs') fetchData('logs', setLogs);
  }, [token, view]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('${API_URL}/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail, password: authPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.user.role !== 'ADMIN' && data.user.role !== 'SUPERADMIN') { showToast('Forbidden', 'error'); return; }
      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      showToast('Logged in successfully');
    } else { showToast(data.message, 'error'); }
  };

  const logout = () => { localStorage.removeItem('admin_token'); setToken(null); };

  const handleImpersonation = async (userId: string) => {
    const res = await fetch(`${API_URL}/api/v1/admin/impersonate/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      window.open(data.user.role === 'VENDOR' ? `${VENDOR_URL}/?token=${data.token}` : `${FRONTEND_URL}/?token=${data.token}`, '_blank');
    } else { showToast('Impersonation failed', 'error'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !token) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const res = await fetch('${API_URL}/api/v1/admin/upload', {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
        });
        const data = await res.json();
        if (res.ok) setProductForm(prev => ({ ...prev, imageUrls: [...prev.imageUrls, data.url] }));
      }
    } finally { setIsUploading(false); }
  };

  const editProduct = (p: any) => {
    setEditingProductId(p.id);
    setIsAddingProduct(false);
    setProductForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      stockQty: p.stockQty,
      vendorId: p.vendorId || '',
      categoryIds: p.categories?.map((c: any) => c.categoryId) || [],
      imageUrls: p.images?.map((img: any) => img.url) || []
    });
  };

  const removeImage = (url: string) => {
    setProductForm(prev => ({ ...prev, imageUrls: prev.imageUrls.filter(u => u !== url) }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProductId ? `${API_URL}/api/v1/admin/products/${editingProductId}/update` : '${API_URL}/api/v1/admin/products';
    const method = 'POST';
    try {
      const res = await fetch(url, {
        method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(productForm)
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddingProduct(false); setEditingProductId(null);
        setProductForm({ name: '', description: '', price: 0, stockQty: 0, vendorId: '', categoryIds: [], imageUrls: [] });
        fetchData('products', setProducts);
        showToast(editingProductId ? 'Listing updated!' : 'Product published!');
      } else {
        showToast(data.message || 'Action failed', 'error');
      }
    } catch (e) { showToast('Network error', 'error'); }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Permanently delete?')) return;
    const res = await fetch(`${API_URL}/api/v1/admin/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { 
      fetchData('products', setProducts);
      showToast('Product deleted');
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a0f1c' }}>
        <form onSubmit={handleLogin} className="glass" style={{ padding: '3rem', borderRadius: '1.5rem', width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center' }}><h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>modcart <span style={{ color: '#3b82f6' }}>Admin</span></h2></div>
          <input placeholder="Admin Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
          <input placeholder="Password" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
          <button type="submit" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '1rem', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Login</button>
        </form>
      </div>
    );
  }

  const SidebarItem = ({ id, label, icon }: { id: any, label: string, icon: string }) => (
    <div 
      onClick={() => setView(id)}
      style={{ 
        padding: '0.75rem 1.25rem', cursor: 'pointer', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: view === id ? 'rgba(59,130,246,0.1)' : 'transparent', color: view === id ? '#3b82f6' : '#94a3b8', fontWeight: '600'
      }}
    >
      <span>{icon}</span> {label}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0f1c', color: 'white' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '2rem', right: '2rem', background: toast.type === 'success' ? '#10b981' : '#ef4444', color: 'white', padding: '1rem 2rem', borderRadius: '1rem', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s' }}>{toast.msg}</div>
      )}

      <aside style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>modcart <span style={{ color: '#3b82f6' }}>Portal</span></h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <SidebarItem id="stats" label="Overview" icon="📊" />
          <SidebarItem id="vendors" label="Vendors" icon="🏪" />
          <SidebarItem id="users" label="Users" icon="👥" />
          <SidebarItem id="products" label="Products" icon="📦" />
          <SidebarItem id="orders" label="Orders" icon="📑" />
          <SidebarItem id="logs" label="Audit Logs" icon="📜" />
        </nav>
        <button onClick={logout} style={{ marginTop: 'auto', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '0.5rem' }}>Sign Out</button>
      </aside>

      <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>{view}</h2>
          
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
                    style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Mark all as read
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {notifications.map((n: any) => (
                    <div key={n.id} style={{ 
                      padding: '1rem', borderRadius: '0.75rem', 
                      backgroundColor: n.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
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
                      <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>🌙</p>
                      <p style={{ fontSize: '0.9rem' }}>All caught up!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {view === 'products' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
             <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
               <button 
                 onClick={() => { setEditingProductId(null); setIsAddingProduct(!isAddingProduct); setProductForm({ name: '', description: '', price: 0, stockQty: 0, vendorId: '', categoryIds: [], imageUrls: [] }); }} 
                 className="btn-small btn-blue"
               >
                 {isAddingProduct || editingProductId ? 'Cancel' : '+ New Product'}
               </button>
               <button 
                 onClick={async () => {
                   if (confirm('Re-index search engine? This will refresh all storefront data.')) {
                     try {
                       const res = await fetch('${API_URL}/api/v1/admin/reindex', { 
                         method: 'POST', 
                         headers: { 'Authorization': `Bearer ${token}` } 
                       });
                       if (res.ok) alert('Re-index complete!');
                       else alert('Re-index failed');
                     } catch (e) { alert('Re-index error'); }
                   }
                 }}
                 style={{ opacity: 0.6, fontSize: '0.8rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', cursor: 'pointer' }}
               >
                 🔄 Force Re-sync Search
               </button>
             </div>

            {(isAddingProduct || editingProductId) && (
              <form onSubmit={handleSaveProduct} className="glass" style={{ padding: '2rem', marginBottom: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <input placeholder="Name" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                <input placeholder="Price" type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} required />
                <input placeholder="Stock" type="number" value={productForm.stockQty} onChange={e => setProductForm({...productForm, stockQty: Number(e.target.value)})} required />
                <select value={productForm.vendorId} onChange={e => setProductForm({...productForm, vendorId: e.target.value})} required>
                   <option value="">Assign Vendor</option>
                   {vendors.map(v => <option key={v.id} value={v.id}>{v.storeName}</option>)}
                </select>
                <select value={productForm.categoryIds[0] || ''} onChange={e => setProductForm({...productForm, categoryIds: [e.target.value]})} required>
                   <option value="">Category</option>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ gridColumn: '1 / -1', border: '1px dashed rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '0.75rem' }}>
                   <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>Gallery (Max 10 images)</p>
                   <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                     {productForm.imageUrls.map((url, i) => (
                       <div key={i} style={{ position: 'relative' }}>
                         <img src={url} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '0.5rem' }} />
                         <button type="button" onClick={() => removeImage(url)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', fontSize: '10px' }}>X</button>
                       </div>
                     ))}
                     {isUploading && <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem' }}>...</div>}
                   </div>
                   <input type="file" multiple onChange={handleFileUpload} />
                </div>
                <textarea placeholder="Description" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} style={{ gridColumn: '1 / -1', minHeight: '100px' }} />
                <button type="submit" className="btn-small btn-blue" style={{ gridColumn: '1 / -1', padding: '1rem' }}>{editingProductId ? 'Update Listing' : 'Publish Product'}</button>
              </form>
            )}

            <div className="glass overflow-hidden"><table className="admin-table"><thead><tr><th>Image</th><th>Name</th><th>Vendor</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead><tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.images?.[0]?.url ? <img src={p.images[0].url} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '0.4rem' }} /> : '--'}</td>
                  <td><b>{p.name}</b></td><td>{p.vendor?.storeName}</td><td>${p.price}</td><td>{p.stockQty}</td>
                  <td><div style={{ display: 'flex', gap: '0.5rem' }}><button onClick={() => editProduct(p)} className="btn-small">Edit</button><button onClick={() => deleteProduct(p.id)} className="btn-small btn-red">Delete</button></div></td></tr>
              ))}
            </tbody></table></div>
          </div>
        )}

        {view === 'stats' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Total Revenue</p><h3>${stats.gmv.toLocaleString()}</h3></div>
              <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Orders</p><h3>{stats.orders}</h3></div>
              <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Vendors</p><h3>{stats.vendors}</h3></div>
              <div className="glass" style={{ padding: '1.5rem' }}><p className="text-muted">Customers</p><h3>{stats.customers}</h3></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div className="glass" style={{ padding: '2rem' }}>
                <h4 style={{ margin: '0 0 1.5rem 0' }}>Conversion Funnel</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Visits</span> <b>{analytics?.funnel?.visits || 0}</b></div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}><div style={{ width: '100%', height: '100%', background: '#3b82f6', borderRadius: '4px' }}></div></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Carts</span> <b>{analytics?.funnel?.carts || 0}</b></div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}><div style={{ width: `${(analytics?.funnel?.carts / analytics?.funnel?.visits * 100) || 0}%`, height: '100%', background: '#8b5cf6', borderRadius: '4px' }}></div></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Orders</span> <b>{analytics?.funnel?.orders || 0}</b></div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}><div style={{ width: `${(analytics?.funnel?.orders / analytics?.funnel?.visits * 100) || 0}%`, height: '100%', background: '#10b981', borderRadius: '4px' }}></div></div>
                </div>
              </div>

              <div className="glass" style={{ padding: '2rem' }}>
                <h4 style={{ margin: '0 0 1.5rem 0' }}>Top Vendors (by Revenue)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {analytics?.vendorRanking?.map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem' }}>{v.name}</span>
                      <span style={{ fontWeight: 'bold', color: '#10b981' }}>${v.earnings.toLocaleString()}</span>
                    </div>
                  ))}
                  {!analytics?.vendorRanking?.length && <p className="text-muted">No sales data yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'orders' && (
           <div className="glass overflow-hidden"><table className="admin-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Vendor(s)</th><th>Total</th></tr></thead><tbody>{orders.map(o => (<tr key={o.id}><td><span className="mono">#{o.id.slice(-8).toUpperCase()}</span></td><td>{o.user.email}</td><td>{o.vendorOrders.map((vo:any) => vo.vendor.storeName).join(', ')}</td><td>${o.total.toLocaleString()}</td></tr>))}</tbody></table></div>
        )}

        {view === 'vendors' && (
           <div className="glass overflow-hidden"><table className="admin-table"><thead><tr><th>Store</th><th>Email</th><th>Products</th><th>Action</th></tr></thead><tbody>{vendors.map(v => (<tr key={v.id}><td><b>{v.storeName}</b></td><td>{v.user.email}</td><td>{v._count?.products || 0}</td><td><button onClick={() => handleImpersonation(v.user.id)} className="btn-small btn-blue">Login</button></td></tr>))}</tbody></table></div>
        )}

        {view === 'users' && (
          <div className="glass overflow-hidden"><table className="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map(u => (<tr key={u.id}><td>{u.email}</td><td>{u.role}</td><td>Active</td></tr>))}</tbody></table></div>
        )}

        {view === 'logs' && (
          <div className="glass overflow-hidden">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td><span className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(log.createdAt).toLocaleString()}</span></td>
                    <td>{log.user?.email || 'System'}</td>
                    <td><span className="badge-blue">{log.action}</span></td>
                    <td>{log.resource} <span className="text-muted">({log.resourceId?.slice(-6)})</span></td>
                    <td><pre style={{ fontSize: '0.7rem', margin: 0 }}>{log.details}</pre></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <style>{`
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 1rem; color: #64748b; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .admin-table td { padding: 1.25rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.9rem; }
        .mono { font-family: monospace; }
        .text-muted { color: #64748b; font-size: 0.85rem; }
        .btn-blue { background: #3b82f6; color: white; border: none; }
        .btn-red { background: rgba(239,68,68,0.1); color: #ef4444; border: none; }
        .btn-small { padding: 0.4rem 0.8rem; border-radius: 0.5rem; cursor: pointer; background: rgba(255,255,255,0.05); color: white; border: none; }
        select, input, textarea { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 0.8rem; border-radius: 0.5rem; outline: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AdminPanel />
    </React.StrictMode>
  );
}
