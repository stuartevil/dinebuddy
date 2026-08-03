import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { ChefHat, Plus, AlertTriangle, CheckCircle, Trash2, UtensilsCrossed } from 'lucide-react';

export const RecipeBOMManagement = () => {
  const { selectedRestaurant, addToast } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedDishId, setSelectedDishId] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ ingredient_id: '', quantity_used: '0.150' });

  // Fetch real menu items & ingredients from backend API
  useEffect(() => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get(`/restaurants/${selectedRestaurant.id}/menu-items/`).catch(() => ({ data: [] })),
      api.get(`/restaurants/${selectedRestaurant.id}/inventory/ingredients`).catch(() => ({ data: [] })),
    ]).then(([menuRes, ingRes]) => {
      const itemsList = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.data || [];
      const ingList = Array.isArray(ingRes.data) ? ingRes.data : ingRes.data?.data || [];

      setMenuItems(itemsList);
      setIngredients(ingList);

      if (itemsList.length > 0) {
        setSelectedDishId(itemsList[0].id);
      }
      if (ingList.length > 0) {
        setForm(f => ({ ...f, ingredient_id: ingList[0].id }));
      }
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedRestaurant]);

  const selectedDish = menuItems.find(m => m.id === selectedDishId) || null;
  const currentRecipe = recipes.filter(r => r.menu_item_id === selectedDishId);

  const ingredientCost = Number(currentRecipe.reduce((sum, r) => sum + (Number(r.cost) || 0), 0)) || 0;
  const rawPrice = selectedDish ? (selectedDish.price ?? selectedDish.base_price ?? 0) : 0;
  const dishPrice = Number(rawPrice) || 0;
  const grossMargin = dishPrice - ingredientCost;
  const marginPercentage = dishPrice > 0 ? (grossMargin / dishPrice) * 100 : 0;

  const handleAddIngredient = (e) => {
    e.preventDefault();
    if (!selectedDish) {
      addToast('error', 'Select Dish', 'Please select a dish first.');
      return;
    }
    const ing = ingredients.find(i => i.id === Number(form.ingredient_id));
    if (!ing) {
      addToast('error', 'Select Ingredient', 'Please select a valid raw ingredient.');
      return;
    }

    const qty = parseFloat(form.quantity_used) || 0;
    const costPerUnit = Number(ing.cost_per_unit ?? ing.cost ?? 0) || 0;
    const cost = qty * costPerUnit;

    const newRecipe = {
      id: Date.now(),
      menu_item_id: selectedDishId,
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      quantity_used: qty,
      unit: ing.unit || 'kg',
      cost: cost,
    };

    setRecipes(prev => [...prev, newRecipe]);
    addToast('success', 'Ingredient Linked', `${ing.name} linked to ${selectedDish.name}!`);
  };

  if (loading) {
    return (
      <div className="panel-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading menu items & inventory ingredients...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(19, 27, 46, 0.85))' }}>
        <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ChefHat size={24} color="var(--accent-primary)" /> Recipe & Bill of Materials (BOM) Builder
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Link menu items to raw ingredients. Calculates COGS profit margins and powers stock auto-deduction upon order completion.
        </p>
      </div>

      {menuItems.length === 0 ? (
        /* Empty State when no menu items exist */
        <div className="panel-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <UtensilsCrossed size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>No Menu Dishes Available</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            There are no menu items in your restaurant catalog yet. Please add dishes in Menu Management before building recipes/BOM.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          
          {/* Left Column: Dish Selector & Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Select Menu Dish to Configure</label>
              <select 
                value={selectedDishId || ''} 
                onChange={(e) => setSelectedDishId(Number(e.target.value))}
                className="select-control"
                style={{ fontWeight: 700, fontSize: '0.95rem' }}
              >
                {menuItems.map(dish => (
                  <option key={dish.id} value={dish.id}>
                    {dish.name} — ₹{Number(dish.price || dish.base_price || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="panel-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>+ Add Raw Ingredient to Recipe</h3>
              <form onSubmit={handleAddIngredient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Raw Ingredient</label>
                  {ingredients.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
                      ⚠ No raw ingredients found in inventory. Add ingredients in Raw Inventory first.
                    </div>
                  ) : (
                    <select 
                      value={form.ingredient_id} 
                      onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}
                      className="select-control"
                    >
                      {ingredients.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit}) — ₹{Number(i.cost_per_unit || i.cost || 0).toFixed(2)}/{i.unit}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity Used per Order</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    required 
                    className="input-control" 
                    value={form.quantity_used} 
                    onChange={(e) => setForm({ ...form, quantity_used: e.target.value })} 
                  />
                </div>

                <button type="submit" disabled={ingredients.length === 0} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                  <Plus size={16} /> Link Ingredient Requirement
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Recipe Financial Margin Preview */}
          <div className="panel-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem' }}>{selectedDish?.name || 'Selected Dish'}</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selling Price: ₹{dishPrice.toFixed(2)}</span>
              </div>

              {currentRecipe.length > 0 ? (
                <span className="badge badge-success">BOM CONFIGURED</span>
              ) : (
                <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={14} /> Recipe Not Configured
                </span>
              )}
            </div>

            {/* Recipe Ingredients List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {currentRecipe.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--warning)', border: '1px dashed var(--warning-border)', borderRadius: 'var(--radius-md)' }}>
                  <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem auto' }} />
                  <div style={{ fontWeight: 700 }}>⚠ Recipe Not Configured</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Link raw ingredients on the left to calculate gross profit margin.</span>
                </div>
              ) : (
                currentRecipe.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.ingredient_name}</div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.quantity_used} {r.unit}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>₹{Number(r.cost || 0).toFixed(2)}</div>
                      <button onClick={() => setRecipes(prev => prev.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial Breakdown Card */}
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                <span>Selling Price</span>
                <span>₹{dishPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '0.35rem' }}>
                <span>Ingredient Cost (COGS)</span>
                <span>- ₹{ingredientCost.toFixed(2)}</span>
              </div>
              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>
                <span>Gross Margin (₹)</span>
                <span>₹{grossMargin.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>
                <span>Margin %</span>
                <span>{marginPercentage.toFixed(2)}%</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
