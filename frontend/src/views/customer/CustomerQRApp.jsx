import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getMediaUrl } from '../../services/apiClient';
import { Utensils, Search, Plus, Minus, ShoppingCart, CheckCircle2, Clock, UtensilsCrossed } from 'lucide-react';

export const CustomerQRApp = () => {
  const { selectedRestaurant, addToast } = useAuth();
  
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [selectedRestaurant?.id, selectedRestaurant?.logo_url]);

  const logoUrl = selectedRestaurant?.logo_url ? getMediaUrl(selectedRestaurant.logo_url) : null;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [orderState, setOrderState] = useState(null); // null, 'placed', 'preparing', 'served'
  const [activeStep, setActiveStep] = useState(1);

  // Fetch real categories and menu items from backend API
  useEffect(() => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const restId = selectedRestaurant.id;

    Promise.all([
      api.get(`/restaurants/${restId}/menu-categories/`).catch(() => ({ data: [] })),
      api.get(`/restaurants/${restId}/menu-items/`).catch(() => ({ data: [] })),
    ]).then(([catRes, itemsRes]) => {
      const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      const itemList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      setCategories(catList);
      setMenuItems(itemList);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRestaurant]);

  const addToCart = (dish) => {
    const dishPrice = parseFloat(dish.price || 0);
    setCart(prev => {
      const exists = prev.find(i => i.id === dish.id);
      if (exists) {
        return prev.map(i => i.id === dish.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...dish, price: dishPrice, qty: 1 }];
    });
  };

  const removeFromCart = (dishId) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === dishId);
      if (exists && exists.qty > 1) {
        return prev.map(i => i.id === dishId ? { ...i, qty: i.qty - 1 } : i);
      }
      return prev.filter(i => i.id !== dishId);
    });
  };

  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const gst = subtotal * 0.05;
  const total = subtotal + gst;

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    setOrderState('placed');
    setActiveStep(2);
    addToast('success', 'Order Sent to Kitchen!', 'Your order has been transmitted to the KDS kitchen queue.');

    // Simulate kitchen order progress steps
    setTimeout(() => { setOrderState('preparing'); }, 4000);
    setTimeout(() => { setOrderState('served'); }, 9000);
  };

  const DEFAULT_SYSTEM_CATEGORIES = [
    'north indian', 'south indian', 'chinese', 'desserts', 
    'beverages', 'coffee', 'fast food', 'bakery', 
    'continental', 'italian', 'multi-cuisine', 'dairy', 
    'packaging', 'syrup', 'general'
  ];

  const isDisableDefault = localStorage.getItem('dinebuddy_disable_default_menu_categories') === 'true';

  const visibleCategories = isDisableDefault
    ? categories.filter(c => !c.is_global && !DEFAULT_SYSTEM_CATEGORIES.includes((c.name || '').trim().toLowerCase()))
    : categories;

  const filteredDishes = menuItems.filter(item => {
    const matchCategory = selectedCategory === 'All' || item.category_id === Number(selectedCategory);
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '1.5rem 1.25rem', color: '#fff', borderRadius: '0 0 24px 24px', boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={selectedRestaurant?.name || 'Restaurant Logo'}
              onError={() => setLogoError(true)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                objectFit: 'cover',
                border: '2px solid rgba(255, 255, 255, 0.8)',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            />
          ) : (
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.3rem',
              color: '#ffffff',
            }}>
              {selectedRestaurant?.name ? (
                selectedRestaurant.name.charAt(0).toUpperCase()
              ) : (
                <Utensils size={22} color="#fff" style={{ margin: 'auto' }} />
              )}
            </div>
          )}

          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', lineHeight: '1.1' }}>
              {selectedRestaurant?.name || 'DineBuddy Restaurant'}
            </h2>
            <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>Digital Table QR Self-Ordering Menu</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {orderState ? (
          /* Live Order Tracking Status Screen */
          <div className="panel-card" style={{ padding: '2rem 1.5rem', textAlign: 'center', marginTop: '1rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: orderState === 'served' ? 'var(--success-bg)' : 'var(--accent-glow)', color: orderState === 'served' ? 'var(--success)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              {orderState === 'served' ? <CheckCircle2 size={36} /> : <Clock size={36} className="animate-spin" />}
            </div>

            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>
              {orderState === 'placed' && 'Order Received by Kitchen!'}
              {orderState === 'preparing' && 'Chef is Preparing Your Dish 🍳'}
              {orderState === 'served' && 'Bon Appétit! Dish Served 🍲'}
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {orderState === 'placed' && 'Your order ticket #104 has been sent to KDS screen.'}
              {orderState === 'preparing' && 'Fresh ingredients are being cooked right now.'}
              {orderState === 'served' && 'Your food has arrived at Table T-12. Enjoy your meal!'}
            </p>

            <button onClick={() => { setOrderState(null); setCart([]); }} className="btn btn-secondary" style={{ width: '100%' }}>
              Browse Menu Again
            </button>
          </div>
        ) : (
          <>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search menu..." 
                className="input-control" 
                style={{ paddingLeft: '2.5rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Pills (Dynamic from Database) */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <button 
                onClick={() => setSelectedCategory('All')}
                className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '9999px', whiteSpace: 'nowrap' }}
              >
                All
              </button>
              {visibleCategories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '9999px', whiteSpace: 'nowrap' }}
                >
                  {cat.name}
                </button>
              ))}
            </div>


            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading digital menu...
              </div>
            ) : menuItems.length === 0 ? (
              <div className="panel-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <UtensilsCrossed size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>No Menu Items Available</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No dishes are currently active on the digital menu.
                </p>
              </div>
            ) : (
              /* Menu Items Cards List */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredDishes.map(dish => {
                  const inCart = cart.find(i => i.id === dish.id);
                  const dishPrice = parseFloat(dish.price || 0);

                  return (
                    <div key={dish.id} className="panel-card" style={{ display: 'flex', gap: '1rem', padding: '0.9rem', alignItems: 'center' }}>
                      {dish.image_url ? (
                        <img src={dish.image_url} alt={dish.name} style={{ width: '85px', height: '85px', borderRadius: '12px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '85px', height: '85px', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Utensils size={28} color="var(--text-muted)" />
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.05rem' }}>{dish.name}</h4>
                        {dish.description && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{dish.description}</p>
                        )}
                        <div style={{ fontWeight: 800, color: 'var(--success)', marginTop: '0.35rem' }}>₹{dishPrice.toFixed(2)}</div>
                      </div>

                      <div>
                        {inCart ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent-glow)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)' }}>
                            <button onClick={() => removeFromCart(dish.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={14} /></button>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{inCart.qty}</span>
                            <button onClick={() => addToCart(dish)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(dish)} className="btn btn-primary btn-sm" style={{ borderRadius: 'var(--radius-md)' }}>
                            <Plus size={14} /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !orderState && (
        <div style={{ position: 'sticky', bottom: '1rem', padding: '0 1.25rem', marginTop: 'auto' }}>
          <div className="panel-card" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg)', boxShadow: '0 15px 35px rgba(99, 102, 241, 0.4)' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{cart.reduce((s, i) => s + i.qty, 0)} Items in Cart</div>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Total: ₹{total.toFixed(2)} (incl GST)</span>
            </div>

            <button onClick={handlePlaceOrder} className="btn btn-secondary btn-sm" style={{ background: '#fff', color: '#4f46e5', fontWeight: 800, border: 'none' }}>
              <ShoppingCart size={16} /> Place Order
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
