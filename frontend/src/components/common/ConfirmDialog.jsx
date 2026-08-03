import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog = () => {
  const { confirmConfig, closeConfirm } = useAuth();

  if (!confirmConfig) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: '1.2rem' }}>{confirmConfig.title}</h3>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          {confirmConfig.message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={closeConfirm} className="btn btn-secondary">
            Cancel
          </button>
          <button 
            onClick={() => {
              if (confirmConfig.onConfirm) confirmConfig.onConfirm();
              closeConfirm();
            }} 
            className="btn btn-danger"
          >
            {confirmConfig.confirmText || 'Confirm Action'}
          </button>
        </div>
      </div>
    </div>
  );
};
