import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_DATA } from '../../services/apiClient';
import { QrCode, Layers, MonitorPlay, Receipt, CheckCircle, ArrowRight } from 'lucide-react';

export const StaffDashboard = ({ setActiveRoute }) => {
  const { currentUser, selectedRestaurant } = useAuth();

  const openTablesCount = DEMO_DATA.tables.filter(t => t.status === 'occupied').length;
  const pendingOrdersCount = DEMO_DATA.orders.filter(o => o.status === 'pending').length;
  const kitchenOrdersCount = DEMO_DATA.orders.filter(o => o.status === 'in_kitchen').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Greeting Banner */}
      <div className="panel-card" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(19, 27, 46, 0.9))' }}>
        <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>
          👨‍🍳 {selectedRestaurant.name} • OPERATIONAL STAFF PORTAL
        </span>
        <h1 style={{ fontSize: '1.8rem' }}>Good Afternoon, {currentUser ? currentUser.name : 'Staff Member'}!</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Speed-optimized operational task center for cashiers, waiters, and kitchen chefs.
        </p>

        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveRoute('/staff/pos')} className="btn btn-primary btn-lg" style={{ padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 800 }}>
            ⚡ OPEN POS TERMINAL <ArrowRight size={18} />
          </button>
          <button onClick={() => setActiveRoute('/staff/tables')} className="btn btn-secondary" style={{ padding: '0.85rem 1.25rem' }}>
            🪑 VIEW TABLE FLOOR PLAN
          </button>
        </div>
      </div>

      {/* Operational Task Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        <div className="panel-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>OPEN DINING TABLES</span>
            <QrCode size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.5rem' }}>{openTablesCount} Tables</div>
          <button onClick={() => setActiveRoute('/staff/tables')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Manage Tables →
          </button>
        </div>

        <div className="panel-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>PENDING ORDERS</span>
            <Layers size={20} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--warning)' }}>{pendingOrdersCount} Orders</div>
          <button onClick={() => setActiveRoute('/staff/orders')} style={{ background: 'none', border: 'none', color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Process Orders →
          </button>
        </div>

        <div className="panel-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>KITCHEN ORDERS (KDS)</span>
            <MonitorPlay size={20} color="var(--info)" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--info)' }}>{kitchenOrdersCount} In Kitchen</div>
          <button onClick={() => setActiveRoute('/staff/kitchen')} style={{ background: 'none', border: 'none', color: 'var(--info)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Open KDS Screen →
          </button>
        </div>

      </div>

    </div>
  );
};
