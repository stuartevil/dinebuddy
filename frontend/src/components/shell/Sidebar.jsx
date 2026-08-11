import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMediaUrl } from '../../services/apiClient';
import { 
  LayoutDashboard, 
  Package, 
  AlertTriangle, 
  ChefHat, 
  UtensilsCrossed, 
  QrCode, 
  History, 
  BarChart3, 
  Building2, 
  Users, 
  Receipt, 
  MonitorPlay,
  Layers,
  Settings,
  UserCheck
} from 'lucide-react';

export const Sidebar = ({ activeRoute: customActiveRoute, setActiveRoute: customSetActiveRoute }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRole, selectedRestaurant, ROLES } = useAuth();
  const [logoError, setLogoError] = useState(false);

  const activeRoute = customActiveRoute || location.pathname;
  const handleNavigate = (path) => {
    if (customSetActiveRoute) {
      customSetActiveRoute(path);
    }
    navigate(path);
  };

  useEffect(() => {
    setLogoError(false);
  }, [selectedRestaurant?.id, selectedRestaurant?.logo_url]);

  const getNavigationSchema = () => {
    switch (activeRole) {
      // -------------------------------------------------------
      // SUPERADMIN — only what backend actually supports
      // Endpoints: /restaurants/, /users/me, /user-restaurants/
      // -------------------------------------------------------
      case ROLES.SUPERADMIN:
        return [
          { id: '/admin/dashboard',     label: 'Platform Overview',  icon: LayoutDashboard },
          { id: '/admin/restaurants',   label: 'Restaurants',        icon: Building2 },
          { id: '/admin/users',         label: 'Platform Users',     icon: Users },
        ];

      // -------------------------------------------------------
      // RESTAURANT_ADMIN — all supported backend modules
      // Endpoints: /restaurants/{id}/*, /inventory/*, /reports/*
      //            /tables/, /billing/, /menu-categories/, /menu-items/
      // -------------------------------------------------------
      case ROLES.RESTAURANT_ADMIN:
        return [
          { id: '/restaurant/dashboard',     label: 'Dashboard Home',         icon: LayoutDashboard },
          { id: '/restaurant/pos',           label: 'POS Terminal',           icon: Receipt },
          { id: '/restaurant/orders',        label: 'Orders Module',          icon: Layers },
          { id: '/restaurant/tables',        label: 'Table Management',       icon: QrCode },
          { id: '/restaurant/kitchen',       label: 'Kitchen KDS',            icon: MonitorPlay },
          { id: '/restaurant/menu',          label: 'Menu & Categories',      icon: UtensilsCrossed },
          { id: '/restaurant/recipes',       label: 'Recipes / BOM',          icon: ChefHat },
          { id: '/restaurant/inventory',     label: 'Raw Inventory',          icon: Package },
          { id: '/restaurant/transactions',  label: 'Stock Transactions',     icon: History },
          { id: '/restaurant/alerts',        label: 'Low Stock Alerts',       icon: AlertTriangle },
          { id: '/restaurant/reports',       label: 'Reports & CSV Export',   icon: BarChart3 },
          { id: '/restaurant/staff',         label: 'Staff Management',       icon: Users },
          { id: '/restaurant/settings',      label: 'Restaurant Settings',    icon: Settings },
        ];

      // -------------------------------------------------------
      // RESTAURANT_STAFF — operational access only
      // -------------------------------------------------------
      case ROLES.RESTAURANT_STAFF:
        return [
          { id: '/staff/dashboard', label: 'Operations Dashboard',  icon: LayoutDashboard },
          { id: '/staff/pos',       label: 'POS Billing Desk',      icon: Receipt },
          { id: '/staff/orders',    label: 'Orders Status',         icon: Layers },
          { id: '/staff/tables',    label: 'Table Status',          icon: QrCode },
          { id: '/staff/kitchen',   label: 'Kitchen Display (KDS)', icon: MonitorPlay },
          { id: '/staff/menu',      label: 'View Menu Items',       icon: UtensilsCrossed },
        ];

      default:
        return [];
    }
  };

  const navItems = getNavigationSchema();

  const getPortalTitle = () => {
    switch (activeRole) {
      case ROLES.SUPERADMIN:        return 'SUPERADMIN SHELL';
      case ROLES.RESTAURANT_ADMIN:  return 'RESTAURANT CONTROL ROOM';
      case ROLES.RESTAURANT_STAFF:  return 'STAFF PORTAL';
      default: return 'PORTAL';
    }
  };

  const logoUrl = selectedRestaurant?.logo_url ? getMediaUrl(selectedRestaurant.logo_url) : null;

  return (
    <aside className="panel-card app-sidebar" style={{ width: '260px', borderRadius: 0, borderTop: 0, borderBottom: 0, borderLeft: 0, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      
      {/* Sidebar Header: Full Restaurant Logo Box */}
      <div style={{ padding: '0.25rem 0.25rem 1rem 0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
        {selectedRestaurant && activeRole !== ROLES.SUPERADMIN ? (
          logoUrl && !logoError ? (
            <div style={{
              width: '100%',
              height: '56px',
              borderRadius: '12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.35rem',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <img
                src={logoUrl}
                alt={selectedRestaurant.name}
                onError={() => setLogoError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
              />
            </div>
          ) : (
            <div style={{
              width: '100%',
              height: '56px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem',
              color: '#ffffff',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
            }}>
              {selectedRestaurant.name}
            </div>
          )
        ) : (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {getPortalTitle()}
          </span>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                width: '100%',
                padding: '0.7rem 0.9rem',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderColor: isActive ? 'var(--border-hover)' : 'transparent',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem',
              }}
            >
              <Icon size={18} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
