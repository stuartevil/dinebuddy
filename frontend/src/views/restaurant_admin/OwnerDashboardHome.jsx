import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  BarChart2,
  PackageCheck
} from 'lucide-react';

export const OwnerDashboardHome = ({ setActiveRoute }) => {
  const { selectedRestaurant } = useAuth();

  const [loading, setLoading] = useState(true);
  const [salesSummary, setSalesSummary] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [hourlyTrends, setHourlyTrends] = useState([]);

  useEffect(() => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const restId = selectedRestaurant.id;

    Promise.all([
      api.get(`/restaurants/${restId}/reports/sales-summary`, { params: { period: 'today' } }).catch(() => null),
      api.get(`/restaurants/${restId}/reports/profitability`, { params: { period: 'today' } }).catch(() => null),
      api.get(`/restaurants/${restId}/inventory/ingredients`, { params: { low_stock_only: true } }).catch(() => null),
      api.get(`/restaurants/${restId}/reports/hourly-trends`, { params: { period: 'today' } }).catch(() => null),
    ]).then(([summaryRes, profitRes, stockRes, hourlyRes]) => {
      setSalesSummary(summaryRes?.data || null);
      setProfitability(profitRes?.data || null);
      setLowStockItems(Array.isArray(stockRes?.data) ? stockRes.data : stockRes?.data?.data || []);
      setHourlyTrends(Array.isArray(hourlyRes?.data) ? hourlyRes.data : hourlyRes?.data?.data || []);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRestaurant]);

  const todayRevenue = salesSummary?.net_revenue || 0;
  const todayOrders = salesSummary?.total_orders || 0;
  const aov = salesSummary?.average_order_value || 0;
  const grossProfit = profitability?.gross_profit || 0;
  const grossMarginPct = profitability?.gross_margin_percentage || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Greeting Banner */}
      <div className="panel-card" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(19, 27, 46, 0.9))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-role" style={{ marginBottom: '0.5rem' }}>
              🏪 {selectedRestaurant?.name || 'Restaurant'} • BUSINESS OVERVIEW
            </span>
            <h1 style={{ fontSize: '1.8rem' }}>How is your restaurant performing today?</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Real-time sales velocity, order analytics, profit margin ratios, and stock warnings.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setActiveRoute('/restaurant/pos')} className="btn btn-primary">
              ⚡ Open POS Terminal
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading live dashboard metrics from database...
        </div>
      ) : (
        <>
          {/* Top 4 Key Performance Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            
            {/* Today's Revenue */}
            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>TODAY'S REVENUE</span>
                <DollarSign size={20} color="var(--success)" />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)' }}>
                ₹{todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Net sales generated today
              </div>
            </div>

            {/* Today's Orders */}
            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>TODAY'S ORDERS</span>
                <ShoppingBag size={20} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem' }}>
                {todayOrders}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Completed orders today
              </div>
            </div>

            {/* Average Order Value */}
            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>AVERAGE ORDER VALUE</span>
                <TrendingUp size={20} color="var(--info)" />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem' }}>
                ₹{aov.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Per order basket average
              </div>
            </div>

            {/* Gross Profit & Margin % */}
            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>GROSS PROFIT (COGS)</span>
                <DollarSign size={20} color="var(--success)" />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)' }}>
                ₹{grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 700 }}>
                {grossMarginPct.toFixed(1)}% Gross Margin
              </div>
            </div>

          </div>

          {/* Lower Row Widgets: Low Stock Warning & Rush Hours Heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            
            {/* Low Stock Alert Widget */}
            <div className="panel-card" style={{ padding: '1.5rem', borderLeft: `4px solid ${lowStockItems.length > 0 ? 'var(--warning)' : 'var(--success)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: lowStockItems.length > 0 ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} /> Low Stock Warnings ({lowStockItems.length})
                </h3>
                <button onClick={() => setActiveRoute('/restaurant/inventory')} className="btn btn-secondary btn-sm">
                  View Inventory <ChevronRight size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {lowStockItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    <PackageCheck size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                    <div>All inventory levels are healthy</div>
                  </div>
                ) : (
                  lowStockItems.slice(0, 4).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.name}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Current: {item.current_stock} {item.unit} / Min: {item.reorder_threshold || 0} {item.unit}
                        </span>
                      </div>
                      <span className={`badge ${item.current_stock === 0 ? 'badge-danger' : 'badge-warning'}`}>
                        {item.current_stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Rush Hours Heatmap */}
            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="var(--accent-primary)" /> Today's Rush Hours Trend
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hourly Orders</span>
              </div>

              {hourlyTrends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                  No order activity recorded today yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '0.5rem', textAlign: 'center' }}>
                  {hourlyTrends.slice(0, 6).map((h, i) => (
                    <div key={i} style={{ padding: '0.75rem 0.35rem', background: h.total_orders > 10 ? 'var(--accent-glow)' : 'var(--bg-secondary)', border: `1px solid ${h.total_orders > 10 ? 'var(--accent-primary)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.hour_label || `${h.hour}:00`}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: h.total_orders > 10 ? 'var(--accent-primary)' : 'var(--text-primary)', marginTop: '2px' }}>{h.total_orders || 0}</div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>orders</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
};
