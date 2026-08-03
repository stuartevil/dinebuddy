import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { Package, Plus, Search, Sliders, Trash2, AlertTriangle } from 'lucide-react';

export const InventoryDashboard = () => {
  const { selectedRestaurant, addToast, requestConfirm } = useAuth();
  
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);

  const [thresholdVal, setThresholdVal] = useState('');
  const [reorderVal, setReorderVal] = useState('');

  // Form state for creating new raw ingredient
  const [form, setForm] = useState({
    name: '',
    category: 'Dairy',
    unit: 'kg',
    current_stock_qty: '0',
    reorder_threshold: '5',
    cost_per_unit: '0',
    supplier_name: '',
  });

  // Fetch real ingredients from backend API
  const fetchIngredients = () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const restId = selectedRestaurant.id;

    api.get(`/restaurants/${restId}/inventory/ingredients`)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setIngredients(list);
      })
      .catch(err => {
        console.warn('Failed to fetch ingredients:', err.message);
        setIngredients([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchIngredients();
  }, [selectedRestaurant]);

  // Create Ingredient in Database
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !selectedRestaurant) return;

    try {
      const payload = {
        name: form.name,
        category: form.category || 'General',
        unit: form.unit || 'kg',
        current_stock_qty: parseFloat(form.current_stock_qty) || 0,
        reorder_threshold: parseFloat(form.reorder_threshold) || 0,
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
        supplier_name: form.supplier_name || null,
      };

      await api.post(`/restaurants/${selectedRestaurant.id}/inventory/ingredients`, payload);
      addToast('success', 'Ingredient Created', `"${form.name}" added to inventory with stock ${form.current_stock_qty} ${form.unit} @ ₹${form.cost_per_unit}/${form.unit}!`);
      
      setShowAddModal(false);
      setForm({
        name: '',
        category: 'Dairy',
        unit: 'kg',
        current_stock_qty: '0',
        reorder_threshold: '5',
        cost_per_unit: '0',
        supplier_name: '',
      });
      fetchIngredients();
    } catch (err) {
      addToast('error', 'Failed to Create Ingredient', err?.response?.data?.detail || err.message);
    }
  };

  // Update Threshold in Database
  const handleThresholdSave = async (e) => {
    e.preventDefault();
    if (!selectedIngredient || !selectedRestaurant) return;

    try {
      await api.patch(`/restaurants/${selectedRestaurant.id}/inventory/ingredients/${selectedIngredient.id}/threshold`, {
        reorder_threshold: parseFloat(thresholdVal) || 0,
        reorder_qty: parseFloat(reorderVal) || 0,
      });

      addToast('success', 'Threshold Saved', `Minimum alert threshold set to ${thresholdVal} ${selectedIngredient.unit}`);
      setShowThresholdModal(false);
      fetchIngredients();
    } catch (err) {
      addToast('error', 'Threshold Update Failed', err?.response?.data?.detail || err.message);
    }
  };

  // Delete Ingredient from Database
  const handleDeleteIngredient = (id, name) => {
    requestConfirm({
      title: `Delete ${name}?`,
      message: `Are you sure you want to delete "${name}" from raw inventory database?`,
      confirmText: 'Delete Ingredient',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurants/${selectedRestaurant.id}/inventory/ingredients/${id}`);
          addToast('success', 'Ingredient Deleted', `"${name}" removed from database.`);
          fetchIngredients();
        } catch (err) {
          addToast('error', 'Delete Failed', err?.response?.data?.detail || err.message);
        }
      }
    });
  };

  const totalIngredients = ingredients.length;
  const totalValuation = ingredients.reduce((sum, i) => sum + ((Number(i.current_stock_qty) || 0) * (Number(i.cost_per_unit) || 0)), 0);
  const lowStockCount = ingredients.filter(i => i.is_low_stock).length;
  const outOfStockCount = ingredients.filter(i => i.is_out_of_stock).length;

  const defaultCategoryList = ['Dairy', 'Coffee', 'Bakery', 'Packaging', 'Syrup', 'General'];
  const dbCategories = Array.from(new Set(ingredients.map(i => i.category).filter(Boolean)));
  const categoryOptions = Array.from(new Set([...defaultCategoryList, ...dbCategories]));

  const filtered = ingredients.filter(i => {
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Banner */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem' }}>Raw Inventory Stock & Thresholds</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Track ingredient levels, enter initial stock & unit cost, set custom alert thresholds, and monitor stock valuation.
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} /> Add Raw Ingredient
          </button>
        </div>
      </div>

      {/* KPI Cards Row (4 Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INGREDIENTS</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem' }}>{totalIngredients}</div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>STOCK VALUATION</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)' }}>₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>LOW STOCK ITEMS</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--warning)' }}>{lowStockCount}</div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>OUT OF STOCK</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--danger)' }}>{outOfStockCount}</div>
        </div>
      </div>

      {/* Inventory Table Card */}
      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search ingredient..." 
              className="input-control" 
              style={{ paddingLeft: '2.2rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="select-control" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: '170px' }}>
            <option value="All">All Categories</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading inventory stock from database...
          </div>
        ) : ingredients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Package size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div>No raw ingredients in inventory yet.</div>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
              <Plus size={14} /> Add First Raw Ingredient
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ingredient & Supplier</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Threshold</th>
                  <th>Status</th>
                  <th>Unit Cost</th>
                  <th>Stock Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => {
                  const currentStock = Number(ing.current_stock_qty) || 0;
                  const threshold = Number(ing.reorder_threshold) || 0;
                  const unitCost = Number(ing.cost_per_unit) || 0;
                  const stockValue = currentStock * unitCost;

                  let statusBadge = 'badge-success';
                  let statusText = 'IN STOCK';
                  if (ing.is_out_of_stock || currentStock === 0) { statusBadge = 'badge-danger'; statusText = 'OUT OF STOCK'; }
                  else if (ing.is_low_stock || (threshold > 0 && currentStock <= threshold)) { statusBadge = 'badge-warning'; statusText = 'LOW STOCK'; }

                  return (
                    <tr key={ing.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ing.name}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Supplier: {ing.supplier_name || '—'}
                        </span>
                      </td>
                      <td><span className="badge badge-role">{ing.category || 'General'}</span></td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{currentStock} {ing.unit}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 700 }}>{threshold} {ing.unit}</span>
                          <button 
                            onClick={() => {
                              setSelectedIngredient(ing);
                              setThresholdVal(threshold.toString());
                              setReorderVal(ing.reorder_qty ? ing.reorder_qty.toString() : '10');
                              setShowThresholdModal(true);
                            }} 
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
                            title="Set Minimum Threshold"
                          >
                            <Sliders size={14} />
                          </button>
                        </div>
                      </td>
                      <td><span className={`badge ${statusBadge}`}>{statusText}</span></td>
                      <td>₹{unitCost.toFixed(2)} / {ing.unit}</td>
                      <td style={{ fontWeight: 800 }}>₹{stockValue.toFixed(2)}</td>
                      <td>
                        <button onClick={() => handleDeleteIngredient(ing.id, ing.name)} className="btn btn-danger btn-sm" title="Delete Ingredient">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Threshold Modal */}
      {showThresholdModal && selectedIngredient && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={20} color="var(--warning)" /> Set Minimum Reorder Threshold
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Configure warning alert threshold for <strong>{selectedIngredient.name}</strong>.
            </p>
            <form onSubmit={handleThresholdSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Minimum Alert Threshold ({selectedIngredient.unit}) *</label>
                <input type="number" step="0.001" required className="input-control" value={thresholdVal} onChange={(e) => setThresholdVal(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Suggested Reorder Quantity ({selectedIngredient.unit})</label>
                <input type="number" step="0.001" className="input-control" value={reorderVal} onChange={(e) => setReorderVal(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowThresholdModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Threshold</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Raw Ingredient Modal with explicit Current Stock & Unit Cost Inputs */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <h3 style={{ marginBottom: '1rem' }}>📦 Add Raw Stock Ingredient</h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Ingredient Name *</label>
                <input type="text" required placeholder="e.g. Fresh Milk, Coffee Beans, Flour" className="input-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Category *</label>
                  <select className="select-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>


                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Unit of Measure *</label>
                  <select className="select-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litre">litre</option>
                    <option value="ml">ml</option>
                    <option value="piece">piece</option>
                    <option value="box">box</option>
                  </select>
                </div>
              </div>

              {/* User Editable Current Stock, Unit Cost & Min Threshold */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
                    Initial Current Stock ({form.unit}) *
                  </label>
                  <input 
                    type="number" 
                    step="0.001" 
                    min="0"
                    required 
                    placeholder="Enter stock quantity..."
                    className="input-control" 
                    value={form.current_stock_qty} 
                    onChange={(e) => setForm({ ...form, current_stock_qty: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
                    Unit Cost (₹ per {form.unit}) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    required 
                    placeholder="Enter cost per unit..."
                    className="input-control" 
                    value={form.cost_per_unit} 
                    onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
                    Min Alert Threshold ({form.unit}) *
                  </label>
                  <input 
                    type="number" 
                    step="0.001" 
                    min="0"
                    required 
                    placeholder="Minimum warning level..."
                    className="input-control" 
                    value={form.reorder_threshold} 
                    onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
                    Supplier Name (optional)
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Amul Dairy Supplier"
                    className="input-control" 
                    value={form.supplier_name} 
                    onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Ingredient in DB</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
