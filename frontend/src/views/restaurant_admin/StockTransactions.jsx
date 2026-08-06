import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { History, Plus, RefreshCw, Filter, Search, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';

export const StockTransactions = () => {
  const { selectedRestaurant, addToast } = useAuth();
  
  const [transactions, setTransactions] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    ingredient_id: '',
    type: 'Purchase',
    quantity: '10.0',
    reference_id: '',
    notes: '',
  });

  // Fetch real stock transactions & ingredients list from backend
  const fetchData = async () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const restId = selectedRestaurant.id;

    try {
      const [txRes, ingRes] = await Promise.all([
        api.get(`/restaurants/${restId}/inventory/transactions`),
        api.get(`/restaurants/${restId}/inventory/ingredients`),
      ]);

      const txList = Array.isArray(txRes.data) ? txRes.data : txRes.data?.data || [];
      const ingList = Array.isArray(ingRes.data) ? ingRes.data : ingRes.data?.data || [];

      setTransactions(txList);
      setIngredients(ingList);

      if (ingList.length > 0 && !form.ingredient_id) {
        setForm(f => ({ ...f, ingredient_id: ingList[0].id }));
      }
    } catch (err) {
      console.warn('Failed to fetch stock transactions:', err.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedRestaurant]);

  // Record Stock Movement to Database
  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant || !form.ingredient_id) {
      addToast('warning', 'Selection Required', 'Please select an active restaurant and ingredient.');
      return;
    }

    const ingId = Number(form.ingredient_id);
    const qtyNum = parseFloat(form.quantity) || 0;
    
    // Purchase is positive restock (+), Wastage is negative deduction (-)
    const signedQty = form.type === 'Wastage' ? -Math.abs(qtyNum) : Math.abs(qtyNum);

    try {
      const restId = selectedRestaurant.id;
      const payload = {
        ingredient_id: ingId,
        type: form.type,
        quantity: signedQty,
        reference_id: form.reference_id || null,
        notes: form.notes || null,
      };

      await api.post(`/restaurants/${restId}/inventory/ingredients/${ingId}/transactions`, payload);
      
      const selectedIng = ingredients.find(i => i.id === ingId);
      addToast('success', 'Stock Movement Recorded', `${form.type} transaction recorded for "${selectedIng?.name || 'Ingredient'}"!`);
      
      setShowModal(false);
      setForm({
        ingredient_id: ingredients[0]?.id || '',
        type: 'Purchase',
        quantity: '10.0',
        reference_id: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      addToast('error', 'Record Failed', err?.response?.data?.detail || err.message);
    }
  };

  const filtered = transactions.filter(tx => {
    const matchType = filterType === 'All' || tx.type === filterType;
    const ingName = tx.ingredient_name || '';
    const refId = tx.reference_id || '';
    const matchSearch = ingName.toLowerCase().includes(search.toLowerCase()) || refId.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Banner */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={24} color="var(--accent-primary)" /> Stock Audit Transactions Log
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Complete audit trail of Purchase restocks, Spoilage wastage, Audit adjustments, and POS Auto-Sale deductions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={fetchData} className="btn btn-secondary" title="Refresh Audit Log">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={() => {
              if (ingredients.length > 0 && !form.ingredient_id) {
                setForm(f => ({ ...f, ingredient_id: ingredients[0].id }));
              }
              setShowModal(true);
            }} className="btn btn-primary">
              <Plus size={16} /> Record Stock Movement
            </button>
          </div>
        </div>
      </div>

      {/* Main Transactions Log Table Card */}
      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by ingredient or ref..." 
              className="input-control" 
              style={{ paddingLeft: '2.2rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="select-control" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '180px' }}>
            <option value="All">All Transaction Types</option>
            <option value="Purchase">Purchase (Restock)</option>
            <option value="Wastage">Wastage (Spoilage)</option>
            <option value="Adjustment">Audit Adjustment</option>
            <option value="Sale_Deduction">POS Sale Deduction</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading stock transaction audit logs from database...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Package size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div>No stock transactions logged yet.</div>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
              <Plus size={14} /> Record First Stock Movement
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Ingredient</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Stock After</th>
                  <th>Staff ID</th>
                  <th>Reference ID</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => {
                  const qtyVal = Number(tx.quantity) || 0;
                  const isPositive = qtyVal > 0;
                  let badgeClass = 'badge-warning';
                  if (tx.type === 'Purchase') badgeClass = 'badge-success';
                  else if (tx.type === 'Wastage') badgeClass = 'badge-danger';
                  else if (tx.type === 'Sale_Deduction') badgeClass = 'badge-role';

                  return (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {tx.ingredient_name || `Ingredient #${tx.ingredient_id}`}
                      </td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                        {isPositive ? '+' : ''}{qtyVal.toFixed(3)}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {Number(tx.stock_after || 0).toFixed(3)}
                      </td>
                      <td>{tx.staff_id ? `Staff #${tx.staff_id}` : 'System'}</td>
                      <td>
                        {tx.reference_id ? (
                          <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            {tx.reference_id}
                          </code>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Stock Movement Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} color="var(--accent-primary)" /> Record Manual Stock Movement
            </h3>

            {ingredients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                No ingredients found in database. Please create raw ingredients first in the <strong>Raw Inventory</strong> section.
                <div style={{ marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Select Raw Ingredient *</label>
                  <select 
                    className="select-control" 
                    value={form.ingredient_id} 
                    onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}
                  >
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit}) — Current: {Number(i.current_stock_qty || 0)} {i.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Transaction Type *</label>
                    <select className="select-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      <option value="Purchase">Purchase (Add Stock)</option>
                      <option value="Wastage">Wastage / Spoilage (Deduct)</option>
                      <option value="Adjustment">Audit Adjustment</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Quantity *</label>
                    <input 
                      type="number" 
                      step="0.001" 
                      min="0.001"
                      required 
                      className="input-control" 
                      value={form.quantity} 
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })} 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Reference ID / Invoice No. (optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. PO-9912 or INV-104"
                    className="input-control" 
                    value={form.reference_id} 
                    onChange={(e) => setForm({ ...form, reference_id: e.target.value })} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Notes (optional)</label>
                  <textarea 
                    rows={2} 
                    placeholder="Reason or invoice note..." 
                    className="input-control" 
                    value={form.notes} 
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Stock Movement</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
