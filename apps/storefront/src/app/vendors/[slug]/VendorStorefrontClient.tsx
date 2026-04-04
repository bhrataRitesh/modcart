'use client';

import { useState, useEffect } from 'react';
import { Star, MessageSquare, ShoppingCart, Search, User } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VendorStorefrontClient({ initialVendor, slug }: { initialVendor: any, slug: string }) {
  const [vendor, setVendor] = useState<any>(initialVendor);

  useEffect(() => {
    if (vendor && slug) {
      // Track Visit
      let visitorId = localStorage.getItem('visitor_id');
      if (!visitorId) {
        visitorId = 'v_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('visitor_id', visitorId);
      }

      fetch(`${API_URL}/api/v1/vendor/track-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendor.id,
          visitorId,
          path: window.location.pathname
        })
      }).catch(() => {});
    }
  }, [vendor, slug]);

  if (!vendor) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Store Not Found</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <nav className="border-b border-white/5 py-4 px-8 flex justify-between items-center bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <h1 className="text-xl font-bold tracking-tighter cursor-pointer" onClick={() => window.location.href = '/'}>MODCART</h1>
        <div className="flex gap-6 items-center">
          <Search size={20} className="text-white/40 cursor-pointer" />
          <User size={20} className="text-white/40 cursor-pointer" />
          <ShoppingCart size={20} className="text-white/40 cursor-pointer" />
        </div>
      </nav>

      <header className="relative py-24 px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-30"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 rounded-3xl bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 shadow-2xl">
              {vendor.logo ? <img src={vendor.logo} className="w-full h-full object-cover" /> : <div className="text-4xl font-bold text-white/20">{vendor.storeName[0]}</div>}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-4xl font-extrabold tracking-tight mb-2">{vendor.storeName}</h2>
              <p className="text-white/60 mb-4 max-w-xl">{vendor.description || 'Welcome to our official store.'}</p>
              <div className="flex items-center gap-4 justify-center md:justify-start">
                <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" /> 4.9 (124 reviews)
                </span>
                <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all active:scale-95">
                  <MessageSquare size={16} /> Contact Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
          Our Products <span className="bg-white/10 text-xs px-2 py-1 rounded-md">{vendor.products?.length || 0}</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {vendor.products?.map((product: any) => (
            <div key={product.id} className="group bg-white/5 border border-white/5 rounded-3xl overflow-hidden hover:border-purple-500/30 transition-all cursor-pointer">
              <div className="aspect-square relative overflow-hidden bg-white/5">
                {product.images?.[0]?.url ? (
                  <img src={product.images[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 font-bold">NO IMAGE</div>
                )}
                {product.stockQty <= 5 && <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">ONLY {product.stockQty} LEFT</div>}
              </div>
              <div className="p-5">
                <h4 className="font-bold mb-1 truncate">{product.name}</h4>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-extrabold text-blue-400">${product.price.toFixed(2)}</span>
                  <button className="bg-white text-black p-2 rounded-xl hover:bg-purple-500 hover:text-white transition-colors">
                    <ShoppingCart size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {vendor.products?.length === 0 && (
          <div className="py-24 text-center text-white/20">
             <div className="text-6xl mb-4">📦</div>
             <p className="text-xl font-medium">No active products yet.</p>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-white/20 text-sm">
        &copy; 2026 MODCART — Marketplace Powered.
      </footer>
    </div>
  );
}
