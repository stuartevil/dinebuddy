import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_DATA } from '../../services/apiClient';
import { Layers, Clock, CheckCircle2, Eye, CreditCard } from 'lucide-react';

export const OrdersModule = () => {
  const { addToast } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [orders, setOrders] = useState(DEMO_DATA.orders);

  const handleUpdateStatus = (id, newStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    addToast('info', 'Order Status Updated', `Order ${id} marked as ${newStatus}`);
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'All') return true;
    return o.status === activeTab.toLowerCase().replace(/\s+/g, '_');
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <h1 style={{ fontSize: '1.6rem' }}>Orders Management Module</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Filter and process live restaurant dining, takeaway, and QR orders.
        </p>
      </div>

      {/* Tabs Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {['All', 'Pending', 'In Kitchen', 'Ready', 'Served', 'Completed', 'Cancelled'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '9999px' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {filteredOrders.length === 0 ? (
          <div className="panel-card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No orders found matching status filter "{activeTab}".
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{order.id}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Table: {order.table_number} • {order.time}</span>
                </div>
                <span className={`badge ${order.status === 'pending' ? 'badge-warning' : order.status === 'in_kitchen' ? 'badge-info' : 'badge-success'}`}>
                  {order.status}
                </span>
              </div>

              {/* Items Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.85rem 0', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.qty}x {item.name}</span>
                    <span style={{ fontWeight: 700 }}>₹{(item.qty * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                <span>Total ({order.payment})</span>
                <span style={{ color: 'var(--success)' }}>₹{order.total.toFixed(2)}</span>
              </div>

              {/* Action Steppers */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {order.status === 'pending' && (
                  <button onClick={() => handleUpdateStatus(order.id, 'in_kitchen')} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                    Send to Kitchen
                  </button>
                )}
                {order.status === 'in_kitchen' && (
                  <button onClick={() => handleUpdateStatus(order.id, 'ready')} className="btn btn-success btn-sm" style={{ width: '100%' }}>
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button onClick={() => handleUpdateStatus(order.id, 'served')} className="btn btn-success btn-sm" style={{ width: '100%' }}>
                    Mark Served
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
