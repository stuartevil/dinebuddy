import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_DATA } from '../../services/apiClient';
import { History, Plus, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const StockTransactions = () => {
  const { addToast } = useAuth();
  const [transactions, setTransactions] = useState(DEMO_DATA.transactions);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ingredient_id: 1, type: 'Purchase', quantity: '10.0', reference: 'PO-9912' });

  const handleRecord = (e) => {
    e.preventDefault();
    const ing = DEMO_DATA.ingredients.find(i => i.id === Number(form.ingredient_id));
    const qty = parseFloat(form.quantity);
    const signedQty = form.type === 'Purchase' ? Math.abs(qty) : -Math.abs(qty);

    const created = {
      id: Date.now(),
      ingredient_name: ing ? ing.name : 'Ingredient',
      type: form.type,
      quantity: `${signedQty > 0 ? '+' : ''}${signedQty.toFixed(3)}`,
      before: '5.000',
      after: (5.0 + signedQty).toFixed(3),
      user: 'Vikram Singh',
      reference: form.reference || 'PO-MANUAL',
      date: new Date().toISOString(),
    };

    setTransactions(prev => [created, ...prev]);
    setShowModal(false);
    addToast('success', 'Stock Movement Recorded', `${form.type} transaction recorded for ${created.ingredient_name}!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={24} color="var(--accent-primary)" /> Stock Audit Transactions Log
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Complete audit history of Purchase restocks, Spoilage wastage, Audit adjustments, and Auto-Sale deductions.
            </p>
          </div>

          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={16} /> Record Stock Movement
          </button>
        </div>
      </div>

      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Ingredient</th>
                <th>Transaction Type</th>
                <th>Quantity</th>
                <th>Stock Before</th>
                <th>Stock After</th>
                <th>User / System</th>
                <th>Reference ID</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(tx.date).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tx.ingredient_name}</td>
                  <td>
                    <span className={`badge ${tx.type === 'Purchase' ? 'badge-success' : tx.type === 'Wastage' ? 'badge-danger' : tx.type === 'Sale_Deduction' ? 'badge-info' : 'badge-warning'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800, color: parseFloat(tx.quantity) > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.quantity}
                  </td>
                  <td>{tx.before}</td>
                  <td style={{ fontWeight: 700 }}>{tx.after}</td>
                  <td>{tx.user}</td>
                  <td><code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{tx.reference}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 style={{ marginBottom: '1rem' }}>Record Stock Transaction</h3>
            <form onSubmit={handleRecord} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Transaction Type *</label>
                <select className="select-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="Purchase">Purchase (Add Stock)</option>
                  <option value="Wastage">Wastage / Spoilage (Deduct Stock)</option>
                  <option value="Adjustment">Audit Adjustment</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Ingredient *</label>
                <select className="select-control" value={form.ingredient_id} onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}>
                  {DEMO_DATA.ingredients.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Quantity *</label>
                <input type="number" step="0.001" required className="input-control" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
