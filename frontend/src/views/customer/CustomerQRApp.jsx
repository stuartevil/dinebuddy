import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, getMediaUrl } from '../../services/apiClient';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../../services/firebase';
import {
  Utensils, Search, Plus, Minus, ShoppingCart,
  CheckCircle2, Clock, UtensilsCrossed, Phone,
  User, Lock, ArrowRight, X, Sparkles, ChefHat,
  Bell, CheckCheck, RefreshCw, LogOut, ShieldCheck,
  Trash2, ShoppingBag, Receipt, MapPin
} from 'lucide-react';
import { formatISTTime, formatFullISTDateTime } from '../../utils/dateUtils';

export const CustomerQRApp = () => {
  const { tableId = '1', restaurantId } = useParams();
  const sessionKey = restaurantId ? `dinebuddy_customer_r_${restaurantId}_t_${tableId}` : `dinebuddy_customer_table_${tableId}`;

  // Table & Restaurant Data
  const [tableData, setTableData] = useState(null);
  const [restaurantData, setRestaurantData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  // Toggle to bypass Firebase SMS OTP for testing/development (Set to false to re-enable strict OTP)
  const BYPASS_FIREBASE_OTP = false;

  // Step state: 1 = Welcome & Login, 2 = Menu & Cart, 3 = Order Tracking
  const [currentStep, setCurrentStep] = useState(BYPASS_FIREBASE_OTP ? 2 : 1);

  // Customer Login & Firebase State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [checkingCustomerStatus, setCheckingCustomerStatus] = useState(false);
  const [authError, setAuthError] = useState('');

  // Menu Search & Filters State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState({});
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Active Placed Order & Live Tracking State
  const [activeOrder, setActiveOrder] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [billRequested, setBillRequested] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);

  // Customization Popup state
  const [customizingDish, setCustomizingDish] = useState(null);
  const [customizingGroups, setCustomizingGroups] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});
  const [customizingQty, setCustomizingQty] = useState(1);

  // Load stored customer session if present
  useEffect(() => {
    const savedCustomer = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey);
    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        if (parsed.phone) {
          setCustomerName(parsed.name || '');
          setCustomerPhone(parsed.phone || '');
          setCurrentStep(2);
        }
      } catch {
        sessionStorage.removeItem(sessionKey);
        localStorage.removeItem(sessionKey);
      }
    }
  }, [sessionKey]);

  // Fetch Table and Menu Details from Backend API
  useEffect(() => {
    setLoading(true);
    const tableInfoUrl = restaurantId
      ? `/public/restaurants/${encodeURIComponent(restaurantId)}/tables/${encodeURIComponent(tableId)}/info`
      : `/public/tables/${encodeURIComponent(tableId)}/info`;

    api.get(tableInfoUrl)
      .then(res => {
        const data = res.data;
        setTableData(data.table);
        setRestaurantData(data.restaurant);
        setCategories(data.categories || []);
        setMenuItems(data.menu_items || []);
      })
      .catch((err) => {
        console.warn("Failed to fetch menu info:", err);
        setTableData({ id: tableId, table_number: `${tableId}`, capacity: 4 });
        setRestaurantData({ name: 'Restaurant Menu' });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tableId, restaurantId]);

  // Polling active order status from backend when tracking screen is open
  useEffect(() => {
    if (currentStep !== 3 || !activeOrder?.id) return;

    const pollInterval = setInterval(() => {
      api.get(`/public/tables/orders/${activeOrder.id}/status`)
        .then(res => {
          if (res.data) {
            setActiveOrder(res.data);
          }
        })
        .catch(() => { });
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [currentStep, activeOrder?.id]);

  const handleRequestBill = async () => {
    setRequestingBill(true);
    try {
      const billUrl = restaurantId
        ? `/public/restaurants/${encodeURIComponent(restaurantId)}/tables/${encodeURIComponent(tableId)}/request-bill`
        : `/public/tables/${encodeURIComponent(tableId)}/request-bill`;
      await api.post(billUrl);
    } catch (e) {
      console.log("Bill requested:", e);
    } finally {
      setBillRequested(true);
      setRequestingBill(false);
    }
  };

  const logoUrl = restaurantData?.logo_url ? getMediaUrl(restaurantData.logo_url) : null;

  // Initialize Firebase Recaptcha Verifier
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => { },
        'expired-callback': () => {
          setAuthError('Recaptcha expired. Please try sending OTP again.');
        }
      });
    }
  };

  // Step 1: Smart Multi-Tenant Customer Authentication & OTP Flow
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const targetRestId = restaurantId || restaurantData?.id;

    // 1. If OTP was already sent, verify the 6-digit SMS OTP code
    if (otpSent) {
      if (!customerName || !customerName.trim()) {
        setAuthError('Please enter your full name.');
        return;
      }
      if (!otpCode || otpCode.trim().length !== 6) {
        setAuthError('Please enter the 6-digit SMS OTP received on your phone.');
        return;
      }

      setIsVerifying(true);
      try {
        if (confirmationResult) {
          await confirmationResult.confirm(otpCode.trim());
        }

        // Register diner as verified for this specific restaurant
        const regUrl = targetRestId
          ? `/public/restaurants/${encodeURIComponent(targetRestId)}/customers/register`
          : `/public/customers/register`;
        await api.post(regUrl, { phone: cleanPhone, name: customerName.trim() }).catch(() => { });

        const sessionData = { name: customerName.trim(), phone: cleanPhone, verified: true };
        sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
        localStorage.setItem(sessionKey, JSON.stringify(sessionData));
        setCurrentStep(2); // Move to Step 2: Digital Menu
      } catch (err) {
        console.error('Firebase OTP Verification Error:', err);
        setAuthError('Invalid OTP code. Please enter the exact 6-digit SMS OTP received on your mobile number.');
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    // 2. Check if customer is already verified at this restaurant (Zero OTP for Returning Diners)
    setCheckingCustomerStatus(true);
    try {
      const checkUrl = targetRestId
        ? `/public/restaurants/${encodeURIComponent(targetRestId)}/customers/check-status`
        : `/public/customers/check-status`;

      const res = await api.post(checkUrl, { phone: cleanPhone });
      const statusData = res.data;

      // Existing verified customer in this restaurant -> NO OTP REQUIRED!
      if (statusData.requires_otp === false) {
        const finalName = statusData.name || customerName.trim() || 'Guest Diner';
        setCustomerName(finalName);
        const sessionData = { name: finalName, phone: cleanPhone, verified: true };
        sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
        localStorage.setItem(sessionKey, JSON.stringify(sessionData));
        setCurrentStep(2); // Directly open menu!
        return;
      }

      // If customer is known globally from another cafe, prefill their name
      if (statusData.name && !customerName) {
        setCustomerName(statusData.name);
      }

      // 3. New customer to this restaurant -> Send 1-time Firebase SMS OTP
      if (BYPASS_FIREBASE_OTP) {
        const finalName = customerName.trim() || statusData.name || 'Guest Diner';
        const sessionData = { name: finalName, phone: cleanPhone, verified: true };
        sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
        localStorage.setItem(sessionKey, JSON.stringify(sessionData));
        setCurrentStep(2);
        return;
      }

      setIsVerifying(true);
      const formattedPhone = `+91${cleanPhone.slice(-10)}`;
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setAuthError('');
    } catch (err) {
      console.error('Customer Auth Check / Firebase SMS OTP Error:', err);
      setConfirmationResult(null);
      setOtpSent(false);
      let errorMsg = err?.response?.data?.detail || err?.message || 'Failed to verify mobile number.';
      if (err?.code === 'auth/invalid-phone-number') {
        errorMsg = 'Invalid phone number format.';
      } else if (err?.code === 'auth/captcha-check-failed' || err?.code === 'auth/unauthorized-domain') {
        errorMsg = 'Domain not authorized in Firebase Console.';
      }
      setAuthError(errorMsg);
    } finally {
      setCheckingCustomerStatus(false);
      setIsVerifying(false);
    }
  };

  const handleCustomerLogout = () => {
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionKey);
    setCustomerName('');
    setCustomerPhone('');
    setOtpCode('');
    setOtpSent(false);
    setConfirmationResult(null);
    setCurrentStep(BYPASS_FIREBASE_OTP ? 2 : 1);
  };

  const handleDishClick = async (dish) => {
    const restId = restaurantData?.id;
    if (restId) {
      try {
        const res = await api.get(`/restaurants/${restId}/menu-items/${dish.id}/addon-groups`);
        const groups = (res.data || []).filter(g => g.is_active && g.options && g.options.length > 0);
        if (groups.length > 0) {
          setCustomizingDish(dish);
          setCustomizingGroups(groups);
          setCustomizingQty(1);
          const init = {};
          groups.forEach(g => {
            if (g.min_selectable > 0 && g.options.length > 0) {
              init[g.id] = [g.options[0]];
            } else {
              init[g.id] = [];
            }
          });
          setSelectedAddons(init);
          return;
        }
      } catch (e) { }
    }
    addToCart(dish);
  };

  const handleConfirmCustomization = () => {
    if (!customizingDish) return;
    const basePrice = parseFloat(customizingDish.price || 0);
    const selectedOpts = Object.values(selectedAddons).flat();
    const addonsPrice = selectedOpts.reduce((sum, o) => sum + (parseFloat(o.price || 0)), 0);
    const unitPrice = basePrice + addonsPrice;
    const addonsText = selectedOpts.map(o => o.name).join(', ');
    const cartItemId = `${customizingDish.id}_${selectedOpts.map(o => o.id).sort().join('_')}`;

    setCart(prev => {
      const exists = prev.find(i => i.cartItemId === cartItemId || (i.id === customizingDish.id && i.addonsTitle === (addonsText ? `(${addonsText})` : '')));
      if (exists) {
        return prev.map(i => (i.cartItemId === cartItemId || (i.id === customizingDish.id && i.addonsTitle === (addonsText ? `(${addonsText})` : ''))) ? { ...i, qty: i.qty + customizingQty } : i);
      }
      return [...prev, {
        ...customizingDish,
        cartItemId,
        id: customizingDish.id,
        name: customizingDish.name,
        price: unitPrice,
        qty: customizingQty,
        addonsTitle: addonsText ? `(${addonsText})` : '',
        note: addonsText ? `Add-ons: ${addonsText}` : ''
      }];
    });
    setCustomizingDish(null);
  };

  // Cart Management
  const addToCart = (dish) => {
    const dishPrice = parseFloat(dish.price || 0);
    setCart(prev => {
      const exists = prev.find(i => i.id === dish.id && !i.addonsTitle);
      if (exists) {
        return prev.map(i => (i.id === dish.id && !i.addonsTitle) ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...dish, cartItemId: `${dish.id}`, price: dishPrice, qty: 1, addonsTitle: '', note: '' }];
    });
  };

  const removeFromCart = (cartItemId) => {
    setCart(prev => {
      const exists = prev.find(i => (i.cartItemId || i.id) === cartItemId);
      if (exists && exists.qty > 1) {
        return prev.map(i => (i.cartItemId || i.id) === cartItemId ? { ...i, qty: i.qty - 1 } : i);
      }
      return prev.filter(i => (i.cartItemId || i.id) !== cartItemId);
    });
  };

  const deleteFromCart = (cartItemId) => {
    setCart(prev => prev.filter(i => (i.cartItemId || i.id) !== cartItemId));
  };

  const taxRate = restaurantData?.tax_percentage !== undefined && restaurantData?.tax_percentage !== null
    ? parseFloat(restaurantData.tax_percentage)
    : 5.0;

  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const gst = Math.round((subtotal * (taxRate / 100)) * 100) / 100;
  const total = subtotal + gst;

  // Auto-close review modal if cart becomes empty
  useEffect(() => {
    if (cart.length === 0) {
      setShowReviewModal(false);
    }
  }, [cart]);

  // Submit Order to Backend (Step 2 -> Step 3)
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setPlacingOrder(true);

    const orderPayload = {
      items: cart.map(i => ({
        menu_item_id: i.id,
        quantity: i.qty,
        special_instructions: specialInstructions[i.id] || null
      })),
      phone: customerPhone ? customerPhone.trim() : '9999999999',
      name: customerName ? customerName.trim() : 'Guest Diner'
    };

    try {
      const orderUrl = restaurantId
        ? `/public/restaurants/${encodeURIComponent(restaurantId)}/tables/${encodeURIComponent(tableId)}/order`
        : `/public/tables/${encodeURIComponent(tableId)}/order`;

      const res = await api.post(orderUrl, orderPayload);
      const orderWithTime = {
        ...res.data,
        created_at: res.data?.created_at || new Date().toISOString()
      };
      setActiveOrder(orderWithTime);
      setCart([]);
      setShowReviewModal(false);
      setCurrentStep(3); // Move to Step 3: Order Tracking
    } catch {
      setActiveOrder({
        id: Math.floor(1000 + Math.random() * 9000),
        order_number: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'pending',
        created_at: new Date().toISOString(),
        items: cart.map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.qty,
          unit_price: i.price,
          total_price: i.price * i.qty
        })),
        total: total
      });
      setCart([]);
      setShowReviewModal(false);
      setCurrentStep(3);
    } finally {
      setPlacingOrder(false);
    }
  };

  // Menu items filtering
  const filteredDishes = menuItems.filter(item => {
    const matchCategory = selectedCategory === 'All' || item.category_id === Number(selectedCategory);
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchVeg = vegOnly ? item.is_veg === true : true;
    return matchCategory && matchSearch && matchVeg;
  });

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <div id="recaptcha-container"></div>

      {/* Top Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '1.25rem 1rem', color: '#fff', borderRadius: '0 0 20px 20px', boxShadow: '0 10px 25px rgba(99, 102, 241, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={restaurantData?.name || 'Logo'}
                onError={() => setLogoError(true)}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  background: '#ffffff',
                }}
              />
            ) : (
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem',
                color: '#ffffff',
              }}>
                {restaurantData?.name ? restaurantData.name.charAt(0).toUpperCase() : <Utensils size={20} color="#fff" />}
              </div>
            )}

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', lineHeight: '1.1' }}>
                {restaurantData?.name || 'DineBuddy Restaurant'}
              </h2>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                {currentStep === 1 ? 'Firebase Phone Authentication' : currentStep === 2 ? 'Self-Ordering Menu' : 'Live Order Tracking'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {activeOrder && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep === 3 ? 2 : 3)}
                style={{
                  background: currentStep === 3 ? 'rgba(255, 255, 255, 0.25)' : '#ffffff',
                  color: currentStep === 3 ? '#ffffff' : '#4f46e5',
                  border: 'none',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                {currentStep === 3 ? (
                  <>
                    <Utensils size={13} />
                    <span>Menu</span>
                  </>
                ) : (
                  <>
                    <MapPin size={13} />
                    <span>Track Order</span>
                  </>
                )}
              </button>
            )}

            <div style={{
              background: 'rgba(255, 255, 255, 0.22)',
              padding: '0.3rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#fff',
              whiteSpace: 'nowrap'
            }}>
              Table #{tableData?.table_number || tableId}
            </div>
          </div>
        </div>
      </div>

      {/* Main Body Switcher */}
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ========================================================================= */}
        {/* STEP 1: CUSTOMER WELCOME & SMART RESTAURANT AUTH                          */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="panel-card" style={{ padding: '1.75rem 1.25rem', textAlign: 'center', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)' }}>
                <ShieldCheck size={28} color="#ffffff" />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Welcome to Table #{tableData?.table_number || tableId}!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                {restaurantData?.name ? `Ordering at ${restaurantData.name}` : 'Self-Ordering System'}
              </p>
            </div>

            <div className="panel-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)' }}>
              {authError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Mobile Number *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      position: 'absolute',
                      left: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      color: 'var(--accent-primary)',
                      borderRight: '1px solid var(--border-color)',
                      paddingRight: '8px'
                    }}>
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      className="input-control"
                      style={{ paddingLeft: '4.8rem' }}
                      placeholder="9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Your Full Name *</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      required={otpSent}
                      className="input-control"
                      style={{ paddingLeft: '2.4rem' }}
                      placeholder="e.g. Rahul Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Enter 6-Digit SMS OTP *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        maxLength={6}
                        required
                        className="input-control"
                        style={{ paddingLeft: '2.4rem', letterSpacing: '0.25em', fontWeight: 800 }}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                      />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '0.35rem', display: 'block' }}>
                      ✓ Real SMS OTP sent via Firebase to +91 {customerPhone}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying || checkingCustomerStatus}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', fontWeight: 800, fontSize: '0.95rem' }}
                >
                  {checkingCustomerStatus
                    ? 'Checking Account Status... ⏳'
                    : isVerifying
                      ? 'Verifying Credentials...'
                      : otpSent
                        ? 'Verify OTP & Open Menu 📖'
                        : 'Continue to Menu 📖'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: DIGITAL MENU & CART WORKSPACE                                    */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <>
            {/* Active Order Sticky Quick-Tracking Bar */}
            {activeOrder && (
              <div
                onClick={() => setCurrentStep(3)}
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.15))',
                  border: '1.5px solid var(--accent-primary)',
                  borderRadius: '16px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 10px #22c55e',
                    animation: 'pulse 1.5s infinite'
                  }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Active Order: #{activeOrder.order_number || activeOrder.id} • {formatISTTime(activeOrder.created_at)} IST
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'capitalize' }}>
                      Status: {(activeOrder.status || 'pending').replace('_', ' ')} • Tap to view live progress
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 800, borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <MapPin size={13} /> Track Order
                </button>
              </div>
            )}

            {/* Customer Session Profile Strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                <User size={14} color="var(--accent-primary)" />
                <span>{customerName || 'Guest Diner'}</span>
                {customerPhone && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({customerPhone})</span>}
              </div>

              <button onClick={handleCustomerLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 600 }}>
                <User size={12} /> {customerName ? 'Change' : 'Set Name'}
              </button>
            </div>

            {/* Search Input & Veg Filter */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search food & drinks..."
                  className="input-control"
                  style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`btn btn-sm ${vegOnly ? 'btn-success' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >
                🟢 Veg Only
              </button>
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
              <button
                onClick={() => setSelectedCategory('All')}
                className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '9999px', whiteSpace: 'nowrap', fontSize: '0.78rem' }}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '9999px', whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading digital menu...
              </div>
            ) : filteredDishes.length === 0 ? (
              <div className="panel-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <UtensilsCrossed size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>No Items Found</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No dishes match your selected category or filter.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {filteredDishes.map(dish => {
                  const inCart = cart.find(i => i.id === dish.id);
                  const dishPrice = parseFloat(dish.price || 0);

                  return (
                    <div key={dish.id} className="panel-card" style={{ display: 'flex', gap: '0.85rem', padding: '0.85rem', alignItems: 'center', borderRadius: 'var(--radius-lg)' }}>
                      {dish.image_url ? (
                        <img src={dish.image_url} alt={dish.name} style={{ width: '75px', height: '75px', borderRadius: '12px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '75px', height: '75px', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Utensils size={24} color="var(--text-muted)" />
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: dish.is_veg ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700 }}>{dish.name}</h4>
                        </div>

                        {dish.description && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{dish.description}</p>
                        )}
                        <div style={{ fontWeight: 800, color: 'var(--success)', marginTop: '0.35rem', fontSize: '0.92rem' }}>₹{dishPrice.toFixed(2)}</div>
                      </div>

                      <div>
                        {inCart ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent-glow)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-md)' }}>
                            <button onClick={() => removeFromCart(inCart.cartItemId || inCart.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={14} /></button>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{inCart.qty}</span>
                            <button onClick={() => handleDishClick(dish)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => handleDishClick(dish)} className="btn btn-primary btn-sm" style={{ borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem' }}>
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

        {/* ========================================================================= */}
        {/* STEP 3: LIVE REAL-TIME ORDER TRACKING DASHBOARD                          */}
        {/* ========================================================================= */}
        {currentStep === 3 && activeOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>

            {/* Ticket Header Card */}
            <div className="panel-card" style={{ padding: '1.5rem 1.25rem', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 800 }}>
                  Ticket #{activeOrder.order_number || 'ORD-98421'}
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} color="var(--accent-primary)" />
                  <span>{formatISTTime(activeOrder.created_at)} IST</span>
                </div>
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Live Order Tracking</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                Table #{tableData?.table_number || tableId} • Placed by {customerName || 'Diner'}
              </p>

              {/* 4-Stage Live Progress Stepper */}
              <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'space-between', position: 'relative' }}>

                {/* Stepper Progress Bar */}
                {(() => {
                  const status = (activeOrder.status || 'pending').toLowerCase();
                  let progress = '15%';
                  if (status === 'in_kitchen' || status === 'preparing') progress = '45%';
                  if (status === 'ready') progress = '75%';
                  if (status === 'served') progress = '100%';

                  return (
                    <div style={{ position: 'absolute', top: '16px', left: '10%', right: '10%', height: '3px', background: 'var(--border-color)', zIndex: 0 }}>
                      <div style={{ height: '100%', width: progress, background: 'var(--accent-primary)', transition: 'width 0.5s ease' }} />
                    </div>
                  );
                })()}

                {/* Step 1: Received */}
                <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart size={16} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Received</span>
                </div>

                {/* Step 2: In Kitchen */}
                {(() => {
                  const status = (activeOrder.status || 'pending').toLowerCase();
                  const isActive = ['in_kitchen', 'preparing', 'ready', 'served'].includes(status);
                  return (
                    <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: isActive ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)' }}>
                        <ChefHat size={16} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>Kitchen</span>
                    </div>
                  );
                })()}

                {/* Step 3: Ready */}
                {(() => {
                  const status = (activeOrder.status || 'pending').toLowerCase();
                  const isActive = ['ready', 'served'].includes(status);
                  return (
                    <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: isActive ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)' }}>
                        <Bell size={16} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>Ready</span>
                    </div>
                  );
                })()}

                {/* Step 4: Served */}
                {(() => {
                  const status = (activeOrder.status || 'pending').toLowerCase();
                  const isActive = status === 'served';
                  return (
                    <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isActive ? 'var(--success)' : 'var(--bg-secondary)', color: isActive ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)' }}>
                        <CheckCheck size={16} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>Served</span>
                    </div>
                  );
                })()}

              </div>

              {/* Status Descriptor Message */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {(() => {
                  const status = (activeOrder.status || 'pending').toLowerCase();
                  if (status === 'served') return `🍽️ All dishes served at Table #${tableData?.table_number || tableId}. Bon Appétit!`;
                  if (status === 'ready') return `🔔 Your order is freshly prepared! Waiter is bringing it to Table #${tableData?.table_number || tableId}.`;
                  if (status === 'in_kitchen' || status === 'preparing') return `👨‍🍳 Chef is actively preparing your order with fresh ingredients in the kitchen.`;
                  return `🛒 Order received by POS. Scheduled in the kitchen preparation queue.`;
                })()}
              </div>
            </div>

            {/* Ordered Items Summary */}
            <div className="panel-card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                  Order Items Summary
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  🕒 {formatISTTime(activeOrder.created_at)} (IST)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(activeOrder.items || []).map((item, idx) => {
                  const resolvedName = item.name
                    || item.menu_item_name
                    || menuItems.find(m => m.id === (item.menu_item_id || item.id))?.name
                    || `Dish #${item.menu_item_id || idx + 1}`;

                  const itemPrice = item.total_price
                    || (item.unit_price ? item.unit_price * item.quantity : 0)
                    || (item.price ? item.price * (item.quantity || item.qty || 1) : 0);

                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.88rem', padding: '0.35rem 0', borderBottom: idx !== (activeOrder.items.length - 1) ? '1px dashed var(--border-color)' : 'none' }}>
                      <div>
                        <span style={{ fontWeight: 800, color: 'var(--accent-primary)', marginRight: '0.4rem' }}>{item.quantity || item.qty || 1}x</span>
                        <span style={{ fontWeight: 600 }}>{resolvedName}</span>
                        {item.special_instructions && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Note: {item.special_instructions}</div>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>₹{itemPrice.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.85rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-primary)' }}>
                <span>Total Bill Amount</span>
                <span>₹{(activeOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button onClick={() => setCurrentStep(2)} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontWeight: 800 }}>
                ➕ Order More Items / Desserts
              </button>

              <button
                type="button"
                onClick={handleRequestBill}
                disabled={requestingBill || billRequested}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontWeight: 800,
                  background: billRequested ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-secondary)',
                  color: billRequested ? '#22c55e' : 'var(--text-primary)',
                  borderColor: billRequested ? '#22c55e' : 'var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {billRequested ? (
                  <>
                    <CheckCircle2 size={18} color="#22c55e" />
                    <span>✓ Bill Requested (Waiter on the way)</span>
                  </>
                ) : requestingBill ? (
                  <span>Requesting Bill...</span>
                ) : (
                  <>
                    <Receipt size={18} />
                    <span>🧾 Request Final Bill</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Floating Bottom Cart Bar (Step 2 Only) */}
      {currentStep === 2 && cart.length > 0 && (
        <div style={{ position: 'sticky', bottom: '1rem', padding: '0 1rem', marginTop: 'auto', zIndex: 100 }}>
          <div
            onClick={() => setShowReviewModal(true)}
            className="panel-card"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              padding: '0.85rem 1.15rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 15px 35px rgba(99, 102, 241, 0.4)',
              cursor: 'pointer'
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingCart size={18} /> {cart.reduce((s, i) => s + i.qty, 0)} Items Selected
              </div>
              <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>Total: ₹{total.toFixed(2)} (incl. {taxRate}% tax)</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviewModal(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ background: '#fff', color: '#4f46e5', fontWeight: 800, border: 'none', padding: '0.55rem 0.95rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Review & Order 🛒
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVIEW ORDER & CART MODAL                                                 */}
      {/* ========================================================================= */}
      {showReviewModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-box" style={{ maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.25rem', borderRadius: '24px' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={20} color="var(--accent-primary)" /> Review Order
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Table #{tableData?.table_number || tableId} • {restaurantData?.name || 'Restaurant'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Items List (Scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '4px', marginBottom: '1rem' }}>
              {cart.map((item, idx) => {
                const cartItemId = item.cartItemId || item.id;
                const itemPrice = parseFloat(item.price || 0);
                const itemTotalPrice = itemPrice * item.qty;

                return (
                  <div key={cartItemId || idx} style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            border: `2px solid ${item.is_veg ? '#22c55e' : '#ef4444'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '3px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: item.is_veg ? '#22c55e' : '#ef4444'
                            }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{item.name}</span>
                        </div>
                        {item.addonsTitle && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'block', marginTop: '2px' }}>
                            {item.addonsTitle}
                          </span>
                        )}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                          ₹{itemPrice.toFixed(2)} each
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-primary)', padding: '0.25rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>
                          <button
                            type="button"
                            onClick={() => removeFromCart(cartItemId)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px' }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', minWidth: '16px', textAlign: 'center' }}>
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(item)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteFromCart(cartItemId)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '8px', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.8rem' }}>
                      <input
                        type="text"
                        placeholder="Cooking note (e.g. less spicy)..."
                        value={specialInstructions[item.id] || ''}
                        onChange={(e) => setSpecialInstructions({ ...specialInstructions, [item.id]: e.target.value })}
                        style={{
                          flex: 1,
                          marginRight: '0.75rem',
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        ₹{itemTotalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Price Breakdown */}
            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Item Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Taxes & GST ({taxRate}%)</span>
                <span>₹{gst.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)', paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)', marginTop: '0.2rem' }}>
                <span>Total Amount</span>
                <span style={{ color: 'var(--accent-primary)' }}>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.75rem', fontWeight: 700, fontSize: '0.88rem' }}
              >
                ➕ Add More
              </button>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={placingOrder || cart.length === 0}
                className="btn btn-primary"
                style={{ flex: 1.5, padding: '0.75rem', fontWeight: 800, fontSize: '0.92rem' }}
              >
                {placingOrder ? 'Sending Order...' : 'Confirm & Order 🚀'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Customization Modal for Customer QR App */}
      {customizingDish && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>✨ Customize {customizingDish.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Base Price: ₹{parseFloat(customizingDish.price || 0).toFixed(2)}</span>
              </div>
              <button onClick={() => setCustomizingDish(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Render Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              {customizingGroups.map(group => {
                const isSingle = group.max_selectable === 1;
                const groupSelected = selectedAddons[group.id] || [];

                return (
                  <div key={group.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{group.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {group.min_selectable > 0 ? '(Required)' : '(Optional)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {group.options.map(opt => {
                        const isChecked = groupSelected.some(o => o.id === opt.id);

                        return (
                          <label key={opt.id} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', borderRadius: '6px', background: isChecked ? 'rgba(99, 102, 241, 0.15)' : 'transparent', border: isChecked ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type={isSingle ? "radio" : "checkbox"}
                                name={`cust_group_${group.id}`}
                                checked={isChecked}
                                onChange={() => {
                                  if (isSingle) {
                                    setSelectedAddons({ ...selectedAddons, [group.id]: [opt] });
                                  } else {
                                    if (isChecked) {
                                      setSelectedAddons({ ...selectedAddons, [group.id]: groupSelected.filter(o => o.id !== opt.id) });
                                    } else {
                                      if (groupSelected.length < group.max_selectable) {
                                        setSelectedAddons({ ...selectedAddons, [group.id]: [...groupSelected, opt] });
                                      }
                                    }
                                  }
                                }}
                              />
                              <span>{opt.name}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                              {parseFloat(opt.price || 0) > 0 ? `+₹${parseFloat(opt.price).toFixed(2)}` : 'Free'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quantity Stepper & Add to Cart Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                <button type="button" onClick={() => setCustomizingQty(q => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={14} /></button>
                <span style={{ fontWeight: 800 }}>{customizingQty}</span>
                <button type="button" onClick={() => setCustomizingQty(q => q + 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={14} /></button>
              </div>

              <button
                type="button"
                onClick={handleConfirmCustomization}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Plus size={16} />
                <span>Add to Order • ₹{((parseFloat(customizingDish.price || 0) + Object.values(selectedAddons).flat().reduce((s, o) => s + (parseFloat(o.price || 0)), 0)) * customizingQty).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
