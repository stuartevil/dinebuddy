import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useAuth();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      maxWidth: '380px',
      width: '100%',
    }}>
      {toasts.map(toast => {
        let border = 'var(--border-color)';
        let bg = 'var(--bg-secondary)';
        let Icon = Info;
        let color = 'var(--accent-primary)';

        if (toast.type === 'success') {
          border = 'var(--success-border)';
          bg = 'rgba(16, 185, 129, 0.18)';
          Icon = CheckCircle;
          color = 'var(--success)';
        } else if (toast.type === 'warning') {
          border = 'var(--warning-border)';
          bg = 'rgba(245, 158, 11, 0.18)';
          Icon = AlertTriangle;
          color = 'var(--warning)';
        } else if (toast.type === 'error') {
          border = 'var(--danger-border)';
          bg = 'rgba(239, 68, 68, 0.18)';
          Icon = XCircle;
          color = 'var(--danger)';
        }

        return (
          <div key={toast.id} className="panel-card" style={{
            padding: '0.85rem 1rem',
            background: bg,
            borderColor: border,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25 ease',
          }}>
            <Icon size={20} color={color} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{toast.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{toast.message}</div>
            </div>
            <button onClick={() => removeToast(toast.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
