import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Utensils, Lock, Mail, Eye, EyeOff, ArrowRight, UserCheck } from 'lucide-react';

export const LoginScreen = () => {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetEmail = email.trim();
    setLoading(true);
    try {
      await login(targetEmail, password);
    } catch {
      // error toast already shown inside login()
    } finally {
      setLoading(false);
    }
  };

  const handlePrefill = async (prefillEmail, prefillPass) => {
    setEmail(prefillEmail);
    setPassword(prefillPass);
    setLoading(true);
    try {
      await login(prefillEmail, prefillPass);
    } catch {
      // error toast already shown inside login()
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.15), transparent 70%), var(--bg-primary)',
      padding: '1.5rem',
    }}>
      <div className="panel-card" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '2.5rem 2rem',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
        border: '1px solid var(--border-color)',
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)',
          }}>
            <Utensils size={30} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>DineBuddy</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Enterprise Restaurant Operating System
          </p>
        </div>

        {/* Credentials Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>Email Address / Username</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                required
                className="input-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="superadmin@dinebuddy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Password reset link sent to your registered email!"); }} style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>Forgot Password?</a>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-control"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              id="remember" 
              checked={rememberMe} 
              onChange={(e) => setRememberMe(e.target.checked)} 
              style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <label htmlFor="remember" style={{ cursor: 'pointer' }}>Remember me on this device</label>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
            {loading ? 'Authenticating & Resolving Role...' : 'Sign In to DineBuddy'} <ArrowRight size={18} />
          </button>
        </form>

        {/* 1-Click Quick Fill Links */}
        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.5rem', paddingTop: '1rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>QUICK PREFILL ACCOUNT:</span>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={() => handlePrefill('admin@dinebuddy.com', 'Admin@123')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              🌐 Superadmin
            </button>
            <button 
              type="button" 
              onClick={() => handlePrefill('owner@thelab93.com', 'Password@123')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              🏪 Owner (The lab93)
            </button>
            <button 
              type="button" 
              onClick={() => handlePrefill('staff@thelab93.com', 'Password@123')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              👨‍🍳 Staff (The lab93)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
