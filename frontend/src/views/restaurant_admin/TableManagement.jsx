import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { 
  QrCode, 
  Plus, 
  Users, 
  Receipt, 
  X, 
  CheckCircle, 
  Trash2, 
  Utensils, 
  DollarSign,
  AlertTriangle
} from 'lucide-react';

export const TableManagement = () => {
  const { selectedRestaurant, addToast, requestConfirm } = useAuth();

  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected table management modal state
  const [selectedTable, setSelectedTable] = useState(null);
  const [qrModalTable, setQrModalTable] = useState(null);
  const [tableOrders, setTableOrders] = useState({}); // { [tableId]: [ { id, name, price, qty } ] }

  // Add Table Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ table_number: '', capacity: 4 });

  // Add Order item state inside Selected Table Modal
  const [selectedItemForm, setSelectedItemForm] = useState({ item_id: '', qty: 1 });

  // Fetch real tables and menu items from backend API
  const fetchTablesAndMenu = () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const restId = selectedRestaurant.id;

    Promise.all([
      api.get(`/tables/restaurant/${restId}`).catch(() => ({ data: [] })),
      api.get(`/restaurants/${restId}/menu-items/`).catch(() => ({ data: [] })),
    ]).then(([tablesRes, menuRes]) => {
      const tblList = Array.isArray(tablesRes.data) ? tablesRes.data : tablesRes.data?.data || [];
      const itemList = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.data || [];
      setTables(tblList);
      setMenuItems(itemList);
      if (itemList.length > 0) {
        setSelectedItemForm(f => ({ ...f, item_id: itemList[0].id }));
      }
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTablesAndMenu();
  }, [selectedRestaurant]);

  // Create new Table in DB
  const handleCreateTable = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant || !addForm.table_number) return;

    try {
      await api.post('/tables/', {
        restaurant_id: selectedRestaurant.id,
        table_number: addForm.table_number,
        capacity: Number(addForm.capacity) || 4,
      });
      addToast('success', 'Table Added', `"${addForm.table_number}" added to floor plan!`);
      setShowAddModal(false);
      setAddForm({ table_number: '', capacity: 4 });
      fetchTablesAndMenu();
    } catch (err) {
      addToast('error', 'Failed to Add Table', err?.response?.data?.detail || err.message);
    }
  };

  // Update table status in DB
  const handleUpdateStatus = async (tableId, newStatus) => {
    try {
      await api.patch(`/tables/${tableId}`, { status: newStatus });
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
      if (selectedTable && selectedTable.id === tableId) {
        setSelectedTable(prev => ({ ...prev, status: newStatus }));
      }
      addToast('info', 'Table Status Updated', `Table status set to ${newStatus}`);
    } catch (err) {
      addToast('error', 'Status Update Failed', err?.response?.data?.detail || err.message);
    }
  };

  // Delete table from DB
  const handleDeleteTable = (tableId, tableNumber) => {
    requestConfirm({
      title: `Delete ${tableNumber}?`,
      message: `Are you sure you want to delete "${tableNumber}" from floor plan database?`,
      confirmText: 'Yes, Delete Table',
      onConfirm: async () => {
        try {
          await api.delete(`/tables/${tableId}`);
          addToast('success', 'Table Deleted', `"${tableNumber}" removed from floor plan.`);
          if (selectedTable && selectedTable.id === tableId) {
            setSelectedTable(null);
          }
          fetchTablesAndMenu();
        } catch (err) {
          addToast('error', 'Delete Failed', err?.response?.data?.detail || err.message);
        }
      }
    });
  };

  // Add Item/Order to Selected Table
  const handleAddItemToTableOrder = (e) => {
    e.preventDefault();
    if (!selectedTable) return;

    const item = menuItems.find(m => m.id === Number(selectedItemForm.item_id));
    if (!item) {
      addToast('error', 'Invalid Item', 'Select a valid menu item.');
      return;
    }

    const qty = Number(selectedItemForm.qty) || 1;
    const itemPrice = parseFloat(item.price) || 0;

    setTableOrders(prev => {
      const currentList = prev[selectedTable.id] || [];
      const existsIndex = currentList.findIndex(i => i.id === item.id);
      let updated;
      if (existsIndex >= 0) {
        updated = currentList.map((i, idx) => idx === existsIndex ? { ...i, qty: i.qty + qty } : i);
      } else {
        updated = [...currentList, { id: item.id, name: item.name, price: itemPrice, qty }];
      }
      return { ...prev, [selectedTable.id]: updated };
    });

    // Auto mark table as occupied if items added
    if (selectedTable.status !== 'occupied') {
      handleUpdateStatus(selectedTable.id, 'occupied');
    }

    addToast('success', 'Item Added to Table Order', `${qty}x ${item.name} added to ${selectedTable.table_number}`);
  };

  // Remove Item from Table Order
  const handleRemoveItemFromTableOrder = (tableId, itemId) => {
    setTableOrders(prev => ({
      ...prev,
      [tableId]: (prev[tableId] || []).filter(i => i.id !== itemId),
    }));
  };

  // Checkout and Pay Table Bill
  const handleCheckoutTableBill = (tableId) => {
    const tableObj = tables.find(t => t.id === tableId) || selectedTable;
    const items = tableOrders[tableId] || [];
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const total = subtotal * 1.05;

    // Clear order for this table
    setTableOrders(prev => {
      const copy = { ...prev };
      delete copy[tableId];
      return copy;
    });

    // Vacate table -> status available
    handleUpdateStatus(tableId, 'available');
    setSelectedTable(null);

    addToast('success', 'Bill Paid & Table Vacated!', `₹${total.toFixed(2)} collected for ${tableObj?.table_number || 'Table'}`);
  };

  // Calculate bill total for a table
  const getTableBillTotal = (tableId) => {
    const items = tableOrders[tableId] || [];
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    return subtotal * 1.05; // including 5% GST
  };

  const floorTables = tables.filter(t => !(t.table_number || '').toLowerCase().includes('takeaway'));

  const availableCount = floorTables.filter(t => t.status === 'available').length;
  const occupiedCount = floorTables.filter(t => t.status === 'occupied').length;
  const reservedCount = floorTables.filter(t => t.status === 'reserved').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-role" style={{ marginBottom: '0.5rem' }}>
              🏪 {selectedRestaurant?.name || 'Restaurant'} • FLOOR PLAN & BILLING
            </span>
            <h1 style={{ fontSize: '1.6rem' }}>Restaurant Tables & Floor Plan Management</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Select any table box below to view running bill, add order items, or collect payment.
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} /> Add New Table
          </button>
        </div>
      </div>

      {/* Table Status Summary Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <span className="badge badge-success">Available</span> ({availableCount} Tables)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <span className="badge badge-danger">Occupied</span> ({occupiedCount} Tables)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <span className="badge badge-info">Reserved</span> ({reservedCount} Tables)
        </div>
      </div>

      {loading ? (
        <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading floor plan tables from database...
        </div>
      ) : floorTables.length === 0 ? (
        /* Empty State */
        <div className="panel-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <QrCode size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>No Tables Added Yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Click "Add New Table" above to create your first restaurant floor table.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} /> Add New Table
          </button>
        </div>
      ) : (
        /* Floor Plan Table Cards Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {floorTables.map(tbl => {
            let statusBadge = 'badge-success';
            let border = 'var(--success-border)';
            if (tbl.status === 'occupied') { statusBadge = 'badge-danger'; border = 'var(--danger-border)'; }
            else if (tbl.status === 'reserved') { statusBadge = 'badge-info'; border = 'rgba(59, 130, 246, 0.3)'; }

            const billTotal = getTableBillTotal(tbl.id);
            const currentItems = tableOrders[tbl.id] || [];

            return (
              <div 
                key={tbl.id} 
                className="panel-card" 
                onClick={() => setSelectedTable(tbl)}
                style={{ 
                  padding: '1.25rem', 
                  borderColor: border, 
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  boxShadow: selectedTable?.id === tbl.id ? '0 0 20px var(--accent-glow)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)' }}>{tbl.table_number}</span>
                  <span className={`badge ${statusBadge}`}>{tbl.status}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <span><Users size={14} style={{ display: 'inline', marginRight: '4px' }} /> {tbl.capacity} Seats</span>
                  <span style={{ fontWeight: 800, color: billTotal > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    Bill: ₹{billTotal.toFixed(2)}
                  </span>
                </div>

                {/* QR Token Box & Sticker Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.72rem', marginBottom: '1rem' }}>
                  <span>QR: {tbl.qr_code_token || `TBL-${tbl.id}`}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setQrModalTable(tbl); }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                  >
                    <QrCode size={12} /> QR Code
                  </button>
                </div>

                {/* Manage & Delete Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedTable(tbl); }}
                    className="btn btn-primary btn-sm" 
                    style={{ justifyContent: 'center' }}
                  >
                    <Receipt size={14} /> Select & Manage Order
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(tbl.id, tbl.table_number); }}
                    className="btn btn-danger btn-sm" 
                    title="Delete Table"
                    style={{ padding: '0.4rem 0.6rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Selected Table Order & Billing Control Modal */}
      {selectedTable && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '620px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🍽️ Table: {selectedTable.table_number}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Capacity: {selectedTable.capacity} Seats • QR Token: {selectedTable.qr_code_token || `TBL-${selectedTable.id}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleDeleteTable(selectedTable.id, selectedTable.table_number)} 
                  className="btn btn-danger btn-sm" 
                  title="Delete Table"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button onClick={() => setSelectedTable(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>


            {/* Status Change Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Table Status:</span>
              {['available', 'occupied', 'reserved'].map(st => (
                <button
                  key={st}
                  onClick={() => handleUpdateStatus(selectedTable.id, st)}
                  className={`btn btn-sm ${selectedTable.status === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize', fontSize: '0.78rem' }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Add Order Item Form for this Table */}
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={16} /> Add Order Dish to {selectedTable.table_number}
              </h4>
              {menuItems.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                  ⚠ No menu dishes available. Add dishes in Menu Management first.
                </div>
              ) : (
                <form onSubmit={handleAddItemToTableOrder} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select 
                    value={selectedItemForm.item_id} 
                    onChange={(e) => setSelectedItemForm({ ...selectedItemForm, item_id: e.target.value })}
                    className="select-control"
                    style={{ flex: 1, minWidth: '180px' }}
                  >
                    {menuItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} — ₹{parseFloat(item.price || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>

                  <input 
                    type="number" 
                    min="1" 
                    className="input-control" 
                    style={{ width: '70px' }} 
                    value={selectedItemForm.qty} 
                    onChange={(e) => setSelectedItemForm({ ...selectedItemForm, qty: e.target.value })} 
                  />

                  <button type="submit" className="btn btn-primary btn-sm">
                    <Plus size={14} /> Add to Bill
                  </button>
                </form>
              )}
            </div>

            {/* Current Table Running Bill */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Receipt size={16} color="var(--accent-primary)" /> Running Bill Items
              </h4>

              {(!tableOrders[selectedTable.id] || tableOrders[selectedTable.id].length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  No items ordered for this table yet. Select a dish above to add to bill.
                </div>
              ) : (
                tableOrders[selectedTable.id].map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.qty}x @ ₹{item.price.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>₹{(item.price * item.qty).toFixed(2)}</span>
                      <button onClick={() => handleRemoveItemFromTableOrder(selectedTable.id, item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary & Pay Button */}
            {tableOrders[selectedTable.id] && tableOrders[selectedTable.id].length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                  <span>TOTAL DUE (incl 5% GST):</span>
                  <span>₹{getTableBillTotal(selectedTable.id).toFixed(2)}</span>
                </div>
                <button onClick={() => handleCheckoutTableBill(selectedTable.id)} className="btn btn-success" style={{ width: '100%', padding: '0.85rem', fontWeight: 800, marginTop: '0.5rem' }}>
                  <CheckCircle size={18} /> Pay Bill & Vacate Table
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>🪑 Add New Table to Floor Plan</h3>
            <form onSubmit={handleCreateTable} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Table Number / Identifier *</label>
                <input type="text" required placeholder="e.g. T-01, T-02, VIP-1" className="input-control" value={addForm.table_number} onChange={(e) => setAddForm({ ...addForm, table_number: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Seating Capacity (Seats)</label>
                <input type="number" min="1" max="20" required className="input-control" value={addForm.capacity} onChange={(e) => setAddForm({ ...addForm, capacity: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Table to DB</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table QR Code Sticker Modal */}
      {qrModalTable && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Table QR Code Sticker</h3>
              <button onClick={() => setQrModalTable(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '1.25rem' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${window.location.origin}/order/table/${qrModalTable.id}`)}`}
                alt={`Table ${qrModalTable.table_number} QR Code`}
                style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto' }}
              />
              <div style={{ marginTop: '0.75rem', color: '#1e293b', fontWeight: 800, fontSize: '1.1rem' }}>
                {selectedRestaurant?.name || 'DineBuddy'}
              </div>
              <div style={{ color: '#6366f1', fontWeight: 800, fontSize: '1.3rem' }}>
                {qrModalTable.table_number}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                Scan to View Menu & Order
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/order/table/${qrModalTable.id}`)}`;
                  const restName = selectedRestaurant?.name || 'DineBuddy Restaurant';
                  const printWindow = window.open('', '_blank', 'width=600,height=700');
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Print QR Sticker - ${qrModalTable.table_number}</title>
                        <style>
                          body { font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; }
                          .sticker-card { background: white; padding: 2.5rem; border-radius: 24px; text-align: center; border: 3px solid #6366f1; box-shadow: 0 20px 40px rgba(0,0,0,0.1); width: 320px; }
                          .logo { font-size: 1.4rem; font-weight: 800; color: #1e293b; margin-bottom: 0.25rem; }
                          .sub { font-size: 0.8rem; color: #64748b; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
                          .qr-img { width: 220px; height: 220px; border-radius: 16px; margin: 0 auto 1.25rem auto; display: block; border: 1px solid #e2e8f0; }
                          .table-title { font-size: 2rem; font-weight: 900; color: #6366f1; margin-bottom: 0.25rem; }
                          .scan-text { font-size: 0.85rem; font-weight: 700; color: #475569; }
                          @media print {
                            body { background: white; }
                            .sticker-card { border: 2px solid #000; box-shadow: none; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="sticker-card">
                          <div class="logo">${restName}</div>
                          <div class="sub">SCAN TO ORDER FOOD</div>
                          <img src="${qrUrl}" class="qr-img" />
                          <div class="table-title">${qrModalTable.table_number}</div>
                          <div class="scan-text">Point phone camera to view menu & order</div>
                        </div>
                        <script>
                          setTimeout(() => { window.print(); }, 600);
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                🖨️ Print / Save QR Sticker (PDF)
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/order/table/${qrModalTable.id}`);
                  addToast('success', 'Link Copied', 'Customer menu link copied to clipboard!');
                }}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                📋 Copy Customer Menu Link
              </button>
              
              <a
                href={`${window.location.origin}/order/table/${qrModalTable.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
              >
                🌐 Test Customer Menu in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
