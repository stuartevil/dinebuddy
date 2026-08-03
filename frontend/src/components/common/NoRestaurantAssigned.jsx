import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, ShieldCheck, ArrowRight, Plus } from 'lucide-react';

export const NoRestaurantAssigned = ({ onSwitchToSuperadmin }) => {
  const { logout } = useAuth();

  return (
    <div className="panel-card" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '640px', margin: '4rem auto' }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'var(--warning-bg)',
        border: '1px solid var(--warning-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem auto',
      }}>
        <Building2 size={36} color="var(--warning)" />
      </div>

      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>No Restaurant Found in Database</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
        The platform database currently has <strong>0 onboarded restaurants</strong>. Because no restaurant exists, there is no restaurant dashboard to display.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxWidth: '380px', margin: '0 auto' }}>
        <button onClick={onSwitchToSuperadmin} className="btn btn-primary" style={{ padding: '0.85rem', fontWeight: 800 }}>
          <ShieldCheck size={18} /> Switch to Superadmin to Onboard Restaurant
        </button>

        <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.75rem' }}>
          Log Out
        </button>
      </div>
    </div>
  );
};
