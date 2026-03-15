import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const AdminPanel = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/v1/categories')
      .then(res => res.json())
      .then(data => setCategories(data));
  }, []);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3001/api/v1/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      const newCat = await res.json();
      setCategories([...categories, newCat]);
      setName('');
      setDescription('');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>modcart <span style={{ color: '#3b82f6' }}>Admin</span></h1>
        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Centralized Category Management</p>
      </header>
      
      <section style={{ marginBottom: '4rem' }} className="glass">
        <div style={{ padding: '2rem', borderRadius: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Add New Category</h2>
          <form onSubmit={addCategory} style={{ display: 'grid', gap: '1rem', maxWidth: '400px' }}>
            <input 
              placeholder="Category Name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
            <input 
              placeholder="Short Description" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
            <button type="submit" style={{ 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              padding: '0.75rem', 
              borderRadius: '0.5rem',
              fontWeight: '600',
              marginTop: '0.5rem'
            }}>Create Category</button>
          </form>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Existing Categories</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {categories.map(cat => (
            <div key={cat.id} className="glass" style={{ padding: '1.5rem', borderRadius: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontWeight: '600' }}>{cat.name}</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{cat.description}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', background: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                  {cat.slug}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
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
