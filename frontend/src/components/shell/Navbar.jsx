import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Utensils, 
  Store, 
  Search, 
  Bell, 
  Sun, 
  Moon, 
  LogOut, 
  AlertTriangle,
  X,
  Package
} from 'lucide-react';
import { api } from '../../services/apiClient';

export const Navbar = () => {
  const { 
    currentUser, 
    logout, 
    activeRole, 
    restaurants, 
    selectedRestaurant, 
    switchRestaurant, 
    theme, 
    toggleTheme, 
    isSuperadmin,
    ROLES 
  } = useAuth();

  const [showAlertsPopover, setShowAlertsPopover] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);

  // Fetch real low-stock alerts from backend whenever restaurant changes
  useEffect(() => {
    if (!selectedRestaurant) {
      setLowStockAlerts([]);
      return;
    }
    api
      .get(`/restaurants/${selectedRestaurant.id}/inventory/ingredients`, {
        params: { low_stock_only: true, limit: 10 },
      })
      .then((res) => setLowStockAlerts(res.data || []))
      .catch(() => setLowStockAlerts([]));
  }, [selectedRestaurant]);

  const getRoleLabel = (role) => {
    switch (role) {
      case ROLES.SUPERADMIN: return 'Platform Superadmin';
      case ROLES.RESTAURANT_ADMIN: return 'Restaurant Owner';
      case ROLES.RESTAURANT_STAFF: return 'Staff Cashier / Chef';
      case ROLES.CUSTOMER: return 'Customer QR';
      default: return 'User';
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case ROLES.SUPERADMIN: return 'badge-danger';
      case ROLES.RESTAURANT_ADMIN: return 'badge-role';
      case ROLES.RESTAURANT_STAFF: return 'badge-success';
      case ROLES.CUSTOMER: return 'badge-warning';
      default: return 'badge-info';
    }
  };

  return (
    <header className="panel-card" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '0.85rem 2rem', position: 'relative', zIndex: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Left: Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
          }}>
            <Utensils size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', lineHeight: '1.1' }}>DineBuddy</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Restaurant Management OS</span>
          </div>
        </div>

        {/* Center: Restaurant Selector & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '600px', margin: '0 1rem' }}>
          
          {/* Multi-Tenant Restaurant Selector */}
          {activeRole !== ROLES.CUSTOMER && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', width: '220px' }}>
              <Store size={16} color="var(--accent-primary)" />
              <select 
                value={selectedRestaurant ? selectedRestaurant.id : 0} 
                onChange={(e) => switchRestaurant(Number(e.target.value))}

                disabled={!isSuperadmin}
                className="select-control"
                style={{ border: 'none', background: 'transparent', padding: '0.2rem 0.2rem', fontSize: '0.85rem', fontWeight: 700, cursor: isSuperadmin ? 'pointer' : 'default' }}
                title={!isSuperadmin ? "Multi-tenant isolation: Restricted to your assigned restaurant" : "Select restaurant to inspect"}
              >
                {restaurants.length === 0 ? (
                  <option value={0} style={{ background: '#131b2e', color: '#fff' }}>No Restaurants (DB Empty)</option>
                ) : (
                  restaurants.map(r => (
                    <option key={r.id} value={r.id} style={{ background: '#131b2e', color: '#fff' }}>{r.name}</option>
                  ))
                )}
              </select>

            </div>
          )}

          {/* Global Search Bar */}
          {activeRole !== ROLES.CUSTOMER && (
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Global search orders, items, inventory..." 
                className="input-control" 
                style={{ paddingLeft: '2.2rem', padding: '0.45rem 0.85rem 0.45rem 2.2rem', fontSize: '0.85rem' }} 
              />
            </div>
          )}
        </div>

        {/* Right: Notifications, User Profile & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          
          {/* Role Badge & User Name */}
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'var(--bg-secondary)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {currentUser.avatar}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: '1.1' }}>{currentUser.name}</div>
                <span className={`badge ${getRoleBadgeStyle(currentUser.role)}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', marginTop: '2px' }}>
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
            </div>
          )}

          {/* Low Stock Notifications Bell */}
          {activeRole !== ROLES.CUSTOMER && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowAlertsPopover(!showAlertsPopover)}
                className="btn btn-secondary btn-icon"
                title="Low Stock Alerts"
              >
                <Bell size={18} />
                {/* Only show badge if there are real alerts from DB */}
                {lowStockAlerts.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: 'var(--warning)',
                    color: '#000',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {lowStockAlerts.length}
                  </span>
                )}
              </button>

              {showAlertsPopover && (
                <div className="panel-card" style={{
                  position: 'fixed',
                  right: '1.5rem',
                  top: '70px',
                  width: '320px',
                  padding: '1rem',
                  zIndex: 9999,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={16} color="var(--warning)" /> Low Stock Alerts
                      {lowStockAlerts.length > 0 && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{lowStockAlerts.length}</span>
                      )}
                    </h4>
                    <button onClick={() => setShowAlertsPopover(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    {lowStockAlerts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                        <Package size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                        <div>No low stock alerts</div>
                        <div style={{ fontSize: '0.72rem', marginTop: '0.25rem' }}>All inventory levels are healthy</div>
                      </div>
                    ) : (
                      lowStockAlerts.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '0.6rem',
                            background: item.current_stock === 0 ? 'var(--danger-bg)' : 'var(--warning-bg)',
                            border: `1px solid ${item.current_stock === 0 ? 'var(--danger-border)' : 'var(--warning-border)'}`,
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <strong>{item.name}</strong>:{' '}
                          {item.current_stock === 0
                            ? 'Out of stock'
                            : `${item.current_stock} ${item.unit} remaining`}
                          {item.reorder_threshold && item.current_stock > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                              {' '}(Min: {item.reorder_threshold} {item.unit})
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="btn btn-secondary btn-icon" title="Toggle Theme">
            {theme === 'dark' ? <Sun size={18} color="var(--warning)" /> : <Moon size={18} color="var(--accent-primary)" />}
          </button>

          {/* Logout */}
          <button onClick={logout} className="btn btn-danger btn-sm" title="Log Out">
            <LogOut size={16} /> Logout
          </button>
        </div>

      </div>
    </header>
  );
};
