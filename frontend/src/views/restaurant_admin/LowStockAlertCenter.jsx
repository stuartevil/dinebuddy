import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_DATA } from '../../services/apiClient';
import { AlertTriangle, Plus, ShoppingCart, CheckCircle2 } from 'lucide-react';

export const LowStockAlertCenter = ({ setActiveRoute }) => {
  const { addToast } = useAuth();
  const alertItems = DEMO_DATA.ingredients.filter(i => i.is_low_stock || i.is_out_of_stock);

  const handlePurchase = (name) => {
    addToast('success', 'Purchase Order Created', `Purchase order PO-NEW generated for ${name}!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(19, 27, 46, 0.85))' }}>
        <h1 style={{ fontSize: '1.6rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={24} /> Low Stock & Out-of-Stock Alert Center
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Active inventory warnings requiring stock replenishment or purchase orders.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {alertItems.length === 0 ? (
          <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--success)' }}>
            <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem auto' }} />
            <h3>All Ingredients Sufficiently Stocked! 🎉</h3>
          </div>
        ) : (
          alertItems.map(item => (
            <div key={item.id} className="panel-card" style={{ padding: '1.25rem', borderLeft: item.is_out_of_stock ? '4px solid var(--danger)' : '4px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${item.is_out_of_stock ? 'badge-danger' : 'badge-warning'}`}>
                      {item.is_out_of_stock ? '🔴 OUT OF STOCK' : '⚠️ LOW STOCK'}
                    </span>
                    <h3 style={{ fontSize: '1.2rem' }}>{item.name}</h3>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Current Stock: <strong>{item.current_stock_qty} {item.unit}</strong> • Minimum Threshold: <strong>{item.reorder_threshold} {item.unit}</strong> • Suggested Reorder Qty: <strong>{item.reorder_qty} {item.unit}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => handlePurchase(item.name)} className="btn btn-primary">
                    <ShoppingCart size={16} /> Create Purchase Order
                  </button>
                  <button onClick={() => setActiveRoute('/restaurant/transactions')} className="btn btn-secondary">
                    <Plus size={16} /> Add Stock Manually
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
