import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { MonitorPlay, Clock, CheckCircle2, Play } from 'lucide-react';

export const KDSView = () => {
  const { selectedRestaurant, addToast } = useAuth();
  const [orders, setOrders] = useState([]);

  const fetchOrders = () => {
    if (!selectedRestaurant) return;
    api.get(`/restaurants/${selectedRestaurant.id}/orders`)
      .then(res => {
        setOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error("KDS fetch orders error:", err);
      });
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // 5 sec live poll for Kitchen Display
    return () => clearInterval(interval);
  }, [selectedRestaurant]);

  const moveOrder = async (id, nextStatus) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: nextStatus });
      addToast('info', 'KDS Ticket Updated', `Order #${id} moved to ${nextStatus.toUpperCase()}`);
      fetchOrders();
    } catch (err) {
      console.error("KDS move order error:", err);
      addToast('error', 'Status Update Failed', err.response?.data?.detail || 'Could not update status');
    }
  };

  const newOrders = orders.filter(o => o.status === 'pending');
  const kitchenOrders = orders.filter(o => o.status === 'in_kitchen');
  const readyOrders = orders.filter(o => o.status === 'ready' || o.status === 'served');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 'calc(100vh - 140px)' }}>
      
      {/* Header */}
      <div className="panel-card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MonitorPlay size={24} color="var(--accent-primary)" /> Kitchen Display System (KDS)
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Real-time kitchen ticket pipeline. High readability for chef kitchen screens.
            </p>
          </div>

          <span className="badge badge-success" style={{ padding: '0.4rem 0.8rem' }}>KDS LIVE SYSTEM ONLINE</span>
        </div>
      </div>

      {/* 3-Column KDS Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', flex: 1 }}>
        
        {/* Column 1: NEW / PENDING */}
        <div className="panel-card" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--warning)', display: 'flex', justifyContent: 'space-between' }}>
            <span>NEW TICKETS</span>
            <span className="badge badge-warning">{newOrders.length}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {newOrders.map(order => (
              <div key={order.id} className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid var(--warning)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                  <span>{order.table_number && !order.table_number.toLowerCase().includes('takeaway') ? `Table ${order.table_number}` : '🥡 TAKEAWAY'}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Ticket {order.order_number || `ORD-${order.id}`}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.5rem 0' }}>
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                      • {item.quantity || item.qty || 1}x {item.name || 'Item'} {item.special_instructions ? `(${item.special_instructions})` : ''}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button onClick={() => moveOrder(order.id, 'in_kitchen')} className="btn btn-primary" style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}>
                    <Play size={16} /> START PREPARING
                  </button>
                  <button onClick={() => moveOrder(order.id, 'cancelled')} className="btn btn-danger btn-sm" title="Reject / Out of Stock">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: IN KITCHEN */}
        <div className="panel-card" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>IN KITCHEN (PREPARING)</span>
            <span className="badge badge-role">{kitchenOrders.length}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {kitchenOrders.map(order => (
              <div key={order.id} className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                  <span>{order.table_number && !order.table_number.toLowerCase().includes('takeaway') ? `Table ${order.table_number}` : '🥡 TAKEAWAY'}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Ticket {order.order_number || `ORD-${order.id}`}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.5rem 0' }}>
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                      • {item.quantity || item.qty || 1}x {item.name || 'Item'} {item.special_instructions ? `(${item.special_instructions})` : ''}
                    </div>
                  ))}
                </div>

                <button onClick={() => moveOrder(order.id, 'ready')} className="btn btn-success" style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem', fontSize: '0.95rem' }}>
                  <CheckCircle2 size={16} /> MARK READY
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: READY */}
        <div className="panel-card" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--success)', display: 'flex', justifyContent: 'space-between' }}>
            <span>READY TO SERVE</span>
            <span className="badge badge-success">{readyOrders.length}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {readyOrders.map(order => (
              <div key={order.id} className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                  <span>{order.table_number && !order.table_number.toLowerCase().includes('takeaway') ? `Table ${order.table_number}` : '🥡 TAKEAWAY'}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Ticket {order.order_number || `ORD-${order.id}`}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.5rem 0' }}>
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      • {item.quantity || item.qty || 1}x {item.name || 'Item'}
                    </div>
                  ))}
                </div>

                <button onClick={() => moveOrder(order.id, 'served')} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.75rem' }}>
                  Mark Served
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
