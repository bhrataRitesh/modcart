import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const AdminPanel = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const [stats, setStats] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [view, setView] = useState<'stats' | 'users' | 'products' | 'orders' | 'vendors' | 'payouts' | 'reviews'>('stats');
  
  // Add Vendor & User State
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ email: '', password: '', firstName: '', lastName: '', storeName: '' });

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'CUSTOMER' });

  const fetchData = async (endpoint: string, setter: Function) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:3001/api/v1/admin/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setter(data);
      }
    } catch (e) {
      console.error(`Error fetching ${endpoint}`, e);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchData('stats', setStats);
    if (view === 'vendors') fetchData('vendors', setVendors);
    if (view === 'users') fetchData('users', setUsers);
    if (view === 'products') fetchData('products', setProducts);
    if (view === 'orders') fetchData('orders', setOrders);
    if (view === 'payouts') fetchData('payouts', setPayouts);
    if (view === 'reviews') fetchData('reviews', setReviews);
  }, [token, view]);

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
        if (data.user.role !== 'ADMIN' && data.user.role !== 'SUPERADMIN') {
          alert('Access Denied: Not an admin account');
          return;
        }
        localStorage.setItem('admin_token', data.token);
        setToken(data.token);
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (e) {
      alert('Network error during login');
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  const updateVendorStatus = async (id: string, status: string) => {
    const res = await fetch(`http://localhost:3001/api/v1/admin/vendors/${id}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchData('vendors', setVendors);
  };

  const handlePayoutStatus = async (id: string, status: string) => {
    const res = await fetch(`http://localhost:3001/api/v1/admin/payouts/${id}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchData('payouts', setPayouts);
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Remove this review?')) return;
    const res = await fetch(`http://localhost:3001/api/v1/admin/reviews/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchData('reviews', setReviews);
  };

  const handleImpersonation = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/admin/impersonate/${userId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user.role === 'VENDOR') {
          window.open(`http://localhost:3003/?token=${data.token}`, '_blank');
        } else {
          window.open(`http://localhost:3000/?token=${data.token}`, '_blank');
        }
      } else {
        const err = await res.json();
        alert(err.message || 'Access Denied: Impersonation failed');
      }
    } catch (e) {
      alert('Network error during impersonation');
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/api/v1/admin/vendors', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newVendor)
      });
      if (res.ok) {
        setIsAddingVendor(false);
        setNewVendor({ email: '', password: '', firstName: '', lastName: '', storeName: '' });
        fetchData('vendors', setVendors);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to create vendor');
      }
    } catch (e) { alert('Network error'); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setIsAddingUser(false);
        setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'CUSTOMER' });
        fetchData('users', setUsers);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to create user');
      }
    } catch (e) { alert('Network error'); }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a0f1c' }}>
        <form onSubmit={handleLogin} className="glass" style={{ padding: '3rem', borderRadius: '1.5rem', width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>modcart <span style={{ color: '#3b82f6' }}>Admin</span></h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Management Console</p>
          </div>
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
        padding: '0.75rem 1.25rem', paddingLeft: view === id ? '1.5rem' : '1.25rem',
        cursor: 'pointer', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: view === id ? 'rgba(59,130,246,0.1)' : 'transparent',
        color: view === id ? '#3b82f6' : '#94a3b8', fontWeight: '600', transition: 'all 0.2s',
        borderLeft: view === id ? '4px solid #3b82f6' : '4px solid transparent'
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      {label}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0f1c', color: 'white' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ padding: '0.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>modcart <span style={{ color: '#3b82f6' }}>Portal</span></h1>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <SidebarItem id="stats" label="Overview" icon="📊" />
          <SidebarItem id="vendors" label="Vendors" icon="🏪" />
          <SidebarItem id="users" label="Users" icon="👥" />
          <SidebarItem id="products" label="Products" icon="📦" />
          <SidebarItem id="orders" label="Orders" icon="📑" />
          <SidebarItem id="payouts" label="Payouts" icon="💰" />
          <SidebarItem id="reviews" label="Reviews" icon="💬" />
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Administrator</p>
          <p style={{ fontSize: '0.9rem', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden' }}>{authEmail}</p>
          <button onClick={logout} style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Sign Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', textTransform: 'capitalize', marginBottom: '2.5rem' }}>{view} Control</h2>

        {view === 'stats' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
            <div className="glass" style={{ padding: '2rem' }}>
              <p className="text-muted">Total GMV</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>${stats.gmv.toLocaleString()}</h3>
            </div>
            <div className="glass" style={{ padding: '2rem' }}>
              <p className="text-muted">Platform Orders</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{stats.orders}</h3>
            </div>
            <div className="glass" style={{ padding: '2rem' }}>
              <p className="text-muted">Total Vendors</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{stats.vendors}</h3>
            </div>
            <div className="glass" style={{ padding: '2rem' }}>
              <p className="text-muted">Platform Fees</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#10b981' }}>+${stats.platformFee.toLocaleString()}</h3>
            </div>
          </div>
        )}

        {view === 'vendors' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
               <h3 style={{ margin: 0 }}>Marketplace Stores</h3>
               <button onClick={() => setIsAddingVendor(!isAddingVendor)} className={`btn-small ${isAddingVendor ? 'btn-red' : 'btn-blue'}`}>{isAddingVendor ? 'Cancel' : '+ Add Vendor Account'}</button>
            </div>

            {isAddingVendor && (
              <form onSubmit={handleCreateVendor} className="glass" style={{ padding: '2rem', marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <input placeholder="Store Name" value={newVendor.storeName} onChange={e => setNewVendor({...newVendor, storeName: e.target.value})} required />
                <input placeholder="Email Address" type="email" value={newVendor.email} onChange={e => setNewVendor({...newVendor, email: e.target.value})} required />
                <input placeholder="Password" type="password" value={newVendor.password} onChange={e => setNewVendor({...newVendor, password: e.target.value})} required />
                <input placeholder="First Name" value={newVendor.firstName} onChange={e => setNewVendor({...newVendor, firstName: e.target.value})} required />
                <input placeholder="Last Name" value={newVendor.lastName} onChange={e => setNewVendor({...newVendor, lastName: e.target.value})} required />
                <button type="submit" className="btn-small btn-blue" style={{ gridColumn: '1 / -1', padding: '1rem', marginTop: '1rem' }}>Register Vendor Account</button>
              </form>
            )}

            <div className="glass overflow-hidden">
              <table className="admin-table">
                <thead><tr><th>Store</th><th>Earnings</th><th>Products</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.id}>
                      <td><div style={{ display: 'flex', flexDirection: 'column' }}><b>{v.storeName}</b><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{v.user.email}</span></div></td>
                      <td>--</td><td>{v._count?.products || 0}</td>
                      <td><span className={`badge badge-${v.status === 'ACTIVE' ? 'green' : 'yellow'}`}>{v.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <select value={v.status} onChange={(e) => updateVendorStatus(v.id, e.target.value)}>
                            <option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspend</option>
                          </select>
                          <button onClick={() => handleImpersonation(v.user.id)} className="btn-small btn-blue">Login As</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'users' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
               <h3 style={{ margin: 0 }}>Registered Accounts</h3>
               <button onClick={() => setIsAddingUser(!isAddingUser)} className={`btn-small ${isAddingUser ? 'btn-red' : 'btn-blue'}`}>{isAddingUser ? 'Cancel' : '+ Add User Account'}</button>
            </div>

            {isAddingUser && (
              <form onSubmit={handleCreateUser} className="glass" style={{ padding: '2rem', marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <input placeholder="Email Address" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                <input placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                <input placeholder="First Name" value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} required />
                <input placeholder="Last Name" value={newUser.lastName} onChange={e => setNewUser({...newUser, lastName: e.target.value})} required />
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} required>
                  <option value="CUSTOMER">Customer</option>
                  <option value="ADMIN">Admin Assistant</option>
                  <option value="SUPERADMIN">Full Admin</option>
                  <option value="VENDOR">Vendor (Manual)</option>
                </select>
                <button type="submit" className="btn-small btn-blue" style={{ gridColumn: '1 / -1', padding: '1rem', marginTop: '1rem' }}>Register System User</button>
              </form>
            )}

            <div className="glass overflow-hidden">
              <table className="admin-table">
                <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td><span className="mono" style={{ color: u.role === 'SUPERADMIN' ? '#f472b6' : 'inherit' }}>{u.role}</span></td>
                      <td><span className="badge badge-green">ACTIVE</span></td>
                      <td><button onClick={() => handleImpersonation(u.id)} className="btn-small btn-blue">Login As</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ... (Other views consistent with table/glass style) ... */}
        {view === 'products' && (
           <div className="glass overflow-hidden" style={{ animation: 'fadeIn 0.3s' }}>
             <table className="admin-table">
              <thead><tr><th>Product</th><th>Vendor</th><th>Price</th><th>Stock</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}><td><b>{p.name}</b></td><td>{p.vendor?.storeName}</td><td>${p.price}</td><td>{p.stockQty}</td></tr>
                ))}
              </tbody>
             </table>
           </div>
        )}

        {view === 'orders' && (
           <div className="glass overflow-hidden" style={{ animation: 'fadeIn 0.3s' }}>
             <table className="admin-table">
              <thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}><td><span className="mono">#{o.id.slice(-8).toUpperCase()}</span></td><td>{o.user.email}</td><td>${o.total.toLocaleString()}</td><td><span className="badge badge-green">PAID</span></td></tr>
                ))}
              </tbody>
             </table>
           </div>
        )}

        {view === 'payouts' && (
          <div className="glass overflow-hidden" style={{ animation: 'fadeIn 0.3s' }}>
             <table className="admin-table">
              <thead><tr><th>Store</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id}>
                    <td>{p.vendor.storeName}</td><td>${p.amount}</td>
                    <td><span className={`badge badge-${p.status === 'COMPLETED' ? 'green' : 'yellow'}`}>{p.status}</span></td>
                    <td>
                      {p.status === 'PENDING' && (
                        <button onClick={() => handlePayoutStatus(p.id, 'COMPLETED')} className="btn-small btn-blue">Approve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>
          </div>
        )}

        {view === 'reviews' && (
          <div className="glass overflow-hidden" style={{ animation: 'fadeIn 0.3s' }}>
             <table className="admin-table">
              <thead><tr><th>Product</th><th>Comment</th><th>Rating</th><th>Action</th></tr></thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id}>
                    <td>{r.product?.name}</td><td>{r.comment}</td><td>⭐ {r.rating}</td>
                    <td><button onClick={() => deleteReview(r.id)} className="btn-small btn-red">Delete</button></td>
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
        .mono { font-family: monospace; font-size: 0.8rem; }
        .text-muted { color: #64748b; font-size: 0.85rem; }
        .badge { padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.7rem; font-weight: bold; }
        .badge-green { background: rgba(16,185,129,0.1); color: #10b981; }
        .badge-yellow { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .btn-blue { background: #3b82f6; color: white; border: none; }
        .btn-red { background: rgba(239,68,68,0.1); color: #ef4444; border: none; }
        .btn-small { padding: 0.4rem 0.8rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.8rem; font-weight: bold; }
        select { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 0.4rem; border-radius: 0.4rem; outline: none; }
        input { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 0.8rem; borderRadius: 0.5rem; outline: none; }
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
