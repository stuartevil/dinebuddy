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
  UtensilsCrossed,
  Receipt,
  ImageIcon,
  Printer,
  X,
  Tag
} from 'lucide-react';

export const POSScreen = () => {
  const { selectedRestaurant, addToast } = useAuth();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState('Takeaway');
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

  // Fetch real categories, menu items, tables, and tax settings from backend
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
      api.get(`/tables/restaurant/${restId}`).catch(() => ({ data: [] })),
      api.get(`/restaurants/${restId}/settings`).catch(() => ({ data: {} })),
    ]).then(([catRes, itemsRes, tablesRes, settingsRes]) => {
      const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      const itemList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      const tableList = Array.isArray(tablesRes.data) ? tablesRes.data : tablesRes.data?.data || [];

      if (settingsRes.data && settingsRes.data.tax_percentage !== undefined && settingsRes.data.tax_percentage !== null) {
        const fetchedTax = parseFloat(settingsRes.data.tax_percentage);
        setRestaurantTaxRate(fetchedTax);
        localStorage.setItem(`dinebuddy_tax_rate_${restId}`, String(fetchedTax));
      }

      setCategories(catList);
      setMenuItems(itemList);
      setTables(tableList);

      if (tableList.length > 0) {
        setSelectedTable(String(tableList[0].id));
      }
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRestaurant]);

  // Handle dish click to check if it has add-ons or customization
  const handleItemClick = async (dish) => {
    if (!selectedRestaurant) return;
    const restId = selectedRestaurant.id;
    try {
      // Check if dish has attached add-on groups (including category inherited groups)
      const res = await api.get(`/restaurants/${restId}/menu-items/${dish.id}/addon-groups`);
      const groups = Array.isArray(res.data) ? res.data : [];

      if (groups.length > 0) {
        // Open Customization Popup
        setCustomizingDish(dish);
        setCustomizingGroups(groups);
        setCustomizingQty(1);

        // Pre-select default options if min_selectable > 0
        const init = {};
        groups.forEach(g => {
          if (g.min_selectable > 0 && g.options && g.options.length > 0) {
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
      addToCartSimple(dish);
    }
  };

  // Add customized item with selected options to cart
  const handleAddCustomizedToCart = () => {
    if (!customizingDish) return;
    setKotSent(false);

    const basePrice = parseFloat(customizingDish.price || 0);
    const selectedOpts = Object.values(selectedAddons).flat();
    const addonsPrice = selectedOpts.reduce((sum, o) => sum + (parseFloat(o.price || 0)), 0);
    const unitPrice = basePrice + addonsPrice;
    const addonsText = selectedOpts.map(o => o.name).join(', ');
    const cartItemId = `${customizingDish.id}-${selectedOpts.map(o => o.id).sort().join('-')}`;

    setCart(prev => {
      const exists = prev.find(i => i.cartItemId === cartItemId || (i.id === customizingDish.id && i.addonsTitle === (addonsText ? `(${addonsText})` : '')));
      if (exists) {
        return prev.map(i => (i.cartItemId === cartItemId || (i.id === customizingDish.id && i.addonsTitle === (addonsText ? `(${addonsText})` : ''))) ? { ...i, qty: i.qty + customizingQty } : i);
      }
      return [...prev, {
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
    setCustomizingGroups([]);
    setSelectedAddons({});
    setCustomizingQty(1);
  };

  const addToCartSimple = (item) => {
    setKotSent(false);
    const itemPrice = parseFloat(item.price || 0);
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id && !i.addonsTitle);
      if (exists) {
        return prev.map(i => (i.id === item.id && !i.addonsTitle) ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { cartItemId: `${item.id}`, id: item.id, name: item.name, price: itemPrice, qty: 1, addonsTitle: '', note: '' }];
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

  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const taxRate = restaurantTaxRate !== null && restaurantTaxRate !== undefined ? restaurantTaxRate : 5;
  
  // Calculate discount based on Type (Percentage or Flat Amount)
  const numericDiscountVal = parseFloat(discountValue) || 0;
  const discountAmount = discountType === 'PERCENT'
    ? Math.round((subtotal * (Math.min(100, Math.max(0, numericDiscountVal)) / 100)) * 100) / 100
    : Math.min(subtotal, Math.max(0, numericDiscountVal));

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const gst = discountedSubtotal * (taxRate / 100);
  const total = Math.max(0, discountedSubtotal + gst);

  const handlePrintCartKOT = () => {
    if (cart.length === 0) return;
    const orderData = {
      order_number: `KOT-${Date.now().toString().slice(-4)}`,
      table_number: selectedTable,
      created_at: new Date().toISOString(),
      items: cart
    };
    printKOT(orderData, { ...selectedRestaurant, tax_rate: taxRate });
  };

  const handlePrintCartBill = () => {
    if (cart.length === 0) return;
    const billData = {
      order_number: `BILL-${Date.now().toString().slice(-4)}`,
      table_number: selectedTable,
      created_at: new Date().toISOString(),
      items: cart,
      subtotal,
      gst,
      discount: discountAmount,
      total,
      payment_method: paymentMethod,
      payment_status: 'PAID'
    };
    printBill(billData, { ...selectedRestaurant, tax_rate: taxRate });
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0 || !selectedRestaurant) return;

    try {
      let targetTableId = null;

      if (selectedTable !== 'Takeaway') {
        const matched = tables.find(t => String(t.id) === String(selectedTable) || t.table_number === selectedTable);
        if (matched) targetTableId = matched.id;
      }

      if (!targetTableId && tables.length > 0) {
        targetTableId = tables[0].id;
      }

      if (!targetTableId) {
        const newTableRes = await api.post('/tables/', {
          restaurant_id: selectedRestaurant.id,
          table_number: 'Takeaway Counter',
          capacity: 10
        });
        targetTableId = newTableRes.data.id;
        setTables([newTableRes.data]);
      }

      const orderPayload = {
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.qty,
          special_instructions: item.note || null
        }))
      };

      await api.post(`/tables/${targetTableId}/orders`, orderPayload);

      // Print KOT
      const orderData = {
        order_number: `KOT-${Date.now().toString().slice(-4)}`,
        table_number: selectedTable,
        created_at: new Date().toISOString(),
        items: cart
      };
      printKOT(orderData, { ...selectedRestaurant, tax_rate: taxRate });

      setKotSent(true);
      addToast('info', '🔥 KOT Printed & Sent to Kitchen!', 'Kitchen is preparing food. Click "Pay & Print Bill" when customer pays.');
    } catch (err) {
      console.error("Send KOT error:", err);
      handlePrintCartKOT();
      setKotSent(true);
      addToast('info', 'KOT Printed!', 'Printed KOT for Kitchen.');
    }
  };

  const handlePayAndPrintBill = async () => {
    if (cart.length === 0 || !selectedRestaurant) return;

    try {
      let targetTableId = null;

      if (selectedTable !== 'Takeaway') {
        const matched = tables.find(t => String(t.id) === String(selectedTable) || t.table_number === selectedTable);
        if (matched) targetTableId = matched.id;
      }

      if (!targetTableId && tables.length > 0) {
        targetTableId = tables[0].id;
      }

      if (!targetTableId) {
        const newTableRes = await api.post('/tables/', {
          restaurant_id: selectedRestaurant.id,
          table_number: 'Takeaway Counter',
          capacity: 10
        });
        targetTableId = newTableRes.data.id;
        setTables([newTableRes.data]);
      }

      // If KOT was not sent earlier, save order now
      if (!kotSent) {
        const orderPayload = {
          items: cart.map(item => ({
            menu_item_id: item.id,
            quantity: item.qty,
            special_instructions: item.note || null
          }))
        };
        await api.post(`/tables/${targetTableId}/orders`, orderPayload).catch(() => {});
      }

      // Complete checkout & mark session as PAID
      const checkoutPayload = {
        payment_method: (paymentMethod || 'cash').toLowerCase(),
        discount: parseFloat(discountAmount) || 0.0
      };

      await api.post(`/tables/${targetTableId}/checkout`, checkoutPayload);

      // Print Customer Bill
      const completedBillData = {
        order_number: `BILL-${Date.now().toString().slice(-4)}`,
        table_number: selectedTable,
        created_at: new Date().toISOString(),
        items: cart,
        subtotal,
        gst,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        payment_status: 'PAID'
      };
      printBill(completedBillData, { ...selectedRestaurant, tax_rate: taxRate });

      addToast('success', '💳 Payment Received & Bill Printed!', `₹${total.toFixed(2)} collected via ${paymentMethod}.`);
      setCart([]);
      setDiscountValue(0);
      setDiscountType('FLAT');
      setKotSent(false);
    } catch (err) {
      console.error("POS Checkout error:", err);
      handlePrintCartBill();
      addToast('success', 'Payment Received & Bill Printed!', `₹${total.toFixed(2)} collected via ${paymentMethod}.`);
      setCart([]);
      setDiscountValue(0);
      setDiscountType('FLAT');
      setKotSent(false);
    }
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
        .pos-items-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        @media (max-width: 1100px) {
          .pos-items-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 900px) {
          .pos-main-workspace { grid-template-columns: 1fr !important; }
          .pos-items-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .pos-order-desk { position: static !important; width: 100% !important; }
        }
        @media (max-width: 640px) {
          .pos-items-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 420px) {
          .pos-items-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Left Column: Menu Item Browser */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>

        {/* Search & Category Header */}
        <div className="panel-card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search menu items..."
                className="input-control"
                style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', maxWidth: '100%' }}>
              <button
                onClick={() => setSelectedCategory('All')}
                className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '9999px', fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
              >
                All
              </button>
              {visibleCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '9999px', fontSize: '0.75rem', padding: '0.25rem 0.65rem', whitespace: 'nowrap' }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

          </div>
        </div>

        {loading ? (
          <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading live menu catalog from database...
          </div>
        ) : menuItems.length === 0 ? (
          /* Empty State when no menu items exist */
          <div className="panel-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <UtensilsCrossed size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Menu Dishes Available</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Your restaurant menu is currently empty. Please add dishes in Menu & Categories to start taking orders.
            </p>
          </div>
        ) : filteredDishes.length === 0 ? (
          <div className="panel-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No dishes match your search or selected category filter.
          </div>
        ) : (
          /* Menu Items Scrollable Container & Strictly 4-Columns Grid */
          <div style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto', paddingRight: '0.3rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' }} className="pos-items-grid">
              {filteredDishes.map(dish => {
                const itemPrice = parseFloat(dish.price) || 0;
                return (
                  <div
                    key={dish.id}
                    onClick={() => handleItemClick(dish)}
                    className="panel-card"
                    style={{ padding: '0.65rem', cursor: 'pointer', minWidth: 0, borderLeft: dish.is_available ? '3px solid var(--success)' : '3px solid var(--danger)' }}
                  >
                    <div style={{
                      width: '100%',
                      height: '75px',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.5rem',
                    }}>
                      {dish.image_url ? (
                        <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={24} color="var(--text-muted)" />
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={dish.name}>{dish.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.8rem' }}>₹{itemPrice.toFixed(2)}</span>
                      <button className="btn btn-primary btn-sm" style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}>
                        <Plus size={11} /> Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Right Column: Current Order & Checkout Desk */}
      <div className="panel-card pos-order-desk" style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', position: 'sticky', top: '1rem' }}>

        {/* Order Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.65rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <Receipt size={16} color="var(--accent-primary)" /> Current Order
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>POS Terminal Checkout</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Table:</span>
            <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="select-control" style={{ border: 'none', background: 'transparent', padding: 0, fontWeight: 800, fontSize: '0.8rem' }}>
              <option value="Takeaway">Takeaway</option>
              {tables.map(t => (
                <option key={t.id} value={t.table_number || `T-${t.id}`}>
                  {t.table_number || `Table #${t.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item List - Expands to use ALL remaining vertical height */}
        <div style={{ flex: 1, minHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.25rem', marginBottom: '0.5rem' }}>
          {cart.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 1rem', textAlign: 'center' }}>
              <Receipt size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <div>Cart is empty.</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Click on menu items to add to order.</div>
            </div>
          ) : (
            cart.map(item => {
              const itemKey = item.cartItemId || item.id;
              return (
                <div key={itemKey} style={{ padding: '0.5rem 0.65rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.name}</span>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>₹{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  {item.addonsTitle && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {item.addonsTitle}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      <button onClick={() => updateQty(itemKey, -1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Minus size={12} /></button>
                      <span style={{ fontWeight: 800, fontSize: '0.8rem', minWidth: '16px', textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateQty(itemKey, 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Plus size={12} /></button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>₹{item.price.toFixed(2)} ea</span>
                      <button onClick={() => removeFromCart(itemKey)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Remove item">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Financial Breakdown & Compact Checkout Controls */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.65rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          
          {/* Summary Row: Subtotal, GST & Expandable Discount Tag */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>Sub: <strong style={{ color: 'var(--text-primary)' }}>₹{subtotal.toFixed(2)}</strong></span>
              <span>•</span>
              <span>GST ({taxRate}%): <strong style={{ color: 'var(--text-primary)' }}>₹{gst.toFixed(2)}</strong></span>
            </div>

            {/* Expandable Discount Trigger */}
            <button
              type="button"
              onClick={() => setShowDiscountInput(prev => !prev)}
              style={{
                background: discountAmount > 0 ? 'rgba(34, 197, 94, 0.15)' : (showDiscountInput ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)'),
                border: discountAmount > 0 ? '1px solid var(--success)' : '1px solid rgba(255, 255, 255, 0.12)',
                color: discountAmount > 0 ? 'var(--success)' : 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              title="Click to add or edit discount"
            >
              <Tag size={11} />
              {discountAmount > 0 ? `-₹${discountAmount.toFixed(2)} (${discountType === 'PERCENT' ? `${discountValue}%` : 'Flat'})` : (showDiscountInput ? 'Hide' : '+ Discount')}
            </button>
          </div>

          {/* Expandable Compact Discount Bar */}
          {(showDiscountInput || discountAmount > 0) && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '0.35rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flexWrap: 'wrap'
            }}>
              {/* Type Switcher */}
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px' }}>
                <button
                  type="button"
                  onClick={() => setDiscountType('FLAT')}
                  style={{
                    padding: '1px 6px',
                    fontSize: '0.68rem',
                    fontWeight: discountType === 'FLAT' ? 700 : 400,
                    background: discountType === 'FLAT' ? 'var(--accent-primary)' : 'transparent',
                    color: discountType === 'FLAT' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  ₹
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENT')}
                  style={{
                    padding: '1px 6px',
                    fontSize: '0.68rem',
                    fontWeight: discountType === 'PERCENT' ? 700 : 400,
                    background: discountType === 'PERCENT' ? 'var(--accent-primary)' : 'transparent',
                    color: discountType === 'PERCENT' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  %
                </button>
              </div>

              {/* Input */}
              <input
                type="number"
                min="0"
                max={discountType === 'PERCENT' ? 100 : subtotal}
                value={discountValue || ''}
                placeholder="0"
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (discountType === 'PERCENT') {
                    setDiscountValue(Math.min(100, Math.max(0, val)));
                  } else {
                    setDiscountValue(Math.max(0, val));
                  }
                }}
                className="input-control"
                style={{ width: '65px', padding: '0.15rem 0.35rem', fontSize: '0.78rem', textAlign: 'right' }}
              />

              {/* Quick Preset Pills */}
              <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                {(discountType === 'PERCENT' ? [5, 10, 15, 20] : [20, 50, 100]).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDiscountValue(val)}
                    style={{
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      border: discountValue === val ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: discountValue === val ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.03)',
                      color: discountValue === val ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: discountValue === val ? 700 : 400
                    }}
                  >
                    {discountType === 'PERCENT' ? `${val}%` : `₹${val}`}
                  </button>
                ))}
                {discountValue > 0 && (
                  <button
                    type="button"
                    onClick={() => { setDiscountValue(0); setShowDiscountInput(false); }}
                    style={{
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.1)',
                      color: 'var(--danger)',
                      cursor: 'pointer'
                    }}
                    title="Remove discount"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row: Total Due + Inline Payment Mode Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Due</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--success)', lineHeight: '1.1' }}>₹{total.toFixed(2)}</div>
            </div>

            {/* Compact Payment Pills */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {['UPI', 'CARD', 'CASH', 'ONLINE'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: paymentMethod === method ? 800 : 500,
                    padding: '0.25rem 0.45rem',
                    borderRadius: '4px',
                    border: paymentMethod === method ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                    background: paymentMethod === method ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                    color: paymentMethod === method ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* 2-Column Action Buttons: Side-by-Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginTop: '0.15rem' }}>
            <button
              onClick={handleSendToKitchen}
              disabled={cart.length === 0}
              className={`btn ${kotSent ? 'btn-secondary' : 'btn-primary'}`}
              style={{
                padding: '0.65rem 0.4rem',
                fontWeight: 800,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                border: kotSent ? '1px solid var(--success)' : 'none',
                color: kotSent ? 'var(--success)' : '#fff',
                whiteSpace: 'nowrap'
              }}
              title="Print KOT and send items to kitchen"
            >
              <Printer size={15} />
              {kotSent ? 'KOT Sent' : '1. Send KOT'}
            </button>

            <button
              onClick={handlePayAndPrintBill}
              disabled={cart.length === 0}
              className="btn btn-success"
              style={{
                padding: '0.65rem 0.4rem',
                fontWeight: 800,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap'
              }}
              title="Complete checkout & print receipt"
            >
              <CheckCircle size={15} />
              2. Pay & Bill
            </button>
          </div>
        </div>

      </div>

      {/* Customization Modal for POS */}
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
                                name={`pos_group_${group.id}`}
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

            {/* Quantity Stepper & Add to Order Button */}
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
                <span>Add Item • ₹{((parseFloat(customizingDish.price || 0) + Object.values(selectedAddons).flat().reduce((s, o) => s + (parseFloat(o.price || 0)), 0)) * customizingQty).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
