import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import {
  ChefHat,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit3,
  Clock,
  FileText,
  Layers,
  X,
  Filter,
  UtensilsCrossed,
  Save,
  RefreshCw,
  TrendingUp,
  PackageCheck
} from 'lucide-react';

export const RecipeBOMManagement = () => {
  const { selectedRestaurant, addToast } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]); // List of all RecipeItemRead
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CONFIGURED' | 'MISSING'

  // Modal State
  const [activeDish, setActiveDish] = useState(null);
  const [modalDescription, setModalDescription] = useState('');
  const [modalPrepTime, setModalPrepTime] = useState(15);
  const [modalIngredients, setModalIngredients] = useState([]); // array of { ingredient_id, quantity_used, cost_per_unit, unit, name }

  // Load all initial data from backend
  const loadData = async () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const restId = selectedRestaurant.id;

    try {
      const [menuRes, catRes, ingRes, recipesRes] = await Promise.all([
        api.get(`/restaurants/${restId}/menu-items/`).catch(() => ({ data: [] })),
        api.get(`/restaurants/${restId}/menu-categories/`).catch(() => ({ data: [] })),
        api.get(`/restaurants/${restId}/inventory/ingredients`).catch(() => ({ data: [] })),
        api.get(`/restaurants/${restId}/inventory/recipes`).catch(() => ({ data: [] })),
      ]);

      const itemsList = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.data || [];
      const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      const ingList = Array.isArray(ingRes.data) ? ingRes.data : ingRes.data?.data || [];
      const recipeList = Array.isArray(recipesRes.data) ? recipesRes.data : recipesRes.data?.data || [];

      setMenuItems(itemsList);
      setCategories(catList);
      setIngredients(ingList);
      setRecipes(recipeList);
    } catch (err) {
      console.error("Error loading recipe management data:", err);
      addToast('error', 'Failed to load data', 'Could not fetch recipes or inventory ingredients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRestaurant]);

  // Group recipes by menu_item_id for instant O(1) lookup
  const recipesByDishId = useMemo(() => {
    const map = {};
    recipes.forEach(r => {
      if (!map[r.menu_item_id]) {
        map[r.menu_item_id] = [];
      }
      map[r.menu_item_id].push(r);
    });
    return map;
  }, [recipes]);

  // Filtered menu items
  const filteredDishes = useMemo(() => {
    return menuItems.filter(dish => {
      // Search
      const matchesSearch = !search || dish.name.toLowerCase().includes(search.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategory === 'All' || String(dish.category_id) === String(selectedCategory);

      // Status filter
      const dishRecipes = recipesByDishId[dish.id] || [];
      const hasRecipe = dishRecipes.length > 0;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'CONFIGURED' && hasRecipe) ||
        (statusFilter === 'MISSING' && !hasRecipe);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [menuItems, search, selectedCategory, statusFilter, recipesByDishId]);

  // Summary counts
  const totalDishes = menuItems.length;
  const configuredCount = Object.keys(recipesByDishId).length;
  const missingCount = Math.max(0, totalDishes - configuredCount);

  // Open Recipe Modal for a dish
  const handleOpenRecipeModal = (dish) => {
    setActiveDish(dish);
    setModalDescription(dish.description || '');
    setModalPrepTime(dish.preparation_time_minutes || 15);

    const existing = recipesByDishId[dish.id] || [];
    if (existing.length > 0) {
      setModalIngredients(
        existing.map(r => {
          const matchedIng = ingredients.find(i => i.id === r.ingredient_id);
          return {
            ingredient_id: r.ingredient_id,
            quantity_used: String(r.quantity_used || 0.1),
            cost_per_unit: Number(r.ingredient_cost_per_unit || matchedIng?.cost_per_unit || 0),
            unit: r.ingredient_unit || matchedIng?.unit || 'kg',
            name: r.ingredient_name || matchedIng?.name || 'Ingredient',
          };
        })
      );
    } else {
      // If empty, start with 1 blank row if ingredients are available
      if (ingredients.length > 0) {
        const firstIng = ingredients[0];
        setModalIngredients([
          {
            ingredient_id: firstIng.id,
            quantity_used: '0.150',
            cost_per_unit: Number(firstIng.cost_per_unit || 0),
            unit: firstIng.unit || 'kg',
            name: firstIng.name,
          }
        ]);
      } else {
        setModalIngredients([]);
      }
    }
  };

  // Close Recipe Modal
  const handleCloseModal = () => {
    setActiveDish(null);
    setModalIngredients([]);
    setModalDescription('');
    setModalPrepTime(15);
  };

  // Add ingredient row in modal
  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) {
      addToast('warning', 'No Raw Ingredients', 'Add ingredients in Raw Inventory first.');
      return;
    }
    const defaultIng = ingredients[0];
    setModalIngredients(prev => [
      ...prev,
      {
        ingredient_id: defaultIng.id,
        quantity_used: '0.100',
        cost_per_unit: Number(defaultIng.cost_per_unit || 0),
        unit: defaultIng.unit || 'kg',
        name: defaultIng.name,
      }
    ]);
  };

  // Remove ingredient row in modal
  const handleRemoveIngredientRow = (index) => {
    setModalIngredients(prev => prev.filter((_, idx) => idx !== index));
  };

  // Change ingredient selection or quantity
  const handleIngredientChange = (index, field, value) => {
    setModalIngredients(prev => {
      const updated = [...prev];
      const target = { ...updated[index] };

      if (field === 'ingredient_id') {
        const selectedId = Number(value);
        const matched = ingredients.find(i => i.id === selectedId);
        if (matched) {
          target.ingredient_id = matched.id;
          target.cost_per_unit = Number(matched.cost_per_unit || 0);
          target.unit = matched.unit || 'kg';
          target.name = matched.name;
        }
      } else if (field === 'quantity_used') {
        target.quantity_used = value;
      }

      updated[index] = target;
      return updated;
    });
  };

  // Modal Financial Calculations
  const modalDishPrice = activeDish ? Number(activeDish.price || activeDish.base_price || 0) : 0;
  const modalTotalCost = modalIngredients.reduce((sum, item) => {
    const qty = parseFloat(item.quantity_used) || 0;
    const costUnit = Number(item.cost_per_unit || 0);
    return sum + (qty * costUnit);
  }, 0);
  const modalGrossMargin = modalDishPrice - modalTotalCost;
  const modalMarginPct = modalDishPrice > 0 ? (modalGrossMargin / modalDishPrice) * 100 : 0;

  // Save Recipe to Backend
  const handleSaveRecipe = async () => {
    if (!selectedRestaurant || !activeDish) return;
    setSaving(true);
    const restId = selectedRestaurant.id;

    // Validate rows
    const validItems = modalIngredients
      .filter(item => item.ingredient_id && (parseFloat(item.quantity_used) || 0) > 0)
      .map(item => ({
        ingredient_id: Number(item.ingredient_id),
        quantity_used: parseFloat(item.quantity_used),
      }));

    const payload = {
      description: modalDescription.trim() || null,
      preparation_time_minutes: parseInt(modalPrepTime, 10) || null,
      items: validItems,
    };

    try {
      const res = await api.post(`/restaurants/${restId}/inventory/recipes/${activeDish.id}/bulk`, payload);
      const savedItems = Array.isArray(res.data) ? res.data : [];

      // Update local recipes state
      setRecipes(prev => {
        const remaining = prev.filter(r => r.menu_item_id !== activeDish.id);
        return [...remaining, ...savedItems];
      });

      // Update local menu item description & prep time
      setMenuItems(prev => prev.map(m => {
        if (m.id === activeDish.id) {
          return {
            ...m,
            description: payload.description,
            preparation_time_minutes: payload.preparation_time_minutes,
          };
        }
        return m;
      }));

      addToast('success', 'Recipe Saved', `Recipe & BOM for "${activeDish.name}" updated successfully.`);
      handleCloseModal();
    } catch (err) {
      console.error("Failed to save recipe:", err);
      addToast('error', 'Save Failed', err.response?.data?.detail || 'Could not save recipe to database.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Recipe from Backend
  const handleDeleteEntireRecipe = async (dish) => {
    if (!window.confirm(`Are you sure you want to remove the entire recipe configuration for "${dish.name}"?`)) {
      return;
    }
    if (!selectedRestaurant) return;
    const restId = selectedRestaurant.id;

    try {
      await api.delete(`/restaurants/${restId}/inventory/recipes/${dish.id}`);
      setRecipes(prev => prev.filter(r => r.menu_item_id !== dish.id));
      addToast('info', 'Recipe Removed', `Recipe configuration for "${dish.name}" cleared.`);
      if (activeDish?.id === dish.id) {
        handleCloseModal();
      }
    } catch (err) {
      console.error("Failed to delete recipe:", err);
      addToast('error', 'Delete Failed', 'Could not delete recipe.');
    }
  };

  if (loading) {
    return (
      <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading recipe & BOM catalog...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner */}
      <div className="panel-card" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <ChefHat size={22} color="var(--accent-primary)" /> Recipe & BOM Management
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem', marginBottom: 0 }}>
              Configure raw ingredient requirements, cooking instructions, and profit margins for all dishes in your menu.
            </p>
          </div>

          <button onClick={loadData} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} title="Refresh recipes">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Quick KPI Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Menu Items</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalDishes}</div>
          </div>
          <div style={{ background: 'rgba(34, 197, 94, 0.06)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase' }}>Configured BOM</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>{configuredCount}</div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.06)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Recipes</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--warning)' }}>{missingCount}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="panel-card" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search dish by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-control"
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem', padding: '0.45rem 0.75rem 0.45rem 2.25rem' }}
            />
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'ALL' ? 700 : 500,
                background: statusFilter === 'ALL' ? 'var(--accent-primary)' : 'transparent',
                color: statusFilter === 'ALL' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              All ({totalDishes})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CONFIGURED')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'CONFIGURED' ? 700 : 500,
                background: statusFilter === 'CONFIGURED' ? 'var(--success)' : 'transparent',
                color: statusFilter === 'CONFIGURED' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Configured ({configuredCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('MISSING')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'MISSING' ? 700 : 500,
                background: statusFilter === 'MISSING' ? 'var(--warning)' : 'transparent',
                color: statusFilter === 'MISSING' ? '#000' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Missing ({missingCount})
            </button>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`btn btn-sm ${selectedCategory === 'All' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`btn btn-sm ${String(selectedCategory) === String(cat.id) ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      {filteredDishes.length === 0 ? (
        <div className="panel-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <UtensilsCrossed size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>No Menu Dishes Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {menuItems.length === 0
              ? 'No menu items exist in your restaurant. Please add dishes in Menu Management first.'
              : 'No dishes matched your current search or category filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredDishes.map(dish => {
            const dishRecipes = recipesByDishId[dish.id] || [];
            const isConfigured = dishRecipes.length > 0;
            const dishPrice = Number(dish.price || dish.base_price || 0);

            // Compute total ingredient cost
            const totalIngredientCost = dishRecipes.reduce((sum, r) => {
              const qty = Number(r.quantity_used || 0);
              const cost = Number(r.ingredient_cost_per_unit || 0);
              return sum + (qty * cost);
            }, 0);

            const grossProfit = dishPrice - totalIngredientCost;
            const marginPct = dishPrice > 0 ? (grossProfit / dishPrice) * 100 : 0;
            const matchedCategory = categories.find(c => c.id === dish.category_id);

            return (
              <div
                key={dish.id}
                className="panel-card"
                style={{
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderLeft: isConfigured ? '3px solid var(--success)' : '3px solid var(--warning)',
                  background: 'var(--bg-secondary)',
                }}
              >
                {/* Dish Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{dish.name}</div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
                      {matchedCategory && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                          {matchedCategory.name}
                        </span>
                      )}
                      {dish.preparation_time_minutes && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Clock size={11} /> {dish.preparation_time_minutes} min
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Selling Price</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{dishPrice.toFixed(2)}</div>
                  </div>
                </div>

                {/* Description Preview if available */}
                {dish.description && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                    {dish.description}
                  </div>
                )}

                {/* Status & Financial Margins */}
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  {isConfigured ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle size={12} /> Configured ({dishRecipes.length} raw items)
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: marginPct >= 60 ? 'var(--success)' : (marginPct >= 40 ? 'var(--warning)' : 'var(--danger)') }}>
                          {marginPct.toFixed(1)}% Margin
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Food Cost: <strong>₹{totalIngredientCost.toFixed(2)}</strong></span>
                        <span>Gross Profit: <strong style={{ color: 'var(--success)' }}>₹{grossProfit.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--warning)', fontSize: '0.75rem' }}>
                      <AlertCircle size={13} />
                      <span>No recipe configured for stock auto-deduction.</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenRecipeModal(dish)}
                    className={`btn btn-sm ${isConfigured ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    {isConfigured ? <Edit3 size={13} /> : <Plus size={13} />}
                    {isConfigured ? 'Edit Recipe & BOM' : 'Add Recipe'}
                  </button>

                  {isConfigured && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEntireRecipe(dish)}
                      className="btn btn-sm btn-secondary"
                      style={{ padding: '0.35rem 0.6rem', color: 'var(--danger)' }}
                      title="Clear Recipe"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Recipe & BOM Builder Modal */}
      {activeDish && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ChefHat size={18} color="var(--accent-primary)" /> Configure Recipe: {activeDish.name}
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Selling Price: ₹{modalDishPrice.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* General Recipe Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="label-control" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={13} /> Preparation Time (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={modalPrepTime}
                  onChange={(e) => setModalPrepTime(e.target.value)}
                  className="input-control"
                  style={{ width: '120px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label className="label-control" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FileText size={13} /> Recipe Description & Chef Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter cooking procedure, ingredient ratios, or preparation tips..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.5rem 0.75rem', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Bill of Materials (BOM) Raw Ingredients Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Layers size={15} color="var(--accent-primary)" /> Raw Ingredients (BOM)
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Ingredients auto-deducted from stock when an order for this dish is completed.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Plus size={13} /> Add Ingredient
                </button>
              </div>

              {ingredients.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '6px', border: '1px dashed rgba(245, 158, 11, 0.2)' }}>
                  <AlertCircle size={20} style={{ margin: '0 auto 0.35rem auto' }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>No raw ingredients found in inventory</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Please create raw ingredients in Raw Inventory first.</span>
                </div>
              ) : modalIngredients.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.8rem' }}>No ingredients linked yet.</div>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}
                  >
                    <Plus size={13} /> Link First Ingredient
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {modalIngredients.map((row, idx) => {
                    const rowQty = parseFloat(row.quantity_used) || 0;
                    const rowCostUnit = Number(row.cost_per_unit || 0);
                    const rowCost = rowQty * rowCostUnit;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr auto',
                          gap: '0.5rem',
                          alignItems: 'center',
                          background: 'var(--bg-secondary)',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        {/* Ingredient Dropdown */}
                        <div>
                          <select
                            value={row.ingredient_id}
                            onChange={(e) => handleIngredientChange(idx, 'ingredient_id', e.target.value)}
                            className="select-control"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                          >
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Input */}
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={row.quantity_used}
                            onChange={(e) => handleIngredientChange(idx, 'quantity_used', e.target.value)}
                            className="input-control"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', paddingRight: '2rem' }}
                            placeholder="Qty"
                          />
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {row.unit}
                          </span>
                        </div>

                        {/* Line Cost Display */}
                        <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{rowCost.toFixed(2)}
                        </div>

                        {/* Remove Row */}
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientRow(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Financial Summary & Live Profit Margins */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Selling Price</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{modalDishPrice.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Food Cost</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--danger)' }}>₹{modalTotalCost.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gross Margin</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: modalMarginPct >= 50 ? 'var(--success)' : 'var(--warning)' }}>
                    ₹{modalGrossMargin.toFixed(2)} ({modalMarginPct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div>
                {recipesByDishId[activeDish.id]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEntireRecipe(activeDish)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)', fontSize: '0.75rem' }}
                  >
                    <Trash2 size={13} /> Delete Recipe
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveRecipe}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Recipe & BOM'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
