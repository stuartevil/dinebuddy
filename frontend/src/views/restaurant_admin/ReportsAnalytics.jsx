import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { BarChart3, FileSpreadsheet, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';

export const ReportsAnalytics = () => {
  const { selectedRestaurant, addToast } = useAuth();
  
  const [period, setPeriod] = useState('monthly'); // 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Live state from backend endpoints
  const [salesSummary, setSalesSummary] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [topItems, setTopItems] = useState([]);
  const [categorySales, setCategorySales] = useState([]);

  // Fetch reports whenever selectedRestaurant, period, or custom dates change
  useEffect(() => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const queryParams = { period };
    if (period === 'custom') {
      if (startDate) queryParams.start_date = startDate;
      if (endDate) queryParams.end_date = endDate;
    }

    const restId = selectedRestaurant.id;

    Promise.all([
      api.get(`/restaurants/${restId}/reports/sales-summary`, { params: queryParams }).catch(() => null),
      api.get(`/restaurants/${restId}/reports/profitability`, { params: queryParams }).catch(() => null),
      api.get(`/restaurants/${restId}/reports/top-items`, { params: queryParams }).catch(() => null),
      api.get(`/restaurants/${restId}/reports/category-performance`, { params: queryParams }).catch(() => null),
    ]).then(([summaryRes, profitRes, topRes, catRes]) => {
      setSalesSummary(summaryRes?.data || null);
      setProfitability(profitRes?.data || null);
      setTopItems(topRes?.data || []);
      setCategorySales(catRes?.data || []);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRestaurant, period, startDate, endDate]);

  // CSV Export Action
  const handleCsvExport = async () => {
    if (!selectedRestaurant) return;

    try {
      const queryParams = { period };
      if (period === 'custom') {
        if (startDate) queryParams.start_date = startDate;
        if (endDate) queryParams.end_date = endDate;
      }

      const res = await api.get(`/restaurants/${selectedRestaurant.id}/reports/export/csv`, {
        params: queryParams,
        responseType: 'blob',
      });

      // Create download link from Blob
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dinebuddy_sales_report_${selectedRestaurant.name.toLowerCase().replace(/\s+/g, '_')}_${period}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      addToast('success', 'CSV Report Downloaded', `Exported sales & profitability report (${period})!`);
    } catch (err) {
      addToast('error', 'Export Failed', err?.response?.data?.detail || 'Could not generate CSV report.');
    }
  };

  const grossRev = salesSummary?.gross_revenue || 0;
  const netRev = salesSummary?.net_revenue || 0;
  const totalTax = salesSummary?.total_tax || 0;
  const aov = salesSummary?.average_order_value || 0;

  const netSalesVal = profitability?.net_sales || 0;
  const cogsVal = profitability?.cogs || 0;
  const grossProfitVal = profitability?.gross_profit || 0;
  const grossMarginPctVal = profitability?.gross_margin_percentage || 0;

  const periodLabels = [
    { id: 'today', label: 'Today' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Controls Bar */}
      <div className="panel-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>Period:</span>
            {periodLabels.map(p => (
              <button 
                key={p.id} 
                onClick={() => setPeriod(p.id)}
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
              >
                {p.label}
              </button>
            ))}

            {period === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-control" style={{ width: '140px', padding: '0.3rem 0.5rem' }} />
                <span>→</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-control" style={{ width: '140px', padding: '0.3rem 0.5rem' }} />
              </div>
            )}
          </div>

          <button onClick={handleCsvExport} className="btn btn-success" disabled={!selectedRestaurant}>
            <FileSpreadsheet size={16} /> Export CSV Report
          </button>

        </div>
      </div>

      {loading ? (
        <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Fetching live sales & profitability metrics from backend DB...
        </div>
      ) : (
        <>
          {/* 1. Sales Summary Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>GROSS REVENUE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.35rem' }}>₹{grossRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total order total before tax/discounts</span>
            </div>

            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET REVENUE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--success)' }}>₹{netRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Revenue post tax & discounts</span>
            </div>

            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL TAXES (GST)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.35rem' }}>₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>GST collected</span>
            </div>

            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVERAGE ORDER VALUE (AOV)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.35rem' }}>₹{aov.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Per order average</span>
            </div>
          </div>

          {/* 2. Profitability (COGS vs Gross Margin %) */}
          <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(19, 27, 46, 0.85))' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={20} color="var(--success)" /> Profitability & COGS Margin Analysis
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net Sales</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{netSalesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Cost of Goods Sold (COGS)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>₹{cogsVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Gross Profit</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>₹{grossProfitVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Gross Margin %</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{grossMarginPctVal.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* 3. Top Items & Category Performance Tables Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            
            {/* Top Items Table */}
            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Top Selling Items Ranking</h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Item Name</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                          No sales data recorded for this period yet.
                        </td>
                      </tr>
                    ) : (
                      topItems.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 800 }}>#{item.rank || idx + 1}</td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.item_name || item.menu_item_name || 'Dish Item'}</td>
                          <td>{item.quantity_sold ?? item.total_quantity_sold ?? 0} sold</td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{parseFloat(item.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Performance */}
            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Category Sales Distribution</h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Sales Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorySales.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                          No category sales data recorded for this period yet.
                        </td>
                      </tr>
                    ) : (
                      categorySales.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.category_name}</td>
                          <td>{row.total_orders || 0}</td>
                          <td style={{ fontWeight: 700 }}>₹{(row.total_revenue || 0).toLocaleString('en-IN')}</td>
                          <td><span className="badge badge-role">{(row.sales_share_percentage || 0).toFixed(1)}%</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
};
