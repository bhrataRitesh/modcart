'use client';

import { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, ArrowRight } from 'lucide-react';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  useEffect(() => {
    fetch('http://localhost:3001/api/v1/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Categories fetch failed:', err));
      
    fetch('http://localhost:3001/api/v1/cart')
      .then(res => res.ok ? res.json() : null)
      .then(data => setCart(data))
      .catch(err => console.error('Cart fetch failed:', err));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (selectedCategory) {
      const category = categories.find(c => c.id === selectedCategory);
      if (category) params.append('category', category.name);
    }
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);

    const timer = setTimeout(() => {
      fetch(`http://localhost:3001/api/v1/search?${params.toString()}`)
        .then(res => res.json())
        .then(data => setProducts(data))
        .catch(err => console.error('Search failed:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, categories, minPrice, maxPrice]);

  const addToCart = async (productId: string) => {
    const res = await fetch('http://localhost:3001/api/v1/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    if (res.ok) {
      alert('Added to cart!');
      fetch('http://localhost:3001/api/v1/cart')
        .then(res => res.json())
        .then(data => setCart(data));
    } else {
      alert('Login required to add to cart');
    }
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="glass sticky top-0 z-50 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
            </div>
            <span>modcart</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-400">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={`${!selectedCategory ? 'text-white' : 'hover:text-white'} transition cursor-pointer`}
            >
              All
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`${selectedCategory === cat.id ? 'text-white' : 'hover:text-white'} transition cursor-pointer`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Search className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white transition" />
          <User className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white transition" />
          <div className="relative cursor-pointer group">
            <ShoppingCart className="w-5 h-5 text-gray-400 group-hover:text-white transition" />
            {cart?.items?.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {cart.items.length}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-20 pb-32 px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-30">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/30 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/20 blur-[100px] rounded-full"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
            Elevate Your Style. <br />
            <span className="gradient-text">Modern. Sleek.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Experience the future of multi-vendor commerce with a curated selection of premium electronics, fashion, and lifestyle essentials.
          </p>
          
          <div className="relative max-w-2xl mx-auto">
            <input 
              type="text"
              placeholder="Search for premium gadgets, fashion, and home..."
              className="w-full glass py-5 px-6 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder:text-gray-500 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition active:scale-95">
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center gap-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Price Range</span>
              <input 
                type="number" 
                placeholder="Min" 
                className="w-20 bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <span className="text-gray-700">—</span>
              <input 
                type="number" 
                placeholder="Max" 
                className="w-20 bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
              {(minPrice || maxPrice || selectedCategory) && (
                <button 
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="ml-2 text-xs text-blue-500 hover:text-blue-400 font-bold uppercase transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <button className="btn-primary flex items-center gap-2 mx-auto">
            Shop Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Featured Products */}
      <section className="px-8 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Featured Products</h2>
              <p className="text-gray-400">Handpicked items for your premium lifestyle</p>
            </div>
            <a href="#" className="text-blue-500 hover:text-blue-400 font-medium flex items-center gap-1 group">
              View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.isArray(products) && products.map((product) => (
              <div key={product.id} className="glass p-4 rounded-3xl card-hover flex flex-col h-full border-white/5">
                <div className="aspect-square rounded-2xl bg-slate-800/50 mb-4 flex items-center justify-center relative group overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                  ) : (
                    <span className="text-slate-700 font-bold group-hover:scale-110 transition duration-500">PHOTO</span>
                  )}
                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                </div>
                <div className="flex flex-col flex-1">
                  <h3 className="text-lg font-semibold mb-1 line-clamp-1">{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">{product.description}</p>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="text-xl font-bold tracking-tight">${product.price}</span>
                    <button 
                      onClick={() => addToCart(product.id)}
                      className="p-3 bg-white/5 hover:bg-blue-600 text-gray-400 hover:text-white rounded-xl transition duration-300 active:scale-90"
                    >
                      <ShoppingCart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-2xl font-bold flex items-center gap-2 grayscale hover:grayscale-0 transition">
             <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-white/40 rounded-sm rotate-45"></div>
            </div>
            <span>modcart</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition">Privacy Policy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-white transition">Vendor Portal</a>
            <a href="#" className="hover:text-white transition">Admin Panel</a>
          </div>
          <div className="text-sm text-gray-500">
            © 2026 modcart
          </div>
        </div>
      </footer>
    </div>
  );
}
