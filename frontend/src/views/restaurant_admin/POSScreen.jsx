import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { printKOT, printBill } from '../../services/printService';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Receipt,
  ImageIcon,
  Printer,
  X,
  Tag,
  UtensilsCrossed
} from 'lucide-react';

export const POSScreen = () => {
  const { selectedRestaurant, addToast } = useAuth();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [discountType, setDiscountType] = useState('FLAT'); // 'FLAT' (₹) or 'PERCENT' (%)
  const [discountValue, setDiscountValue] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [cart, setCart] = useState([]);
  const [kotSent, setKotSent] = useState(false);
  const [restaurantTaxRate, setRestaurantTaxRate] = useState(5);

  // Customization Popup state
  const [customizingDish, setCustomizingDish] = useState(null);
  const [customizingGroups, setCustomizingGroups] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});
  const [customizingQty, setCustomizingQty] = useState(1);

  // Fetch real categories, menu items, and tax settings from backend
  useEffect(() => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const restId = selectedRestaurant.id;

    // Load local cache immediately for instant tax update
    const savedLocalTax = localStorage.getItem(`dinebuddy_tax_rate_${restId}`);
    if (savedLocalTax !== null && savedLocalTax !== undefined) {
      setRestaurantTaxRate(parseFloat(savedLocalTax));
    }

    Promise.all([
      api.get(`/restaurants/${restId}/menu-categories/`).catch(() => ({ data: [] })),
      api.get(`/restaurants/${restId}/menu-items/`).catch(() => ({ data: [] })),
      api.get(`/restaurants/${restId}/settings`).catch(() => ({ data: {} })),
    ]).then(([catRes, itemsRes, settingsRes]) => {
      const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      const itemList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];

      if (settingsRes.data && settingsRes.data.tax_percentage !== undefined && settingsRes.data.tax_percentage !== null) {
        const fetchedTax = parseFloat(settingsRes.data.tax_percentage);
        setRestaurantTaxRate(fetchedTax);
        localStorage.setItem(`dinebuddy_tax_rate_${restId}`, String(fetchedTax));
      }

      setCategories(catList);
      setMenuItems(itemList);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRestaurant]);

  // Handle dish click to check if it has add-ons or customization
  const handleItemClick = async (dish) => {
    if (!selectedRestaurant || !dish) return;
    const restId = selectedRestaurant.id;
    try {
      // Check if dish has attached add-on groups
      const res = await api.get(`/restaurants/${restId}/menu-items/${dish.id}/addon-groups`);
      const rawGroups = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const groups = rawGroups.filter(g => g && g.is_active && Array.isArray(g.options) && g.options.length > 0);

      if (groups.length > 0) {
        // Open Customization Popup
        setCustomizingDish(dish);
        setCustomizingGroups(groups);
        setCustomizingQty(1);

        // Pre-select default options if min_selectable > 0
        const init = {};
        groups.forEach(g => {
          if (g.min_selectable > 0 && Array.isArray(g.options) && g.options.length > 0) {
            init[g.id] = [g.options[0]];
          } else {
            init[g.id] = [];
          }
        });
        setSelectedAddons(init);
      } else {
        // Simple item without add-ons -> add directly to cart
        addToCartSimple(dish);
      }
    } catch (err) {
      console.error("Error fetching add-ons for POS dish:", err);
      addToCartSimple(dish);
    }
  };

  // Add customized item with selected options to cart
  const handleAddCustomizedToCart = () => {
    if (!customizingDish) return;
    setKotSent(false);

    const basePrice = parseFloat(customizingDish.price || 0);
    const selectedOpts = Object.values(selectedAddons || {}).flat().filter(Boolean);
    const addonsPrice = selectedOpts.reduce((sum, o) => sum + (parseFloat(o?.price || 0)), 0);
    const unitPrice = basePrice + addonsPrice;
    
    // Format add-ons title with individual prices
    const addonsDetails = selectedOpts.map(o => {
      const p = parseFloat(o?.price || 0);
      return p > 0 ? `${o?.name} (+₹${p.toFixed(2)})` : o?.name;
    }).filter(Boolean).join(', ');

    const cartItemId = `${customizingDish.id}-${selectedOpts.map(o => o?.id).sort().join('-')}`;

    setCart(prev => {
      const exists = prev.find(i => i.cartItemId === cartItemId || (i.id === customizingDish.id && i.addonsTitle === (addonsDetails ? `(${addonsDetails})` : '')));
      if (exists) {
        return prev.map(i => (i.cartItemId === cartItemId || (i.id === customizingDish.id && i.addonsTitle === (addonsDetails ? `(${addonsDetails})` : ''))) ? { ...i, qty: i.qty + (customizingQty || 1) } : i);
      }
      return [...prev, {
        cartItemId,
        id: customizingDish.id,
        name: customizingDish.name,
        basePrice,
        addonsPrice,
        price: unitPrice,
        qty: customizingQty || 1,
        addonsTitle: addonsDetails ? `(${addonsDetails})` : '',
        note: addonsDetails ? `Add-ons: ${addonsDetails}` : '',
        selectedOpts: selectedOpts.map(o => ({ id: o.id, name: o.name, price: parseFloat(o.price || 0) }))
      }];
    });

    setCustomizingDish(null);
    setCustomizingGroups([]);
    setSelectedAddons({});
    setCustomizingQty(1);
  };

  // Add simple item (no add-ons) directly to cart
  const addToCartSimple = (dish) => {
    setKotSent(false);
    const itemPrice = parseFloat(dish.price || 0);
    const cartItemId = `${dish.id}`;

    setCart(prev => {
      const exists = prev.find(i => (i.cartItemId === cartItemId || i.id === dish.id) && !i.addonsTitle);
      if (exists) {
        return prev.map(i => ((i.cartItemId === cartItemId || i.id === dish.id) && !i.addonsTitle) ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        cartItemId,
        id: dish.id,
        name: dish.name,
        basePrice: itemPrice,
        addonsPrice: 0,
        price: itemPrice,
        qty: 1,
        addonsTitle: '',
        note: '',
        selectedOpts: []
      }];
    });
  };

  const updateQty = (cartItemId, delta) => {
    setKotSent(false);
    setCart(prev => prev.map(i => {
      const targetId = i.cartItemId || i.id;
      if (targetId === cartItemId) {
        const nextQty = i.qty + delta;
        return nextQty > 0 ? { ...i, qty: nextQty } : null;
      }
      return i;
    }).filter(Boolean));
  };

  const removeFromCart = (cartItemId) => {
    setKotSent(false);
    setCart(prev => prev.filter(i => (i.cartItemId || i.id) !== cartItemId));
  };

  // Subtotal & Financial Calculations
  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const taxRate = restaurantTaxRate !== null && restaurantTaxRate !== undefined ? restaurantTaxRate : 5;
  
  // Calculate discount based on Type (Percentage or Flat Amount)
  const numericDiscountVal = parseFloat(discountValue) || 0;
  const discountAmount = discountType === 'PERCENT'
    ? Math.round((subtotal * (Math.min(100, Math.max(0, numericDiscountVal)) / 100)) * 100) / 100
    : Math.min(subtotal, Math.max(0, numericDiscountVal));

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const gst = discountedSubtotal * (taxRate / 100);
  const rawTotal = Math.max(0, discountedSubtotal + gst);
  const total = Math.round(rawTotal);
  const roundOff = Math.round((total - rawTotal) * 100) / 100;

  // Print KOT Slip for Kitchen
  const handleSendToKitchen = () => {
    if (cart.length === 0 || !selectedRestaurant) {
      addToast('warning', 'Cart is Empty', 'Please add dishes to cart before printing KOT.');
      return;
    }

    const orderData = {
      order_number: `KOT-${Date.now().toString().slice(-4)}`,
      table_number: 'Takeaway Counter',
      created_at: new Date().toISOString(),
      items: cart
    };
    printKOT(orderData, { ...selectedRestaurant, tax_rate: taxRate });
    setKotSent(true);
    addToast('info', 'KOT Printed!', 'Kitchen Order Ticket sent to printer.');
  };

  // Complete Payment & Print Customer Receipt
  const handlePayAndPrintBill = () => {
    if (cart.length === 0 || !selectedRestaurant) {
      addToast('warning', 'Cart is Empty', 'Please add dishes to cart before billing.');
      return;
    }

    const completedBillData = {
      order_number: `BILL-${Date.now().toString().slice(-4)}`,
      table_number: 'Takeaway Counter',
      created_at: new Date().toISOString(),
      items: cart,
      subtotal,
      gst,
      discount: discountAmount,
      round_off: roundOff,
      total,
      payment_method: paymentMethod,
      payment_status: 'PAID'
    };
    printBill(completedBillData, { ...selectedRestaurant, tax_rate: taxRate });

    addToast('success', 'Payment Received & Bill Printed!', `₹${total.toFixed(2)} collected via ${paymentMethod}.`);
    setCart([]);
    setDiscountValue(0);
    setDiscountType('FLAT');
    setKotSent(false);
  };

  const isDisableDefault = localStorage.getItem('dinebuddy_disable_default_menu_categories') === 'true';

  const visibleCategories = isDisableDefault
    ? categories.filter(c => !c.is_global && c.restaurant_id !== null)
    : categories;

  // Filter items by category & search term
  const filteredDishes = menuItems.filter(item => {
    const matchCategory = selectedCategory === 'All' || item.category_id === Number(selectedCategory);
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1rem', alignItems: 'start', width: '100%', maxWidth: '100%' }} className="pos-main-workspace">
      <style>{`
        .pos-items-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        @media (max-width: 1100px) { .pos-items-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        @media (max-width: 900px) { .pos-main-workspace { grid-template-columns: 1fr !important; } .pos-items-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } .pos-order-desk { position: static !important; width: 100% !important; } }
        @media (max-width: 640px) { .pos-items-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
      `}</style>

      {/* Left Column: Menu Item Browser */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
        <div className="panel-card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Search menu items..." className="input-control" style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', maxWidth: '100%' }}>
              <button onClick={() => setSelectedCategory('All')} className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: '9999px', fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}>All</button>
              {visibleCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '9999px', fontSize: '0.75rem', padding: '0.25rem 0.65rem', whiteSpace: 'nowrap' }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading menu items...
          </div>
        ) : filteredDishes.length === 0 ? (
          <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <UtensilsCrossed size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <div>No menu items found.</div>
          </div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto', paddingRight: '0.3rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' }} className="pos-items-grid">
              {filteredDishes.map(dish => {
                const itemPrice = parseFloat(dish.price) || 0;
                return (
                  <div key={dish.id} onClick={() => handleItemClick(dish)} className="panel-card" style={{ padding: '0.65rem', cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '75px', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      {dish.image_url ? <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} color="var(--text-muted)" />}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.8rem' }}>₹{itemPrice.toFixed(2)}</span>
                      <button className="btn btn-primary btn-sm" style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}><Plus size={11} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Order Desk */}
      <div className="panel-card pos-order-desk" style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', position: 'sticky', top: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.65rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}><Receipt size={16} color="var(--accent-primary)" /> Express POS</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Takeaway Counter</span>
          </div>
          <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}>Takeaway</span>
        </div>

        <div style={{ flex: 1, minHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.25rem', marginBottom: '0.5rem' }}>
          {cart.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Cart is empty</div>
          ) : (
            cart.map(item => {
              const itemKey = item.cartItemId || item.id;
              return (
                <div key={itemKey} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.name}</span>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>₹{(Number(item.price || 0) * Number(item.qty || 1)).toFixed(2)}</span>
                  </div>
                  {item.addonsTitle && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>{item.addonsTitle.replace(/^\(|\)$/g, '')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button onClick={() => updateQty(itemKey, -1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={12} /></button>
                      <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{item.qty}</span>
                      <button onClick={() => updateQty(itemKey, 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={12} /></button>
                    </div>
                    <button onClick={() => removeFromCart(itemKey)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.65rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Sub: <strong>₹{subtotal.toFixed(2)}</strong></span>
            <button type="button" onClick={() => setShowDiscountInput(prev => !prev)} style={{ background: discountValue > 0 ? 'rgba(99, 102, 241, 0.15)' : 'none', border: discountValue > 0 ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)', color: discountValue > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', borderRadius: '4px', padding: '1px 6px', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Tag size={11} /> {discountValue > 0 ? `${discountType === 'PERCENT' ? `${discountValue}%` : `₹${discountValue}`} OFF` : '+ Discount'}
            </button>
          </div>

          {showDiscountInput && (
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '1px' }}>
                <button type="button" onClick={() => setDiscountType('FLAT')} style={{ padding: '1px 6px', fontSize: '0.68rem', background: discountType === 'FLAT' ? 'var(--accent-primary)' : 'transparent', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>₹</button>
                <button type="button" onClick={() => setDiscountType('PERCENT')} style={{ padding: '1px 6px', fontSize: '0.68rem', background: discountType === 'PERCENT' ? 'var(--accent-primary)' : 'transparent', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>%</button>
              </div>
              <input type="number" min="0" max={discountType === 'PERCENT' ? 100 : subtotal} value={discountValue || ''} placeholder="0" onChange={(e) => { const val = parseFloat(e.target.value) || 0; setDiscountValue(val >= 0 ? val : 0); }} style={{ width: '65px', padding: '2px 6px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', textAlign: 'center' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>TOTAL DUE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1.1 }}>₹{total.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {['UPI', 'CARD', 'CASH', 'ONLINE'].map(method => (
                <button key={method} type="button" onClick={() => setPaymentMethod(method)} style={{ fontSize: '0.72rem', fontWeight: paymentMethod === method ? 800 : 500, padding: '0.25rem 0.45rem', borderRadius: '4px', border: paymentMethod === method ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)', background: paymentMethod === method ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>{method}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            <button onClick={handleSendToKitchen} disabled={cart.length === 0} className={`btn ${kotSent ? 'btn-secondary' : 'btn-primary'}`} style={{ padding: '0.65rem', fontWeight: 800, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', border: kotSent ? '1px solid var(--success)' : 'none', color: kotSent ? 'var(--success)' : '#fff' }} title="Print KOT Slip for Kitchen">
              <Printer size={15} /> {kotSent ? 'KOT Sent' : '1. Send KOT'}
            </button>
            <button onClick={handlePayAndPrintBill} disabled={cart.length === 0} className="btn btn-success" style={{ padding: '0.65rem', fontWeight: 800, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }} title="Complete Payment & Print Customer Bill">
              <CheckCircle size={15} /> 2. Pay & Bill
            </button>
          </div>
        </div>
      </div>

      {/* Customization Modal */}
      {customizingDish && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Customize {customizingDish.name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base Price: ₹{parseFloat(customizingDish.price || 0).toFixed(2)}</span>
              </div>
              <button onClick={() => setCustomizingDish(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.2rem' }}>
              {customizingGroups.map(group => {
                const isSingle = group.max_selectable === 1;
                const currentSelections = selectedAddons[group.id] || [];
                const toggleOption = (opt) => {
                  if (isSingle) {
                    setSelectedAddons(prev => ({ ...prev, [group.id]: [opt] }));
                  } else {
                    const exists = currentSelections.some(o => o.id === opt.id);
                    if (exists) {
                      setSelectedAddons(prev => ({ ...prev, [group.id]: currentSelections.filter(o => o.id !== opt.id) }));
                    } else if (currentSelections.length < (group.max_selectable || 99)) {
                      setSelectedAddons(prev => ({ ...prev, [group.id]: [...currentSelections, opt] }));
                    }
                  }
                };
                return (
                  <div key={group.id} style={{ background: 'var(--bg-secondary)', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{group.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isSingle ? 'Choose 1' : `Up to ${group.max_selectable}`}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {group.options.map(opt => {
                        const isSelected = currentSelections.some(o => o.id === opt.id);
                        const optPrice = parseFloat(opt.price || 0);
                        return (
                          <div key={opt.id} onClick={() => toggleOption(opt)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)', border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: isSelected ? 700 : 500 }}>{opt.name}</span>
                            <span style={{ fontWeight: 700, color: optPrice > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{optPrice > 0 ? `+₹${optPrice.toFixed(2)}` : 'Free'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setCustomizingQty(q => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={14} /></button>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{customizingQty}</span>
                <button onClick={() => setCustomizingQty(q => q + 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={14} /></button>
              </div>
              <button onClick={handleAddCustomizedToCart} className="btn btn-primary">
                Add to Cart • ₹{((parseFloat(customizingDish.price || 0) + Object.values(selectedAddons).flat().reduce((s, o) => s + parseFloat(o?.price || 0), 0)) * customizingQty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSScreen;
