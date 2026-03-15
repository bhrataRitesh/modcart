import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const VendorPanel = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [view, setView] = useState<'dashboard' | 'inventory' | 'payouts'>('dashboard');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutStats, setPayoutStats] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    stockQty: 0,
    categoryId: '',
    imageUrl: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/v1/products')
      .then(res => res.json())
      .then(data => setProducts(data));
      
    fetch('http://localhost:3001/api/v1/categories')
      .then(res => res.json())
      .then(data => setCategories(data));

    fetch('http://localhost:3001/api/v1/vendor/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data.stats);
        setRecentOrders(data.recentOrders);
      });
      
    fetch('http://localhost:3001/api/v1/payouts')
      .then(res => res.json())
      .then(data => setPayouts(data));

    fetch('http://localhost:3001/api/v1/payouts/stats')
      .then(res => res.json())
      .then(data => setPayoutStats(data));
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:3001/api/v1/vendor/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setForm({ ...form, imageUrl: data.url });
      }
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsUploading(false);
    }
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3001/api/v1/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        categoryIds: [form.categoryId],
      }),
    });
    if (res.ok) {
      const newProd = await res.json();
      setProducts([...products, newProd]);
      setForm({ name: '', description: '', price: 0, stockQty: 0, categoryId: '', imageUrl: '' });
    }
  };

  const handlePayoutRequest = async () => {
    const res = await fetch('http://localhost:3001/api/v1/payouts/request', {
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) {
      alert('Payout request submitted!');
      setPayouts([data, ...payouts]);
      // Refresh stats
      fetch('http://localhost:3001/api/v1/payouts/stats')
        .then(res => res.json())
        .then(stats => setPayoutStats(stats));
    } else {
      alert(data.message || 'Payout request failed');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <nav style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setView('dashboard')}
          style={{ background: 'none', border: 'none', color: view === 'dashboard' ? '#8b5cf6' : '#94a3b8', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setView('inventory')}
          style={{ background: 'none', border: 'none', color: view === 'inventory' ? '#8b5cf6' : '#94a3b8', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
        >
          Inventory
        </button>
        <button 
          onClick={() => setView('payouts')}
          style={{ background: 'none', border: 'none', color: view === 'payouts' ? '#8b5cf6' : '#94a3b8', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
        >
          Payouts
        </button>
      </nav>

      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>Vendor <span style={{ color: '#8b5cf6' }}>Console</span></h1>
        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>{view === 'dashboard' ? 'Performance Overview' : 'Advanced Inventory & Store Management'}</p>
      </header>

      {view === 'dashboard' ? (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Total Earnings</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>${stats?.totalEarnings || 0}</h3>
            </div>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Total Orders</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats?.totalOrders || 0}</h3>
            </div>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Active Products</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats?.activeProducts || 0}</h3>
            </div>
          </div>

          <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Recent Orders</h2>
            {recentOrders.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.85rem' }}>
                    <th style={{ padding: '1rem' }}>Order ID</th>
                    <th style={{ padding: '1rem' }}>Date</th>
                    <th style={{ padding: '1rem' }}>Earnings</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>#{order.orderId.slice(0, 8)}</td>
                      <td style={{ padding: '1rem' }}>{new Date(order.order.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem' }}>${order.vendorEarnings}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '0.5rem', 
                          fontSize: '0.75rem', 
                          background: 'rgba(59,130,246,0.1)', 
                          color: '#60a5fa' 
                        }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No orders found yet.</p>
            )}
          </section>
        </div>
      ) : view === 'inventory' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '2rem' }}>
          {/* Inventory content (the existing one) */}
          <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem', alignSelf: 'start' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>New Listing</h2>
            <form onSubmit={addProduct} style={{ display: 'grid', gap: '1.25rem' }}>
              <input placeholder="Product Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <textarea placeholder="Product Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: '120px' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>Product Image</label>
                <div style={{ 
                  border: '2px dashed rgba(255,255,255,0.1)', 
                  borderRadius: '0.75rem', 
                  padding: '1rem', 
                  textAlign: 'center',
                  position: 'relative'
                }}>
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '0.5rem' }} />
                  ) : (
                    <div style={{ color: '#64748b' }}>{isUploading ? 'Uploading...' : 'Click to Upload'}</div>
                  )}
                  <input 
                    type="file" 
                    onChange={handleImageUpload} 
                    style={{ 
                      position: 'absolute', 
                      top: 0, left: 0, width: '100%', height: '100%', 
                      opacity: 0, cursor: 'pointer' 
                    }} 
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>Price ($)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>Stock Qty</label>
                  <input type="number" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: Number(e.target.value) })} required />
                </div>
              </div>
              <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} required>
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <button type="submit" style={{ 
                background: '#8b5cf6', 
                color: 'white', 
                border: 'none', 
                padding: '1rem', 
                borderRadius: '0.75rem',
                fontWeight: '600',
                marginTop: '0.5rem'
              }}>Publish Item</button>
            </form>
          </section>

          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '600' }}>Live Inventory</h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{products.length} Products</span>
            </div>
            <div style={{ grid: '1fr', gap: '1rem' }}>
              {products.map(prod => (
                <div key={prod.id} className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{prod.name}</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Price: <b style={{ color: 'white' }}>${prod.price}</b></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Stock: <b style={{ color: 'white' }}>{prod.stockQty}</b></span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      padding: '0.35rem 0.85rem', 
                      borderRadius: '2rem', 
                      fontSize: '0.7rem', 
                      fontWeight: '700',
                      background: prod.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: prod.status === 'ACTIVE' ? '#4ade80' : '#f87171',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {prod.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', flex: 1 }}>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Pending Balance</p>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>${payoutStats?.pending || 0}</h3>
              </div>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Processed Payouts</p>
                <h3 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>${payoutStats?.processed || 0}</h3>
              </div>
            </div>
            <button 
              onClick={handlePayoutRequest}
              disabled={!payoutStats?.pending}
              style={{ 
                background: payoutStats?.pending ? '#8b5cf6' : '#1e1b4b', 
                color: 'white', 
                border: 'none', 
                padding: '1rem 2rem', 
                borderRadius: '1rem',
                fontWeight: '600',
                cursor: payoutStats?.pending ? 'pointer' : 'not-allowed',
                marginLeft: '2rem'
              }}
            >
              Request Payout
            </button>
          </div>

          <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Payout History</h2>
            {payouts.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.85rem' }}>
                    <th style={{ padding: '1rem' }}>Payout ID</th>
                    <th style={{ padding: '1rem' }}>Date</th>
                    <th style={{ padding: '1rem' }}>Amount</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(payout => (
                    <tr key={payout.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>#{payout.id.slice(0, 8)}</td>
                      <td style={{ padding: '1rem' }}>{new Date(payout.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem' }}>${payout.amount}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '0.5rem', 
                          fontSize: '0.75rem', 
                          background: payout.status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', 
                          color: payout.status === 'COMPLETED' ? '#4ade80' : '#fbbf24' 
                        }}>
                          {payout.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No payout history found.</p>
            )}
          </section>
        </div>
      )}
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
