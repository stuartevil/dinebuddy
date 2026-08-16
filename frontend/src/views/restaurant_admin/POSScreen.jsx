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
  X
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
  const [discount, setDiscount] = useState(0);
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

  const handleItemClick = async (dish) => {
    if (!selectedRestaurant) return;
    try {
      const restId = selectedRestaurant.id;
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
    } catch (e) {}
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

    setKotSent(false);
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
  };

  const addToCart = (item) => {
    setKotSent(false);
    const itemPrice = parseFloat(item.price) || 0;
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
  const gst = subtotal * (taxRate / 100);
  const total = Math.max(0, subtotal + gst - discount);

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
      discount,
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
        discount: parseFloat(discount) || 0.0
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
        discount,
        total,
        payment_method: paymentMethod,
        payment_status: 'PAID'
      };
      printBill(completedBillData, { ...selectedRestaurant, tax_rate: taxRate });

      addToast('success', '💳 Payment Received & Bill Printed!', `₹${total.toFixed(2)} collected via ${paymentMethod}.`);
      setCart([]);
      setDiscount(0);
      setKotSent(false);
    } catch (err) {
      console.error("POS Checkout error:", err);
      handlePrintCartBill();
      addToast('success', 'Payment Received & Bill Printed!', `₹${total.toFixed(2)} collected via ${paymentMethod}.`);
      setCart([]);
      setDiscount(0);
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem', alignItems: 'start' }} className="pos-main-workspace">
      <style>{`
        .pos-items-grid {
          grid-template-columns: repeat(4, 1fr) !important;
        }
        @media (max-width: 992px) {
          .pos-main-workspace { grid-template-columns: 1fr !important; }
          .pos-items-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .pos-order-desk { position: static !important; width: 100% !important; }
        }
        @media (max-width: 640px) {
          .pos-items-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 420px) {
          .pos-items-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Left Column: Menu Item Browser */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Search & Category Header */}
        <div className="panel-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search menu items for quick POS ordering..."
                className="input-control"
                style={{ paddingLeft: '2.5rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
              <button
                onClick={() => setSelectedCategory('All')}
                className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '9999px' }}
              >
                All
              </button>
              {visibleCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '9999px' }}
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
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', paddingRight: '0.4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }} className="pos-items-grid">
              {filteredDishes.map(dish => {
                const itemPrice = parseFloat(dish.price) || 0;
                return (
                  <div
                    key={dish.id}
                    onClick={() => handleItemClick(dish)}
                    className="panel-card"
                    style={{ padding: '0.85rem', cursor: 'pointer', borderLeft: dish.is_available ? '3px solid var(--success)' : '3px solid var(--danger)' }}
                  >
                    <div style={{
                      width: '100%',
                      height: '90px',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.6rem',
                    }}>
                      {dish.image_url ? (
                        <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={28} color="var(--text-muted)" />
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{dish.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.85rem' }}>₹{itemPrice.toFixed(2)}</span>
                      <button className="btn btn-primary btn-sm" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                        <Plus size={12} /> Add
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
      <div className="panel-card pos-order-desk" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: 'fit-content', position: 'sticky', top: '1rem' }}>

        {/* Order Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Receipt size={18} color="var(--accent-primary)" /> Current Order
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POS Terminal Checkout</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Table:</span>
            <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="select-control" style={{ border: 'none', background: 'transparent', padding: 0, fontWeight: 800, fontSize: '0.85rem' }}>
              <option value="Takeaway">Takeaway</option>
              {tables.map(t => (
                <option key={t.id} value={t.table_number || `T-${t.id}`}>
                  {t.table_number || `Table #${t.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item List */}
        <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '0.25rem' }}>
          {cart.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Cart is empty. Click on menu items to add to order.
            </div>
          ) : (
            cart.map(item => {
              const itemKey = item.cartItemId || item.id;
              return (
                <div key={itemKey} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</span>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>₹{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  {item.addonsTitle && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      {item.addonsTitle}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                      <button onClick={() => updateQty(itemKey, -1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={14} /></button>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.qty}</span>
                      <button onClick={() => updateQty(itemKey, 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={14} /></button>
                    </div>

                    <button onClick={() => removeFromCart(itemKey)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Financial Breakdown & Payment Controls */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>GST ({taxRate}%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Discount (₹)</span>
            <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input-control" style={{ width: '80px', padding: '0.2rem 0.5rem', textAlign: 'right' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.5rem' }}>
            <span>TOTAL DUE</span>
            <span>₹{total.toFixed(2)}</span>
          </div>

          {/* Payment Mode Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', margin: '0.75rem 0' }}>
            {['UPI', 'CARD', 'CASH', 'ONLINE'].map(method => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`btn btn-sm ${paymentMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.2rem' }}
              >
                {method}
              </button>
            ))}
          </div>

          {/* Two-Step Takeaway Workflow: 1. Send KOT -> 2. Pay & Bill */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              onClick={handleSendToKitchen}
              disabled={cart.length === 0}
              className={`btn ${kotSent ? 'btn-secondary' : 'btn-primary'}`}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontWeight: 800,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: kotSent ? '1px solid var(--success)' : 'none',
                color: kotSent ? 'var(--success)' : '#fff'
              }}
            >
              <Printer size={18} />
              {kotSent ? '✔️ KOT SENT TO KITCHEN (RE-PRINT KOT)' : '🔥 1. SEND TO KITCHEN (PRINT KOT)'}
            </button>

            <button
              onClick={handlePayAndPrintBill}
              disabled={cart.length === 0}
              className="btn btn-success"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontWeight: 800,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <CheckCircle size={18} />
              💳 2. COLLECT PAYMENT &amp; PRINT BILL
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
