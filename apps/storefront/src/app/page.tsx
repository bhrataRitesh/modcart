'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, User, ArrowRight, Star, X, MessageSquare, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '../components/CheckoutForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState<'idle' | 'loading' | 'payment' | 'success' | 'error'>('idle');
  const [completedOrder, setCompletedOrder] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountData, setAccountData] = useState<any>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [activeChatVendor, setActiveChatVendor] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [mainModalImage, setMainModalImage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (activeChatVendor) {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      fetch(`${API_URL}/api/v1/chat/history/${activeChatVendor}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(history => setChatMessages(Array.isArray(history) ? history : []));

      const socket = new WebSocket(`ws://localhost:3001/api/v1/chat/ws/${activeChatVendor}?token=${token}`);
      socket.onmessage = (event) => {
        try {
          const newMsg = JSON.parse(event.data);
          setChatMessages(prev => [...prev, newMsg]);
        } catch (e) {}
      };
      setWs(socket);

      return () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    } else {
      if (ws) {
        ws.close();
        setWs(null);
      }
    }
  }, [activeChatVendor]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !ws) return;
    ws.send(chatInput);
    setChatInput('');
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isAccountOpen) {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      fetch('${API_URL}/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => setAccountData(data))
        .catch(() => console.log('Auth check failed'));
        
      fetch('${API_URL}/api/v1/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setOrderHistory(data);
          else setOrderHistory([]);
        })
        .catch(err => console.error('Orders fetch failed', err));
    }
  }, [isAccountOpen]);

  useEffect(() => {
    fetch('${API_URL}/api/v1/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
        else console.error('Categories API returned non-array:', data);
      })
      .catch(err => console.error('Categories fetch failed:', err));
      
    // Impersonation Login check
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetchCart();
  }, []);

  const fetchCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) return setCart(null);
    try {
      const res = await fetch('${API_URL}/api/v1/cart', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCart(await res.json());
      else setCart(null);
    } catch (err) {
      setCart(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (selectedCategory) {
      const category = categories.find(c => c.id === selectedCategory);
      if (category) params.append('category', category.name);
    }
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);
    params.append('t', Date.now().toString());

    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/v1/search?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setProducts(data);
          else if (data && Array.isArray(data.items)) setProducts(data.items);
          else console.error('Search API returned invalid data:', data);
        })
        .catch(err => console.error('Search failed:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, categories, minPrice, maxPrice]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const body = authMode === 'login' 
        ? { email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword, firstName: authFirstName, lastName: authLastName };

      const res = await fetch(`${API_URL}/api/v1/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        if (authMode === 'register') {
          // Auto login after register
          const loginRes = await fetch('${API_URL}/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: authEmail, password: authPassword })
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) localStorage.setItem('token', loginData.token);
        } else {
          localStorage.setItem('token', data.token);
        }
        
        // Refresh account UI and Cart
        setIsAccountOpen(false);
        fetchCart();
        setTimeout(() => setIsAccountOpen(true), 100);
      } else {
        setAuthError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Network error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAccountData(null);
    setOrderHistory([]);
    setCart(null);
  };

  const addToCart = async (productId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Please log in from the Account menu first!', 'error');
      setIsAccountOpen(true);
      return;
    }
    const res = await fetch('${API_URL}/api/v1/cart/items', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    if (res.ok) {
      showToast('Added to cart!', 'success');
      fetchCart();
    } else {
      showToast('Login required to add to cart', 'error');
    }
  }

  const updateQuantity = async (itemId: string, quantity: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    if (quantity <= 0) {
      return removeFromCart(itemId);
    }
    
    try {
      const res = await fetch(`${API_URL}/api/v1/cart/items/${itemId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ quantity }),
      });
      if (res.ok) fetchCart();
      else showToast(await res.text(), 'error');
    } catch (e) {
      showToast('Network error on update', 'error');
    }
  };

  const removeFromCart = async (itemId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/v1/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchCart();
      else showToast(await res.text(), 'error');
    } catch (e) {
      showToast('Network error on remove', 'error');
    }
  };

  const fetchReviews = (productId: string) => {
    fetch(`${API_URL}/api/v1/reviews/${productId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReviews(data);
        else {
          console.error('Reviews API returned non-array:', data);
          setReviews([]);
        }
      })
      .catch(err => {
        console.error('Reviews fetch failed:', err);
        setReviews([]);
      });
  }

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('${API_URL}/api/v1/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedProduct.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      }),
    });
    if (res.ok) {
      showToast('Review submitted!', 'success');
      setReviewForm({ rating: 5, comment: '' });
      fetchReviews(selectedProduct.id);
    } else {
      const data = await res.json();
      showToast(data.message || 'Submission failed', 'error');
    }
  }

  const handleCheckout = async () => {
    const token = localStorage.getItem('token');
    if (!token) return showToast('Please log in manually.', 'error');
    
    setCheckoutState('loading');
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      
      if (res.ok && data.clientSecret) {
        setClientSecret(data.clientSecret);
        setCompletedOrder(data.orderId);
        setCheckoutState('payment');
      } else {
        setCheckoutState('error');
        showToast(data.message || 'Checkout failed', 'error');
      }
    } catch (err) {
      setCheckoutState('error');
      console.error(err);
    }
  };

  const cartTotal = cart?.items?.reduce((acc: number, item: any) => {
    return acc + (item.variant?.price || item.product.price) * item.quantity;
  }, 0) || 0;

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
          <User onClick={() => setIsAccountOpen(true)} className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white transition" />
          <div className="relative cursor-pointer group" onClick={() => setIsCartOpen(true)}>
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
              <div 
                key={product.id} 
                className="glass p-4 rounded-3xl card-hover flex flex-col h-full border-white/5 cursor-pointer"
                onClick={() => {
                  setSelectedProduct(product);
                  setMainModalImage(product.imageUrl);
                  fetchReviews(product.id);
                }}
              >
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
                  {product.isVerified && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-blue-500">Verified Vendor</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
          <div className="glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] relative z-10 flex flex-col md:flex-row border-white/10">
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition z-20"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="md:w-1/2 p-8 border-r border-white/5 flex flex-col">
              <div className="aspect-square rounded-3xl bg-slate-800/50 flex flex-col items-center justify-center overflow-hidden mb-6 relative group">
                {(mainModalImage || selectedProduct.imageUrl) ? (
                  <img src={mainModalImage || selectedProduct.imageUrl} className="w-full h-full object-cover transition duration-700 ease-in-out" />
                ) : (
                  <span className="text-4xl font-bold text-slate-700">PHOTO</span>
                )}
                
                {selectedProduct.imageUrls && selectedProduct.imageUrls.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx = selectedProduct.imageUrls.indexOf(mainModalImage || selectedProduct.imageUrl);
                        const next = idx === 0 ? selectedProduct.imageUrls.length - 1 : idx - 1;
                        setMainModalImage(selectedProduct.imageUrls[next]);
                      }}
                      className="absolute left-4 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition duration-300"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx = selectedProduct.imageUrls.indexOf(mainModalImage || selectedProduct.imageUrl);
                        const next = idx === selectedProduct.imageUrls.length - 1 ? 0 : idx + 1;
                        setMainModalImage(selectedProduct.imageUrls[next]);
                      }}
                      className="absolute right-4 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition duration-300"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    
                    <div className="absolute bottom-4 flex gap-1.5">
                      {selectedProduct.imageUrls.map((_: any, i: number) => (
                        <div 
                          key={i} 
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${ (mainModalImage || selectedProduct.imageUrl) === selectedProduct.imageUrls[i] ? 'bg-white w-4' : 'bg-white/40' }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {selectedProduct.imageUrls && selectedProduct.imageUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
                  {selectedProduct.imageUrls.map((url: string, idx: number) => (
                    <button 
                      key={idx} 
                      onClick={() => setMainModalImage(url)}
                      className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${mainModalImage === url ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <img src={url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <h2 className="text-3xl font-bold mb-4">{selectedProduct.name}</h2>
                <p className="text-gray-400 leading-relaxed mb-6">{selectedProduct.description}</p>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl mt-6">
                <span className="text-3xl font-bold">${selectedProduct.price}</span>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const token = localStorage.getItem('token');
                      if (!token) {
                        showToast('Please log in first to chat', 'error');
                        setIsAccountOpen(true);
                        return;
                      }
                      setActiveChatVendor(selectedProduct.vendorId);
                      setSelectedProduct(null);
                    }}
                    className="p-4 rounded-xl border border-white/10 hover:bg-white/10 transition font-semibold flex items-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5"/> Chat
                  </button>
                  <button 
                    onClick={() => addToCart(selectedProduct.id)}
                    className="btn-primary"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>

            <div className="md:w-1/2 p-8 bg-black/20">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                Community Reviews 
                <span className="text-sm font-normal text-gray-500">({reviews.length})</span>
              </h3>

              <div className="space-y-6 mb-8">
                {reviews.map((rev, i) => (
                  <div key={i} className="glass p-4 rounded-2xl border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm">{rev.user.firstName} {rev.user.lastName}</span>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className={`w-3 h-3 ${j < rev.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 italic">"{rev.comment}"</p>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <p className="text-center py-8 text-gray-500 italic">No reviews yet. Be the first!</p>
                )}
              </div>

              <div className="glass p-6 rounded-3xl border-white/10">
                <h4 className="font-bold mb-4">Share Your Feedback</h4>
                <form onSubmit={submitReview} className="space-y-4">
                  <div className="flex gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button 
                        key={s} 
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                        className={`p-2 rounded-lg transition ${reviewForm.rating >= s ? 'text-yellow-500' : 'text-gray-600'}`}
                      >
                        <Star className={`w-6 h-6 ${reviewForm.rating >= s ? 'fill-yellow-500' : ''}`} />
                      </button>
                    ))}
                  </div>
                  <textarea 
                    placeholder="Tell us what you think..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-blue-500 transition text-sm min-h-[100px]"
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({...reviewForm, comment: e.target.value})}
                    required
                  />
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition">
                    Submit Review
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Account Sidebar */}
      {isAccountOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAccountOpen(false)}></div>
          <div className="w-full max-w-lg h-full bg-[#0a0f1c]/95 backdrop-blur-2xl border-l border-white/10 relative z-10 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" /> My Account
              </h2>
              <button onClick={() => setIsAccountOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Profile Details or Auth Form */}
              <div className="mb-8">
                {accountData ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white/80">Profile Information</h3>
                      <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300 transition">Log Out</button>
                    </div>
                    <div className="glass p-5 rounded-2xl border border-white/5 space-y-3">
                      <p><span className="text-gray-400">Name:</span> {accountData.firstName} {accountData.lastName}</p>
                      <p><span className="text-gray-400">Email:</span> {accountData.email}</p>
                      <p><span className="text-gray-400">Status:</span> <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded text-xs">{accountData.status}</span></p>
                    </div>
                  </>
                ) : (
                  <div className="glass p-6 rounded-2xl border border-white/5">
                    <div className="flex gap-4 border-b border-white/10 mb-6 pb-2">
                      <button 
                        onClick={() => setAuthMode('login')} 
                        className={`pb-2 font-semibold transition ${authMode === 'login' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-white'}`}
                      >
                        Log In
                      </button>
                      <button 
                        onClick={() => setAuthMode('register')} 
                        className={`pb-2 font-semibold transition ${authMode === 'register' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-white'}`}
                      >
                        Register
                      </button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                      {authError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{authError}</div>}
                      
                      {authMode === 'register' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">First Name</label>
                            <input type="text" value={authFirstName} onChange={e => setAuthFirstName(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Last Name</label>
                            <input type="text" value={authLastName} onChange={e => setAuthLastName(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" />
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Email</label>
                        <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Password</label>
                        <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={8} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" />
                      </div>

                      <button type="submit" disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
                        {authLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Order History */}
              {accountData && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-white/80">Order History</h3>

                {orderHistory.length > 0 ? (
                  <div className="space-y-4">
                    {orderHistory.map(order => (
                      <div key={order.id} className="glass p-5 rounded-2xl border border-white/5 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm text-gray-400">Order ID</p>
                            <p className="font-mono text-sm text-blue-400">{order.id.slice(-8)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">${order.total}</p>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-white/10 text-white/80">
                              {order.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mt-2 pt-3 border-t border-white/5">
                          <p className="text-xs text-gray-500 font-semibold mb-1">ITEMS:</p>
                          {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-300">{item.quantity}x {item.name}</span>
                              <span className="text-gray-400">${item.total}</span>
                            </div>
                          ))}
                        </div>
                        
                        {order.vendorOrders && order.vendorOrders.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                            <strong>Shipped by:</strong> {order.vendorOrders.map((vo: any) => vo.vendor.storeName).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass p-8 rounded-2xl border border-white/5 text-center text-gray-400 flex flex-col items-center justify-center">
                    <ShoppingCart className="w-8 h-8 mb-3 opacity-50" />
                    <p>No orders yet.</p>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="w-full max-w-md h-full bg-[#0a0f1c]/95 backdrop-blur-2xl border-l border-white/10 relative z-10 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right">
            
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-500" /> Your Cart
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {checkoutState === 'success' ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Payment Successful!</h3>
                  <p className="text-gray-400">Your order has been placed successfully.</p>
                  <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 inline-block font-mono text-sm text-blue-400 mt-4">
                    Order ID: {completedOrder}
                  </div>
                  <button onClick={() => { setIsCartOpen(false); setCheckoutState('idle'); }} className="btn-primary w-full mt-8">
                    Continue Shopping
                  </button>
                </div>
              ) : cart?.items?.length > 0 ? (
                <div className="space-y-4">
                  {cart.items.map((item: any) => (
                    <div key={item.id} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 relative group transition-all hover:bg-white/10">
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg z-10 hover:bg-red-600"
                        title="Remove from cart"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <div className="w-20 h-20 rounded-xl bg-slate-800/50 flex items-center justify-center overflow-hidden shrink-0">
                        {item.product.imageUrl ? (
                          <img src={item.product.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-700">PHOTO</span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <h4 className="font-semibold text-sm line-clamp-1 pr-4">{item.product.name}</h4>
                        <div className="flex items-center gap-3 mt-2 mb-2">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition">-</button>
                          <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition">+</button>
                        </div>
                        <div className="mt-auto flex justify-between items-center">
                          <span className="font-bold text-blue-400">${item.variant?.price || item.product.price}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <ShoppingCart className="w-12 h-12 mb-4" />
                  <p>Your cart is empty.</p>
                </div>
              )}
            </div>

            {cart?.items?.length > 0 && checkoutState !== 'success' && (
              <div className="p-6 border-t border-white/10 bg-black/40 relative">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold">${cartTotal.toFixed(2)}</span>
                </div>
                
                {checkoutState === 'payment' && clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                    <CheckoutForm 
                      amount={cartTotal}
                      onSuccess={() => {
                        setCheckoutState('success');
                        setCart({ items: [] });
                      }}
                      onError={(msg) => {
                        showToast(msg, 'error');
                        setCheckoutState('idle');
                      }}
                    />
                  </Elements>
                ) : (
                  <button 
                    onClick={handleCheckout} 
                    disabled={checkoutState === 'loading'}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50"
                    style={{ backgroundImage: 'linear-gradient(to right, #2563eb, #7c3aed)' }}
                  >
                    {checkoutState === 'loading' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      'Secure Checkout'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Sidebar */}
      {activeChatVendor && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveChatVendor(null)}></div>
          <div className="w-full max-w-md h-full bg-[#0a0f1c]/95 backdrop-blur-2xl border-l border-white/10 relative z-10 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right">
            
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" /> Live Support
              </h2>
              <button onClick={() => setActiveChatVendor(null)} className="p-2 hover:bg-white/10 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 mt-12 pb-12">
                  <div className="bg-white/5 p-6 rounded-full">
                    <MessageSquare className="w-8 h-8 opacity-50 text-blue-400" />
                  </div>
                  <p className="font-semibold">Start chatting seamlessly</p>
                  <p className="text-sm text-center">Messages are sent directly to the vendor's dashboard in real-time.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.isFromVendor ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.isFromVendor ? 'bg-white/10 text-white rounded-tl-sm border border-white/5' : 'bg-blue-600 text-white rounded-tr-sm shadow-[0_0_20px_rgba(37,99,235,0.2)]'}`}>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40">
              <form onSubmit={sendChatMessage} className="flex gap-3">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition text-sm text-white focus:bg-white/10"
                />
                <button 
                  type="submit" 
                  title="Send"
                  disabled={!chatInput.trim()}
                  className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 text-white flex items-center justify-center min-w-[50px]"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-bottom border ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
        }`}>
          {toast.type === 'success' ? <div className="w-2 h-2 rounded-full bg-green-400"></div> : <div className="w-2 h-2 rounded-full bg-red-400"></div>}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
