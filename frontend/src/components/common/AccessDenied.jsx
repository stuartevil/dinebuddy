import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const AccessDenied = ({ onGoBack }) => {
  return (
    <div className="panel-card" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '3rem auto' }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem auto',
      }}>
        <ShieldAlert size={34} color="var(--danger)" />
      </div>

      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '0.25rem' }}>403</h1>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Access Forbidden</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        You don't have permission to access this module. Your current user role is not authorized to view financial or administrative resources.
      </p>

      {onGoBack && (
        <button onClick={onGoBack} className="btn btn-primary" style={{ margin: '0 auto' }}>
          <ArrowLeft size={16} /> Return to Permitted Dashboard
        </button>
      )}
    </div>
  );
};
