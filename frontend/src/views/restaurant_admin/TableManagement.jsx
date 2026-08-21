import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { printKOT, printBill } from '../../services/printService';
import {
  QrCode,
  Plus,
  Minus,
  Users,
  Receipt,
  X,
  CheckCircle,
  Trash2,
  Utensils,
  IndianRupee,
  AlertTriangle,
  Printer,
  Sparkles,
  Loader2,
  Search,
  ChevronDown,
  Check
} from 'lucide-react';

export const TableManagement = () => {
  const { selectedRestaurant, addToast, requestConfirm } = useAuth();

  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveBills, setLiveBills] = useState({}); // { [tableId]: LiveBillSummary }

  // Selected table management modal state
  const [selectedTable, setSelectedTable] = useState(null);
  const [loadingTableBill, setLoadingTableBill] = useState(false);
  const [qrModalTable, setQrModalTable] = useState(null);

  // Add Table Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ table_number: '', capacity: 4 });

  // Add Order item state inside Selected Table Modal
  const [selectedItemForm, setSelectedItemForm] = useState({ item_id: '', qty: 1 });
  const [dishSearch, setDishSearch] = useState('');
  const [isDishDropdownOpen, setIsDishDropdownOpen] = useState(false);
  const dishDropdownRef = useRef(null);

  const [addingOrder, setAddingOrder] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Addon Customization Modal State for Table Management
  const [customizingDish, setCustomizingDish] = useState(null);
  const [customizingGroups, setCustomizingGroups] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});
  const [customizingQty, setCustomizingQty] = useState(1);
  const [loadingAddons, setLoadingAddons] = useState(false);

  const selectedTableRef = useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  // Click outside to close searchable dish dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dishDropdownRef.current && !dishDropdownRef.current.contains(e.target)) {
        setIsDishDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live bill for a specific table
  const fetchTableLiveBill = async (tableId, showSpinner = false) => {
    if (!tableId) return;
    if (showSpinner) setLoadingTableBill(true);
    try {
      const res = await api.get(`/tables/${tableId}/current-bill`);
      if (res.data) {
        setLiveBills(prev => ({ ...prev, [tableId]: res.data }));
      }
    } catch {
      // Keep existing or empty gracefully
    } finally {
      if (showSpinner) setLoadingTableBill(false);
    }
  };

  // Fetch real tables, menu items, and live running bills from backend API
  const fetchTablesAndMenu = async (isInitial = false) => {
    if (!selectedRestaurant) {
      if (isInitial) setLoading(false);
      return;
    }
    if (isInitial) setLoading(true);
    const restId = selectedRestaurant.id;

    try {
      const [tablesRes, menuRes] = await Promise.all([
        api.get(`/tables/restaurant/${restId}`).catch(() => ({ data: [] })),
        api.get(`/restaurants/${restId}/menu-items/`).catch(() => ({ data: [] })),
      ]);

      const tblList = Array.isArray(tablesRes.data) ? tablesRes.data : tablesRes.data?.data || [];
      const itemList = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.data || [];

      setTables(tblList);
      setMenuItems(itemList);

      // Update selected table object reference if currently open
      if (selectedTableRef.current) {
        const updatedSelected = tblList.find(t => t.id === selectedTableRef.current.id);
        if (updatedSelected) {
          setSelectedTable(updatedSelected);
        }
      }

      // Fetch running bills for all occupied dining floor tables
      const occupiedTables = tblList.filter(t => t.status === 'occupied' && !(t.table_number || '').toLowerCase().includes('takeaway'));
      if (occupiedTables.length > 0) {
        const billsMap = {};
        await Promise.all(
          occupiedTables.map(t =>
            api.get(`/tables/${t.id}/current-bill`)
              .then(res => {
                if (res.data) billsMap[t.id] = res.data;
              })
              .catch(() => { })
          )
        );
        setLiveBills(prev => ({ ...prev, ...billsMap }));
      }
    } catch (err) {
      console.error("Failed to fetch tables/menu:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Live Auto-Polling every 5 seconds for Real-Time table synchronization
  useEffect(() => {
    fetchTablesAndMenu(true);

    const interval = setInterval(() => {
      fetchTablesAndMenu(false);
    }, 5000); // 5 sec live sync

    return () => clearInterval(interval);
  }, [selectedRestaurant]);

  // Live auto-polling for open modal table bill (every 3 seconds)
  useEffect(() => {
    if (!selectedTable?.id) return;
    fetchTableLiveBill(selectedTable.id, false);

    const interval = setInterval(() => {
      fetchTableLiveBill(selectedTable.id, false);
    }, 3000); // 3 sec live polling for open table modal

    return () => clearInterval(interval);
  }, [selectedTable?.id]);

  // When a table is selected, load its live bill immediately
  const handleSelectTable = (tbl) => {
    setSelectedTable(tbl);
    fetchTableLiveBill(tbl.id, true);
  };

  // Create new Table in DB
  const handleCreateTable = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant || !addForm.table_number) return;

    try {
      await api.post('/tables/', {
        restaurant_id: selectedRestaurant.id,
        table_number: addForm.table_number.trim(),
        capacity: Number(addForm.capacity) || 4,
      });
      addToast('success', 'Table Added', `"${addForm.table_number}" added to floor plan!`);
      setShowAddModal(false);
      setAddForm({ table_number: '', capacity: 4 });
      fetchTablesAndMenu(false);
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
      fetchTablesAndMenu(false);
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
          fetchTablesAndMenu(false);
        } catch (err) {
          addToast('error', 'Delete Failed', err?.response?.data?.detail || err.message);
        }
      }
    });
  };

  // Direct add helper for items without addons (Database Persistent)
  const addItemToTableOrderDirect = async (item, qty = 1) => {
    if (!selectedTable) return;
    setAddingOrder(true);
    try {
      await api.post(`/tables/${selectedTable.id}/orders`, {
        items: [
          {
            menu_item_id: item.id,
            quantity: qty,
            special_instructions: null
          }
        ]
      });

      addToast('success', 'Item Added to Bill', `${qty}x ${item.name} added to ${selectedTable.table_number}`);
      setSelectedItemForm({ item_id: '', qty: 1 });
      setDishSearch('');
      await fetchTableLiveBill(selectedTable.id, true);
      fetchTablesAndMenu(false);
    } catch (err) {
      addToast('error', 'Failed to Add Item', err?.response?.data?.detail || err.message);
    } finally {
      setAddingOrder(false);
    }
  };

  // Filtered dishes for Searchable Dropdown
  const filteredDishes = menuItems.filter(item => {
    const q = (dishSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      String(item.price || '').includes(q)
    );
  });

  // Add Item / Open Customization when clicking Add to Bill
  const handleAddItemToTableOrder = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTable || !selectedRestaurant) return;

    let item = menuItems.find(m => Number(m.id) === Number(selectedItemForm.item_id));
    if (!item && filteredDishes.length > 0) {
      item = filteredDishes[0];
      setSelectedItemForm(f => ({ ...f, item_id: item.id }));
      setDishSearch(item.name);
    }

    if (!item) {
      addToast('error', 'Select a Dish', 'Please select or search a menu dish to add.');
      return;
    }

    const qty = Number(selectedItemForm.qty) || 1;

    setLoadingAddons(true);
    try {
      const res = await api.get(`/restaurants/${selectedRestaurant.id}/menu-items/${item.id}/addon-groups`);
      const rawGroups = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const groups = rawGroups.filter(g => g && g.is_active && Array.isArray(g.options) && g.options.length > 0);

      if (groups.length > 0) {
        // Open Customization Modal for Table Order
        setCustomizingDish(item);
        setCustomizingGroups(groups);
        setCustomizingQty(qty);

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
        // Simple item without add-ons -> add directly to backend DB session
        await addItemToTableOrderDirect(item, qty);
      }
    } catch (err) {
      console.error("Error fetching add-ons for table order:", err);
      await addItemToTableOrderDirect(item, qty);
    } finally {
      setLoadingAddons(false);
    }
  };

  // Confirm and Add Customized Item with Add-ons to Backend Table Order
  const handleConfirmTableCustomization = async () => {
    if (!customizingDish || !selectedTable) return;

    const selectedOpts = Object.values(selectedAddons || {}).flat().filter(Boolean);
    const addonsDetails = selectedOpts.map(o => {
      const p = parseFloat(o?.price || 0);
      return p > 0 ? `${o?.name} (+₹${p.toFixed(2)})` : o?.name;
    }).filter(Boolean).join(', ');

    const combinedNote = addonsDetails ? `Add-ons: ${addonsDetails}` : null;

    setAddingOrder(true);
    try {
      await api.post(`/tables/${selectedTable.id}/orders`, {
        items: [
          {
            menu_item_id: customizingDish.id,
            quantity: customizingQty,
            special_instructions: combinedNote
          }
        ]
      });

      addToast('success', 'Customized Item Added', `${customizingQty}x ${customizingDish.name} added to ${selectedTable.table_number}`);
      setCustomizingDish(null);
      setCustomizingGroups([]);
      setSelectedAddons({});
      setCustomizingQty(1);
      setSelectedItemForm({ item_id: '', qty: 1 });
      setDishSearch('');

      await fetchTableLiveBill(selectedTable.id, true);
      fetchTablesAndMenu(false);
    } catch (err) {
      addToast('error', 'Failed to Add Item', err?.response?.data?.detail || err.message);
    } finally {
      setAddingOrder(false);
    }
  };

  // Print KOT from Live Table Modal
  const handlePrintTableKOT = (tableId) => {
    const tableObj = tables.find(t => t.id === tableId) || selectedTable;
    const currentBill = liveBills[tableId];
    const items = currentBill?.items_summary || [];

    if (items.length === 0) {
      addToast('warning', 'No Items', 'No active ordered items on this table to print KOT.');
      return;
    }

    const orderData = {
      order_number: `KOT-${Date.now().toString().slice(-4)}`,
      table_number: tableObj?.table_number || 'Table',
      created_at: currentBill?.opened_at || new Date().toISOString(),
      items: items.map(i => ({
        name: i.item_name,
        quantity: i.quantity,
        special_instructions: i.special_instructions || (i.variant_name ? `Variant: ${i.variant_name}` : '')
      }))
    };
    printKOT(orderData, selectedRestaurant || {});
    addToast('info', 'KOT Sent to Printer', `Kitchen Order Ticket printed for ${tableObj?.table_number}`);
  };

  // Print Bill Slip from Live Table Modal
  const handlePrintTableBill = (tableId) => {
    const tableObj = tables.find(t => t.id === tableId) || selectedTable;
    const currentBill = liveBills[tableId];
    const items = currentBill?.items_summary || [];

    if (items.length === 0) {
      addToast('warning', 'No Items', 'No items ordered on this table to print bill.');
      return;
    }

    const subtotal = currentBill.subtotal || items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
    const gst = currentBill.tax || 0;
    const total = currentBill.total_amount || (subtotal + gst);

    const billData = {
      order_number: `BILL-${currentBill.session_id || Date.now().toString().slice(-4)}`,
      table_number: tableObj?.table_number || 'Table',
      created_at: currentBill.opened_at || new Date().toISOString(),
      items: items.map(i => ({
        name: i.item_name,
        quantity: i.quantity,
        price: i.unit_price,
        special_instructions: i.special_instructions || (i.variant_name ? `Variant: ${i.variant_name}` : '')
      })),
      subtotal,
      gst,
      total,
      payment_method: 'CASH / UPI',
      payment_status: 'PAID'
    };
    printBill(billData, selectedRestaurant || {});
  };

  // Checkout, Pay Table Bill, and Vacate Table in DB
  const handleCheckoutTableBill = async (tableId) => {
    const tableObj = tables.find(t => t.id === tableId) || selectedTable;
    const currentBill = liveBills[tableId];
    const totalDue = currentBill ? parseFloat(currentBill.total_amount || 0) : 0;

    setCheckingOut(true);
    try {
      // Auto-print receipt if items exist
      if (currentBill && currentBill.items_summary && currentBill.items_summary.length > 0) {
        handlePrintTableBill(tableId);
      }

      await api.post(`/tables/${tableId}/checkout`, {
        payment_method: 'CASH',
        discount: 0.0,
        payment_notes: 'Paid at counter'
      });

      // Clear local live bill cache for this table
      setLiveBills(prev => {
        const copy = { ...prev };
        delete copy[tableId];
        return copy;
      });

      setSelectedTable(null);
      await fetchTablesAndMenu(false);

      addToast('success', 'Table Vacated!', `Table ${tableObj?.table_number || ''} is now Available.`);
    } catch (err) {
      addToast('error', 'Checkout Failed', err?.response?.data?.detail || err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  // Get live bill total for a table card
  const getTableBillTotal = (tableId) => {
    const bill = liveBills[tableId];
    if (bill && bill.total_amount !== undefined) {
      return parseFloat(bill.total_amount || 0);
    }
    return 0.0;
  };

  const floorTables = tables.filter(t => {
    const name = (t.table_number || '').toLowerCase().trim();
    return !name.includes('takeaway');
  });

  const availableCount = floorTables.filter(t => t.status === 'available').length;
  const occupiedCount = floorTables.filter(t => t.status === 'occupied').length;
  const reservedCount = floorTables.filter(t => t.status === 'reserved').length;

  const currentSelectedBill = selectedTable ? liveBills[selectedTable.id] : null;
  const selectedItems = currentSelectedBill?.items_summary || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-role">
                🏪 {selectedRestaurant?.name || 'Restaurant'} • LIVE FLOOR PLAN & BILLING
              </span>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                AUTO-SYNC LIVE (5s)
              </span>
            </div>
            <h1 style={{ fontSize: '1.6rem' }}>Restaurant Tables & Floor Plan Management</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Real-time table tracking. Customer QR orders automatically reflect live on table cards without page refresh.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
              <Plus size={16} /> Add New Table
            </button>
          </div>
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
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
          Loading real-time floor plan tables from database...
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
            const billData = liveBills[tbl.id];
            const ordersCount = billData?.total_orders_count || (billTotal > 0 ? 1 : 0);

            return (
              <div
                key={tbl.id}
                className="panel-card"
                onClick={() => handleSelectTable(tbl)}
                style={{
                  padding: '1.25rem',
                  borderColor: border,
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  boxShadow: selectedTable?.id === tbl.id ? '0 0 20px var(--accent-glow)' : 'none',
                  position: 'relative'
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

                {/* Orders count badge if occupied */}
                {tbl.status === 'occupied' && (
                  <div style={{ fontSize: '0.75rem', color: ordersCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 700 }}>
                    {ordersCount > 0
                      ? `⚡ ${ordersCount} Active Round${ordersCount > 1 ? 's' : ''} (${billData?.items_summary?.length || 0} items)`
                      : '⚡ Occupied Table'}
                  </div>
                )}

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
                    onClick={(e) => { e.stopPropagation(); handleSelectTable(tbl); }}
                    className="btn btn-primary btn-sm"
                    style={{ justifyContent: 'center' }}
                  >
                    <Receipt size={14} /> View & Manage Live Bill
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

      {/* Selected Table Order & Live Billing Control Modal */}
      {selectedTable && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto' }}>

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

            {/* Add Order Item Form for this Table with Searchable Combobox */}
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={16} /> Search & Add Dish to {selectedTable.table_number} Bill
              </h4>
              {menuItems.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                  ⚠ No menu dishes available. Add dishes in Menu Management first.
                </div>
              ) : (
                <form onSubmit={handleAddItemToTableOrder} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                  {/* Searchable Combobox Input */}
                  <div ref={dishDropdownRef} style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-primary)',
                        border: isDishDropdownOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 0.75rem',
                        gap: '0.5rem',
                        cursor: 'text',
                        boxShadow: isDishDropdownOpen ? '0 0 10px var(--accent-glow)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => setIsDishDropdownOpen(true)}
                    >
                      <Search size={15} color={isDishDropdownOpen ? "var(--accent-primary)" : "var(--text-muted)"} />
                      <input
                        type="text"
                        placeholder="Search dish by name / price..."
                        value={dishSearch}
                        onChange={(e) => {
                          setDishSearch(e.target.value);
                          setIsDishDropdownOpen(true);
                        }}
                        onFocus={() => setIsDishDropdownOpen(true)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          width: '100%'
                        }}
                      />
                      {dishSearch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDishSearch('');
                            setIsDishDropdownOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                      <ChevronDown size={15} color="var(--text-muted)" style={{ transform: isDishDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', cursor: 'pointer' }} />
                    </div>

                    {/* Search Matches Dropdown Menu */}
                    {isDishDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
                          maxHeight: '230px',
                          overflowY: 'auto',
                          zIndex: 1200
                        }}
                      >
                        {filteredDishes.length === 0 ? (
                          <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No dishes found matching "{dishSearch}"
                          </div>
                        ) : (
                          filteredDishes.map(item => {
                            const isSelected = String(item.id) === String(selectedItemForm.item_id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setSelectedItemForm(f => ({ ...f, item_id: item.id }));
                                  setDishSearch(item.name);
                                  setIsDishDropdownOpen(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.65rem 0.85rem',
                                  borderBottom: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                    {item.name}
                                  </span>
                                  {item.is_veg !== undefined && (
                                    <span
                                      style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: item.is_veg ? '#22c55e' : '#ef4444',
                                        display: 'inline-block'
                                      }}
                                      title={item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                                    ></span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--success)' }}>
                                    ₹{parseFloat(item.price || 0).toFixed(2)}
                                  </span>
                                  {isSelected && <Check size={14} color="var(--accent-primary)" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <input
                    type="number"
                    min="1"
                    className="input-control"
                    style={{ width: '70px', height: '38px' }}
                    value={selectedItemForm.qty}
                    onChange={(e) => setSelectedItemForm({ ...selectedItemForm, qty: e.target.value })}
                  />

                  {/* Add to Bill Action Button */}
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={loadingAddons || addingOrder}
                    style={{ height: '38px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0 1rem' }}
                  >
                    {loadingAddons || addingOrder ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Adding...
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Add to Bill
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Current Real-Time Live Running Bill */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Receipt size={16} color="var(--accent-primary)" />
                  <span>Real-Time Running Bill ({selectedItems.length} items)</span>
                </h4>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  {selectedItems.length > 0 && (
                    <>
                      <button
                        onClick={() => handlePrintTableKOT(selectedTable.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        title="Print KOT to Thermal Printer"
                      >
                        <Printer size={12} /> KOT
                      </button>
                      <button
                        onClick={() => handlePrintTableBill(selectedTable.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        title="Print Bill Slip to Thermal Printer"
                      >
                        <Receipt size={12} /> Bill Slip
                      </button>
                    </>
                  )}
                </div>
              </div>

              {loadingTableBill ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                  Fetching live order ticket...
                </div>
              ) : selectedItems.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 0.5rem 0' }}>No dishes ordered yet for {selectedTable.table_number}.</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    When a customer orders via QR code, dishes will automatically appear here live. Or search and add dishes above.
                  </p>
                </div>
              ) : (
                selectedItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span>{item.item_name}</span>
                        {item.variant_name && (
                          <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                            {item.variant_name}
                          </span>
                        )}
                        {item.special_instructions && (
                          <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                            ✨ {item.special_instructions}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.quantity}x @ ₹{parseFloat(item.unit_price || 0).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>₹{parseFloat(item.total_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary & Pay / Vacate Buttons */}
            {currentSelectedBill && selectedItems.length > 0 ? (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(currentSelectedBill.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>GST Tax:</span>
                  <span>₹{parseFloat(currentSelectedBill.tax || 0).toFixed(2)}</span>
                </div>
                {parseFloat(currentSelectedBill.discount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)' }}>
                    <span>Discount:</span>
                    <span>-₹{parseFloat(currentSelectedBill.discount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>
                  <span>TOTAL DUE:</span>
                  <span>₹{parseFloat(currentSelectedBill.total_amount || 0).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => handleCheckoutTableBill(selectedTable.id)}
                  disabled={checkingOut}
                  className="btn btn-success"
                  style={{ width: '100%', padding: '0.85rem', fontWeight: 800, marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  {checkingOut ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Processing Payment...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} /> Pay Bill & Vacate Table
                    </>
                  )}
                </button>
              </div>
            ) : (
              selectedTable.status === 'occupied' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button
                    onClick={() => handleCheckoutTableBill(selectedTable.id)}
                    disabled={checkingOut}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '0.65rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <CheckCircle size={16} /> Vacate / Reset Table to Available
                  </button>
                </div>
              )
            )}

          </div>
        </div>
      )}

      {/* Customization Modal for Table Order Item */}
      {customizingDish && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-box" style={{ maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={18} color="var(--accent-primary)" /> Customize {customizingDish.name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  For Table: <strong>{selectedTable?.table_number}</strong> • Base Price: ₹{parseFloat(customizingDish.price || 0).toFixed(2)}
                </span>
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
                  <div key={group.id} style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{group.name}</span>
                      <span className={`badge ${group.min_selectable > 0 ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '0.7rem' }}>
                        {group.min_selectable > 0 ? 'Required' : 'Optional (Max ' + (group.max_selectable || 'Any') + ')'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(group.options || []).map(opt => {
                        const isChecked = groupSelected.some(o => o.id === opt.id);

                        return (
                          <label
                            key={opt.id}
                            style={{
                              fontSize: '0.82rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              background: isChecked ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-primary)',
                              border: isChecked ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <input
                                type={isSingle ? "radio" : "checkbox"}
                                name={`table_grp_${group.id}`}
                                checked={isChecked}
                                onChange={() => {
                                  if (isSingle) {
                                    setSelectedAddons({ ...selectedAddons, [group.id]: [opt] });
                                  } else {
                                    if (isChecked) {
                                      setSelectedAddons({ ...selectedAddons, [group.id]: groupSelected.filter(o => o.id !== opt.id) });
                                    } else {
                                      if (groupSelected.length < (group.max_selectable || 99)) {
                                        setSelectedAddons({ ...selectedAddons, [group.id]: [...groupSelected, opt] });
                                      } else {
                                        addToast('warning', 'Limit Reached', `You can select maximum ${group.max_selectable} options for ${group.name}`);
                                      }
                                    }
                                  }
                                }}
                              />
                              <span style={{ fontWeight: isChecked ? 700 : 500 }}>{opt.name}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: parseFloat(opt.price || 0) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setCustomizingQty(q => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Minus size={14} />
                </button>
                <span style={{ fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>{customizingQty}</span>
                <button type="button" onClick={() => setCustomizingQty(q => q + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Plus size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmTableCustomization}
                disabled={addingOrder}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
              >
                {addingOrder ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add to Table • ₹{((parseFloat(customizingDish?.price || 0) + Object.values(selectedAddons || {}).flat().reduce((s, o) => s + (parseFloat(o?.price || 0)), 0)) * customizingQty).toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
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

            {(() => {
              const restId = selectedRestaurant?.id || qrModalTable.restaurant_id || '';
              const tableSlug = qrModalTable.table_number || qrModalTable.id;
              const tableOrderUrl = restId
                ? `${window.location.origin}/order/restaurant/${restId}/table/${encodeURIComponent(tableSlug)}`
                : `${window.location.origin}/order/table/${encodeURIComponent(tableSlug)}`;
              const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tableOrderUrl)}`;
              const qrPrintUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableOrderUrl)}`;

              return (
                <>
                  <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '1.25rem' }}>
                    <img
                      src={qrImgUrl}
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
                                <img src="${qrPrintUrl}" class="qr-img" />
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
                        navigator.clipboard.writeText(tableOrderUrl);
                        addToast('success', 'Link Copied', `Customer menu link for ${qrModalTable.table_number} copied!`);
                      }}
                      className="btn btn-secondary"
                      style={{ width: '100%' }}
                    >
                      📋 Copy Customer Menu Link
                    </button>

                    <a
                      href={tableOrderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                      style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
                    >
                      🌐 Test Customer Menu in New Tab ({qrModalTable.table_number})
                    </a>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};
