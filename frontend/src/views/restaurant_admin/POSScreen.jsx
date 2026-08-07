import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  UtensilsCrossed,
  Receipt,
  ImageIcon
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

  // Fetch real categories, menu items, and tables from backend
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
      api.get(`/tables/restaurant/${restId}`).catch(() => ({ data: [] })),
    ]).then(([catRes, itemsRes, tablesRes]) => {
      const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      const itemList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      const tableList = Array.isArray(tablesRes.data) ? tablesRes.data : tablesRes.data?.data || [];

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

  const addToCart = (item) => {
    const itemPrice = parseFloat(item.price) || 0;
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: itemPrice, qty: 1, note: '' }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const nextQty = i.qty + delta;
        return nextQty > 0 ? { ...i, qty: nextQty } : null;
      }
      return i;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const gst = subtotal * 0.05;
  const total = Math.max(0, subtotal + gst - discount);

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedRestaurant) return;

    try {
      let targetTableId = null;

      if (selectedTable === 'Takeaway') {
        // Find existing dedicated Takeaway table or auto-create one
        let takeawayTable = tables.find(t => (t.table_number || '').toLowerCase().includes('takeaway'));
        if (takeawayTable) {
          targetTableId = takeawayTable.id;
        } else {
          try {
            const newTableRes = await api.post('/tables/', {
              restaurant_id: selectedRestaurant.id,
              table_number: 'Takeaway',
              capacity: 100
            });
            targetTableId = newTableRes.data.id;
            setTables(prev => [...prev, newTableRes.data]);
          } catch {
            if (tables.length > 0) targetTableId = tables[0].id;
          }
        }
      } else {
        const matched = tables.find(t => String(t.id) === String(selectedTable) || t.table_number === selectedTable);
        if (matched) targetTableId = matched.id;
      }

      if (!targetTableId && tables.length > 0) {
        targetTableId = tables[0].id;
      }

      if (!targetTableId) {
        const newTableRes = await api.post('/tables/', {
          restaurant_id: selectedRestaurant.id,
          table_number: 'Takeaway',
          capacity: 100
        });
        targetTableId = newTableRes.data.id;
        setTables([newTableRes.data]);
      }

      // 1. Post order items to table session
      const orderPayload = {
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.qty,
          special_instructions: item.note || null
        }))
      };

      await api.post(`/tables/${targetTableId}/orders`, orderPayload);

      // 2. Complete checkout & mark session as PAID
      const checkoutPayload = {
        payment_method: (paymentMethod || 'cash').toLowerCase(),
        discount: parseFloat(discount) || 0.0
      };

      await api.post(`/tables/${targetTableId}/checkout`, checkoutPayload);

      addToast('success', 'Order Placed & Paid!', `₹${total.toFixed(2)} collected via ${paymentMethod}. Saved to Database & Sales Reports updated!`);
      setCart([]);
      setDiscount(0);
    } catch (err) {
      console.error("POS Checkout error:", err);
      const errMsg = err.response?.data?.detail || 'Failed to persist order to database.';
      addToast('error', 'Checkout Failed', errMsg);
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.5rem', minHeight: 'calc(100vh - 140px)' }}>
      
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
          /* Menu Items Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {filteredDishes.map(dish => {
              const itemPrice = parseFloat(dish.price) || 0;
              return (
                <div 
                  key={dish.id} 
                  onClick={() => addToCart(dish)}
                  className="panel-card" 
                  style={{ padding: '1rem', cursor: 'pointer', borderLeft: dish.is_available ? '3px solid var(--success)' : '3px solid var(--danger)' }}
                >
                  <div style={{
                    width: '100%',
                    height: '100px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                  }}>
                    {dish.image_url ? (
                      <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ImageIcon size={32} color="var(--text-muted)" />
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{dish.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--success)' }}>₹{itemPrice.toFixed(2)}</span>
                    <button className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.6rem' }}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Right Column: Current Order & Checkout Desk */}
      <div className="panel-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
        
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
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
          {cart.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Cart is empty. Click on menu items to add to order.
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>₹{(item.price * item.qty).toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                    <button onClick={() => updateQty(item.id, -1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Minus size={14} /></button>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Plus size={14} /></button>
                  </div>

                  <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Breakdown & Payment Controls */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>GST (5%)</span>
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

          <button onClick={handleCheckout} disabled={cart.length === 0} className="btn btn-success" style={{ width: '100%', padding: '0.85rem', fontWeight: 800, fontSize: '0.95rem' }}>
            <CheckCircle size={18} /> PAY & COMPLETE ORDER
          </button>
        </div>

      </div>

    </div>
  );
};
