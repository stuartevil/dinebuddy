import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, ROLES } from './context/AuthContext';
import { LoginScreen } from './views/auth/LoginScreen';
import { Navbar } from './components/shell/Navbar';
import { Sidebar } from './components/shell/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { AccessDenied } from './components/common/AccessDenied';
import { NoRestaurantAssigned } from './components/common/NoRestaurantAssigned';

// View Imports — views backed by actual backend endpoints
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
import { CustomerQRApp } from './views/customer/CustomerQRApp';

const ShellContent = () => {
  const { currentUser, activeRole, canAccessReports, canAccessInventory, restaurants, selectedRestaurant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Public routes check (Customer QR Menu)
  const isCustomerPublicRoute = location.pathname.startsWith('/order/table/') || location.pathname.startsWith('/menu/');

  if (isCustomerPublicRoute) {
    return (
      <Routes>
        <Route path="/order/table/:tableId" element={<CustomerQRApp />} />
        <Route path="/menu/:tableId" element={<CustomerQRApp />} />
      </Routes>
    );
  }

  const handleNavigate = (path) => {
    navigate(path);
  };


  // Default route resolver by role
  const getDefaultRoute = () => {
    switch (activeRole) {
      case ROLES.SUPERADMIN:
        return '/admin/dashboard';
      case ROLES.RESTAURANT_ADMIN:
        return '/restaurant/dashboard';
      case ROLES.RESTAURANT_STAFF:
        return '/staff/dashboard';
      default:
        return '/restaurant/dashboard';
    }
  };

  // Redirect root or invalid routes when logged in
  useEffect(() => {
    if (currentUser && location.pathname === '/') {
      navigate(getDefaultRoute(), { replace: true });
    }
  }, [currentUser, activeRole, location.pathname]);

  // Not authenticated → render Login Screen
  if (!currentUser) {
    return <LoginScreen />;
  }

  // If on /login while authenticated → redirect to role home
  if (location.pathname === '/login') {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  // Restaurant admin/staff without assigned restaurant
  if (activeRole !== ROLES.SUPERADMIN && (!selectedRestaurant || restaurants.length === 0)) {
    return (
      <div className="app-shell">
        <Sidebar activeRoute={location.pathname} setActiveRoute={handleNavigate} />
        <div className="main-wrapper">
          <Navbar />
          <main className="content-container">
            <NoRestaurantAssigned />
          </main>
        </div>
        <ToastContainer />
        <ConfirmDialog />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar activeRoute={location.pathname} setActiveRoute={handleNavigate} />
      <div className="main-wrapper">
        <Navbar />
        <main className="content-container">
          <Routes>
            {/* SUPERADMIN Routes */}
            {activeRole === ROLES.SUPERADMIN && (
              <Route path="/admin/*" element={<SuperadminDashboard activeRoute={location.pathname} setActiveRoute={handleNavigate} />} />
            )}

            {/* RESTAURANT_ADMIN & RESTAURANT_STAFF Routes */}
            <Route path="/restaurant/dashboard" element={<OwnerDashboardHome setActiveRoute={handleNavigate} />} />
            <Route path="/restaurant/pos" element={<POSScreen />} />
            <Route path="/staff/pos" element={<POSScreen />} />
            <Route path="/restaurant/orders" element={<OrdersModule />} />
            <Route path="/staff/orders" element={<OrdersModule />} />
            <Route path="/restaurant/tables" element={<TableManagement />} />
            <Route path="/staff/tables" element={<TableManagement />} />
            <Route path="/restaurant/kitchen" element={<KDSView />} />
            <Route path="/staff/kitchen" element={<KDSView />} />
            <Route path="/restaurant/menu" element={<MenuManagement />} />
            <Route path="/staff/menu" element={<MenuManagement />} />

            {/* Owner-only Protected Routes */}
            <Route path="/restaurant/recipes" element={canAccessInventory ? <RecipeBOMManagement /> : <AccessDenied onGoBack={() => handleNavigate('/staff/dashboard')} />} />
            <Route path="/restaurant/inventory" element={canAccessInventory ? <InventoryDashboard /> : <AccessDenied onGoBack={() => handleNavigate('/staff/dashboard')} />} />
            <Route path="/restaurant/transactions" element={canAccessInventory ? <StockTransactions /> : <AccessDenied onGoBack={() => handleNavigate('/staff/dashboard')} />} />
            <Route path="/restaurant/alerts" element={canAccessInventory ? <LowStockAlertCenter setActiveRoute={handleNavigate} /> : <AccessDenied onGoBack={() => handleNavigate('/staff/dashboard')} />} />
            <Route path="/restaurant/reports" element={canAccessReports ? <ReportsAnalytics /> : <AccessDenied onGoBack={() => handleNavigate('/staff/dashboard')} />} />
            <Route path="/restaurant/staff" element={<StaffManagement />} />
            <Route path="/restaurant/settings" element={<RestaurantSettings />} />

            {/* Staff Dashboard Route */}
            <Route path="/staff/dashboard" element={<StaffDashboard setActiveRoute={handleNavigate} />} />

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
          </Routes>
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

