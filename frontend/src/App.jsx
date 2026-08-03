import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, ROLES } from './context/AuthContext';
import { LoginScreen } from './views/auth/LoginScreen';
import { Navbar } from './components/shell/Navbar';
import { Sidebar } from './components/shell/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { AccessDenied } from './components/common/AccessDenied';
import { NoRestaurantAssigned } from './components/common/NoRestaurantAssigned';

// View Imports — only views backed by actual backend endpoints
import { SuperadminDashboard } from './views/superadmin/SuperadminDashboard';
import { OwnerDashboardHome } from './views/restaurant_admin/OwnerDashboardHome';
import { POSScreen } from './views/restaurant_admin/POSScreen';
import { TableManagement } from './views/restaurant_admin/TableManagement';
import { OrdersModule } from './views/restaurant_admin/OrdersModule';
import { KDSView } from './views/restaurant_admin/KDSView';
import { MenuManagement } from './views/restaurant_admin/MenuManagement';
import { RecipeBOMManagement } from './views/restaurant_admin/RecipeBOMManagement';
import { InventoryDashboard } from './views/restaurant_admin/InventoryDashboard';
import { StockTransactions } from './views/restaurant_admin/StockTransactions';
import { LowStockAlertCenter } from './views/restaurant_admin/LowStockAlertCenter';
import { ReportsAnalytics } from './views/restaurant_admin/ReportsAnalytics';
import { StaffManagement } from './views/restaurant_admin/StaffManagement';
import { RestaurantSettings } from './views/restaurant_admin/RestaurantSettings';
import { StaffDashboard } from './views/staff/StaffDashboard';


const ShellContent = () => {
  const { currentUser, activeRole, canAccessReports, canAccessInventory, restaurants, selectedRestaurant } = useAuth();
  const [activeRoute, setActiveRoute] = useState('/restaurant/dashboard');

  // Reset default route when role changes
  useEffect(() => {
    if (!activeRole) return;
    switch (activeRole) {
      case ROLES.SUPERADMIN:
        setActiveRoute('/admin/dashboard');
        break;
      case ROLES.RESTAURANT_ADMIN:
        setActiveRoute('/restaurant/dashboard');
        break;
      case ROLES.RESTAURANT_STAFF:
        setActiveRoute('/staff/dashboard');
        break;
      default:
        setActiveRoute('/restaurant/dashboard');
    }
  }, [activeRole]);

  // Not authenticated → render Login Screen
  if (!currentUser) {
    return <LoginScreen />;
  }

  // Route Resolver & Permission Guard
  const renderResolvedView = () => {

    // 1. SUPERADMIN — platform management
    if (activeRole === ROLES.SUPERADMIN) {
      return <SuperadminDashboard activeRoute={activeRoute} />;
    }

    // 2. Restaurant admin/staff — check if any restaurant exists in DB
    if (!selectedRestaurant || restaurants.length === 0) {
      return <NoRestaurantAssigned />;
    }

    // 3. Route resolution for RESTAURANT_ADMIN & RESTAURANT_STAFF
    switch (activeRoute) {

      case '/restaurant/dashboard':
        return <OwnerDashboardHome setActiveRoute={setActiveRoute} />;

      case '/restaurant/pos':
      case '/staff/pos':
        return <POSScreen />;

      case '/restaurant/orders':
      case '/staff/orders':
        return <OrdersModule />;

      case '/restaurant/tables':
      case '/staff/tables':
        return <TableManagement />;

      case '/restaurant/kitchen':
      case '/staff/kitchen':
        return <KDSView />;

      case '/restaurant/menu':
      case '/staff/menu':
        return <MenuManagement />;

      // Owner-only protected routes (backend: /inventory/, /reports/)
      case '/restaurant/recipes':
        return canAccessInventory
          ? <RecipeBOMManagement />
          : <AccessDenied onGoBack={() => setActiveRoute('/staff/dashboard')} />;

      case '/restaurant/inventory':
        return canAccessInventory
          ? <InventoryDashboard />
          : <AccessDenied onGoBack={() => setActiveRoute('/staff/dashboard')} />;

      case '/restaurant/transactions':
        return canAccessInventory
          ? <StockTransactions />
          : <AccessDenied onGoBack={() => setActiveRoute('/staff/dashboard')} />;

      case '/restaurant/alerts':
        return canAccessInventory
          ? <LowStockAlertCenter setActiveRoute={setActiveRoute} />
          : <AccessDenied onGoBack={() => setActiveRoute('/staff/dashboard')} />;

      case '/restaurant/reports':
        return canAccessReports
          ? <ReportsAnalytics />
          : <AccessDenied onGoBack={() => setActiveRoute('/staff/dashboard')} />;

      case '/restaurant/staff':
        return <StaffManagement />;

      case '/restaurant/settings':
        return <RestaurantSettings />;

      case '/staff/dashboard':
        return <StaffDashboard setActiveRoute={setActiveRoute} />;

      default:
        return activeRole === ROLES.RESTAURANT_STAFF
          ? <StaffDashboard setActiveRoute={setActiveRoute} />
          : <OwnerDashboardHome setActiveRoute={setActiveRoute} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeRoute={activeRoute} setActiveRoute={setActiveRoute} />
      <div className="main-wrapper">
        <Navbar />
        <main className="content-container">
          {renderResolvedView()}
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ShellContent />
    </AuthProvider>
  );
}
