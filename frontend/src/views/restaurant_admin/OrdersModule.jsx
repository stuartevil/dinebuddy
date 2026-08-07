import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { Layers, Clock, CheckCircle2, Eye, CreditCard, XCircle, AlertTriangle, X } from 'lucide-react';

export const OrdersModule = () => {
  const { selectedRestaurant, addToast } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Cancel Order Modal State
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetchOrders = () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    api.get(`/restaurants/${selectedRestaurant.id}/orders`)
      .then(res => {
        setOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error("Fetch orders error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000); // auto refresh every 8 seconds for live POS orders
    return () => clearInterval(interval);
  }, [selectedRestaurant]);

  const handleUpdateStatus = async (id, newStatus, reason = '') => {
    try {
      await api.patch(`/orders/${id}/status`, {
        status: newStatus,
        cancellation_reason: reason || undefined,
      });

      addToast(newStatus === 'cancelled' ? 'error' : 'info', 
        newStatus === 'cancelled' ? 'Order Cancelled' : 'Order Status Updated', 
        `Order #${id} ${newStatus === 'cancelled' ? `cancelled (${reason || 'No reason specified'})` : `marked as ${newStatus}`}`
      );
      fetchOrders();
    } catch (err) {
      console.error("Update order status error:", err);
      addToast('error', 'Status Update Failed', err.response?.data?.detail || 'Could not update status');
    }
  };

  const submitCancellation = (e) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    handleUpdateStatus(cancellingOrder.id, 'cancelled', cancelReason.trim() || 'Cancelled by staff');
    setCancellingOrder(null);
    setCancelReason('');
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'All') return true;
    const targetStatus = activeTab.toLowerCase().replace(/\s+/g, '_');
    return o.status === targetStatus;
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
        {['All', 'Pending', 'In Kitchen', 'Ready', 'Served', 'Cancelled'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`btn btn-sm ${activeTab === tab ? (tab === 'Cancelled' ? 'btn-danger' : 'btn-primary') : 'btn-secondary'}`}
            style={{ borderRadius: '9999px' }}
          >
            {tab === 'Cancelled' ? `🚫 Cancelled (${orders.filter(o => o.status === 'cancelled').length})` : tab}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {loading && orders.length === 0 ? (
          <div className="panel-card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading live orders from restaurant backend...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="panel-card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No orders found matching status filter "{activeTab}".
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="panel-card" style={{ 
              padding: '1.25rem',
              borderLeft: order.status === 'cancelled' ? '4px solid var(--danger)' : '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{order.order_number || `ORD-${order.id}`}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                    {order.table_number && !order.table_number.toLowerCase().includes('takeaway') ? `Table: ${order.table_number}` : '🥡 Takeaway Order'} • {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                  </span>
                </div>
                <span className={`badge ${
                  (order.status || '').toLowerCase() === 'cancelled' ? 'badge-danger' :
                  (order.status || '').toLowerCase() === 'pending' ? 'badge-warning' : 
                  (order.status || '').toLowerCase() === 'in_kitchen' ? 'badge-info' : 'badge-success'
                }`}>
                  {(order.status || 'PENDING').toUpperCase()}
                </span>
              </div>

              {/* Items Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.85rem 0', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                {(order.items || []).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.quantity || item.qty || 1}x {item.name || 'Item'} {item.special_instructions ? `(${item.special_instructions})` : ''}</span>
                    <span style={{ fontWeight: 700 }}>₹{parseFloat(item.total_price || (item.unit_price * (item.quantity || 1)) || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {order.status === 'cancelled' && (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '0.78rem', color: 'var(--danger)', marginBottom: '0.85rem' }}>
                  <strong>Cancellation Reason:</strong> {order.cancellation_reason || 'Customer requested / Out of stock'}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                <span>Total Amount</span>
                <span style={{ color: order.status === 'cancelled' ? 'var(--text-muted)' : 'var(--success)', textDecoration: order.status === 'cancelled' ? 'line-through' : 'none' }}>
                  ₹{parseFloat(order.total || 0).toFixed(2)}
                </span>
              </div>

              {/* Action Steppers & Cancel Button */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {order.status === 'pending' && (
                  <button onClick={() => handleUpdateStatus(order.id, 'in_kitchen')} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    Send to Kitchen
                  </button>
                )}
                {order.status === 'in_kitchen' && (
                  <button onClick={() => handleUpdateStatus(order.id, 'ready')} className="btn btn-success btn-sm" style={{ flex: 1 }}>
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button onClick={() => handleUpdateStatus(order.id, 'served')} className="btn btn-success btn-sm" style={{ flex: 1 }}>
                    Mark Served
                  </button>
                )}
                {order.status !== 'cancelled' && order.status !== 'served' && (
                  <button onClick={() => setCancellingOrder(order)} className="btn btn-danger btn-sm" style={{ padding: '0.4rem 0.75rem' }} title="Cancel Order">
                    <XCircle size={14} /> Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cancel Order Reason Modal */}
      {cancellingOrder && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} /> Cancel Order {cancellingOrder.id}?
              </h3>
              <button onClick={() => setCancellingOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Cancelling this order will remove its items from running bill and log it into the <strong>Cancelled Orders</strong> directory.
            </p>

            <form onSubmit={submitCancellation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Cancellation Reason *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Customer changed mind / Out of stock" 
                  className="input-control" 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setCancellingOrder(null)} className="btn btn-secondary btn-sm">
                  Close
                </button>
                <button type="submit" className="btn btn-danger btn-sm">
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
