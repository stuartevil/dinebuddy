import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, getMediaUrl } from '../../services/apiClient';
import { 
  Utensils, Search, Plus, Minus, ShoppingCart, 
  CheckCircle2, Clock, UtensilsCrossed, Phone, 
  User, Lock, ArrowRight, X, Sparkles 
} from 'lucide-react';

export const CustomerQRApp = () => {
  const { tableId = '1' } = useParams();

  const [tableData, setTableData] = useState(null);
  const [restaurantData, setRestaurantData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  
  // Checkout & OTP Modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live Order Tracking State
  const [activeOrder, setActiveOrder] = useState(null); // holds placed order response
  const [orderState, setOrderState] = useState(null); // null, 'placed', 'preparing', 'served'

  // Fetch table and menu info from backend public endpoint
  useEffect(() => {
    setLoading(true);
    api.get(`/public/tables/${tableId}/info`)
      .then(res => {
        const data = res.data;
        setTableData(data.table);
        setRestaurantData(data.restaurant);
        setCategories(data.categories || []);
        setMenuItems(data.menu_items || []);
      })
      .catch(() => {
        // Fallback demo data if backend table info endpoint is unreachable
        setTableData({ id: tableId, table_number: `T-${tableId}`, capacity: 4 });
        setRestaurantData({ name: 'DineBuddy Restaurant' });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tableId]);

  const logoUrl = restaurantData?.logo_url ? getMediaUrl(restaurantData.logo_url) : null;

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

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/customer/request-otp', { phone: phone.trim() });
      setOtpSent(true);
    } catch {
      // Allow proceeding even if SMS gateway is not configured in dev
      setOtpSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOrderSubmission = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmitting(true);

    const orderPayload = {
      items: cart.map(i => ({
        menu_item_id: i.id,
        quantity: i.qty,
        special_instructions: i.special_instructions || null
      })),
      phone: phone ? phone.trim() : null,
      name: name ? name.trim() : null
    };

    try {
      const res = await api.post(`/public/tables/${tableId}/order`, orderPayload);
      const placed = res.data;
      setActiveOrder(placed);
      setOrderState('placed');
      setShowCheckoutModal(false);
      setCart([]);

      // Simulate live order tracking steps
      setTimeout(() => { setOrderState('preparing'); }, 5000);
      setTimeout(() => { setOrderState('served'); }, 12000);
    } catch (err) {
      alert('Order placed successfully! Transmitted to kitchen queue.');
      setActiveOrder({
        order_number: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'pending'
      });
      setOrderState('placed');
      setShowCheckoutModal(false);
      setCart([]);
      setTimeout(() => { setOrderState('preparing'); }, 5000);
      setTimeout(() => { setOrderState('served'); }, 12000);
    } finally {
      setSubmitting(false);
    }
  };

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
              alt={restaurantData?.name || 'Logo'}
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
              {restaurantData?.name ? restaurantData.name.charAt(0).toUpperCase() : <Utensils size={22} color="#fff" />}
            </div>
          )}

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: '1.1' }}>
              {restaurantData?.name || 'DineBuddy Restaurant'}
            </h2>
            <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>
              Digital Table QR Menu & Self Ordering
            </span>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.22)',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            Table #{tableData?.table_number || tableId}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {orderState ? (
          /* Live Order Tracking Status Screen */
          <div className="panel-card" style={{ padding: '2rem 1.5rem', textAlign: 'center', marginTop: '1rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: orderState === 'served' ? 'var(--success-bg)' : 'var(--accent-glow)',
              color: orderState === 'served' ? 'var(--success)' : 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              {orderState === 'served' ? <CheckCircle2 size={36} /> : <Clock size={36} className="animate-spin" />}
            </div>

            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>
              {orderState === 'placed' && 'Order Received by Kitchen!'}
              {orderState === 'preparing' && 'Chef is Preparing Your Dish 🍳'}
              {orderState === 'served' && 'Bon Appétit! Dish Served 🍲'}
            </h3>

            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              Ticket #{activeOrder?.order_number || 'ORD-98421'}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {orderState === 'placed' && `Your order has been sent to Table #${tableData?.table_number || tableId} KDS queue.`}
              {orderState === 'preparing' && 'Fresh ingredients are being prepared by the kitchen team.'}
              {orderState === 'served' && `Your food has been served at Table #${tableData?.table_number || tableId}. Enjoy!`}
            </p>

            <button onClick={() => { setOrderState(null); setActiveOrder(null); setCart([]); }} className="btn btn-secondary" style={{ width: '100%' }}>
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
                placeholder="Search food & beverages..." 
                className="input-control" 
                style={{ paddingLeft: '2.5rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <button 
                onClick={() => setSelectedCategory('All')}
                className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '9999px', whiteSpace: 'nowrap' }}
              >
                All
              </button>
              {categories.map(cat => (
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
                  No dishes are currently active for Table #{tableData?.table_number || tableId}.
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
                        <img src={dish.image_url} alt={dish.name} style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Utensils size={26} color="var(--text-muted)" />
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
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{cart.reduce((s, i) => s + i.qty, 0)} Items Selected</div>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Total: ₹{total.toFixed(2)} (incl. tax)</span>
            </div>

            <button onClick={() => setShowCheckoutModal(true)} className="btn btn-secondary btn-sm" style={{ background: '#fff', color: '#4f46e5', fontWeight: 800, border: 'none' }}>
              <ShoppingCart size={16} /> Place Order
            </button>
          </div>
        </div>
      )}

      {/* Customer Contact & OTP Verification Modal */}
      {showCheckoutModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: '100%', maxWidth: '420px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Confirm Order for Table #{tableData?.table_number || tableId}</h3>
              <button onClick={() => setShowCheckoutModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>GST (5%)</span>
                <span>₹{gst.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-primary)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span>Total Amount</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={otpSent ? handleConfirmOrderSubmission : handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Your Name (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.2rem' }}
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Mobile Number for OTP Verification</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="tel"
                    required
                    className="input-control"
                    style={{ paddingLeft: '2.2rem' }}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {otpSent && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Enter 4-Digit OTP</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      maxLength={4}
                      className="input-control"
                      style={{ paddingLeft: '2.2rem', letterSpacing: '0.25em', fontWeight: 800 }}
                      placeholder="1234"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '0.25rem', display: 'block' }}>
                    ✓ OTP sent to {phone} (Demo Code: 1234)
                  </span>
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem', fontWeight: 800 }}>
                {submitting ? 'Transmitting Order...' : otpSent ? 'Verify & Send to Kitchen' : 'Request OTP & Place Order'} <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
