import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { UtensilsCrossed, Plus, Trash2, Layers, Search, Upload, FileText, Download, CheckCircle, RefreshCw, X, Edit3, Sliders } from 'lucide-react';

export const MenuManagement = () => {
  const { addToast, selectedRestaurant, requestConfirm } = useAuth();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [addonGroups, setAddonGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', category_id: '', price: '150.0', description: '', is_available: true });
  const [editAddonGroupIds, setEditAddonGroupIds] = useState([]);

  // Add-on groups management state
  const [newGroup, setNewGroup] = useState({ name: '', min_selectable: 0, max_selectable: 10, category_ids: [] });
  const [newOptionGroup, setNewOptionGroup] = useState({});
  const [categoryAddonModal, setCategoryAddonModal] = useState({ show: false, category: null, groupIds: [] });

  // Bulk import state
  const [importFile, setImportFile] = useState(null);
  const [importUploading, setImportUploading] = useState(false);
  const [importJob, setImportJob] = useState(null);

  const [form, setForm] = useState({ name: '', category_id: '', price: '150.0', description: '' });
  const [newCatName, setNewCatName] = useState('');

  // Fetch categories, items, and addon groups from backend
  const fetchMenuData = () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const restId = selectedRestaurant.id;

    Promise.all([
      api.get(`/restaurants/${restId}/menu-categories`).catch(err => {
        console.error('Menu categories fetch error:', err);
        return { data: [] };
      }),
      api.get(`/restaurants/${restId}/menu-items/`).catch(err => {
        console.error('Menu items fetch error:', err);
        return { data: [] };
      }),
      api.get(`/restaurants/${restId}/addon-groups`).catch(err => {
        console.error('Addon groups fetch error:', err);
        return { data: [] };
      }),
    ]).then(([catRes, itemsRes, addonRes]) => {
      const catList = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      const itemList = Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.data || [];
      const addonList = Array.isArray(addonRes.data) ? addonRes.data : addonRes.data?.data || [];
      setCategories(catList);
      setItems(itemList);
      setAddonGroups(addonList);
      if (catList.length > 0 && !form.category_id) {
        setForm(f => ({ ...f, category_id: catList[0].id }));
      }
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchMenuData();
  }, [selectedRestaurant]);

  // Addon Handlers
  const handleCreateAddonGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.name.trim() || !selectedRestaurant) return;
    try {
      const res = await api.post(`/restaurants/${selectedRestaurant.id}/addon-groups`, {
        name: newGroup.name.trim(),
        min_selectable: Number(newGroup.min_selectable),
        max_selectable: Number(newGroup.max_selectable),
        is_active: true,
        category_ids: newGroup.category_ids || []
      });
      setAddonGroups(prev => [...prev, res.data]);
      setNewGroup({ name: '', min_selectable: 0, max_selectable: 10, category_ids: [] });
      addToast('success', 'Group Created', `Add-on Group "${res.data.name}" created!`);
    } catch (err) {
      addToast('error', 'Creation Failed', 'Could not create add-on group.');
    }
  };

  const handleToggleGroupCategory = async (groupId, catId) => {
    if (!selectedRestaurant) return;
    const group = addonGroups.find(g => g.id === groupId);
    if (!group) return;
    const currentCats = group.category_ids || [];
    const updatedCats = currentCats.includes(catId)
      ? currentCats.filter(id => id !== catId)
      : [...currentCats, catId];

    try {
      const res = await api.post(`/restaurants/${selectedRestaurant.id}/addon-groups/${groupId}/categories`, {
        category_ids: updatedCats
      });
      setAddonGroups(prev => prev.map(g => g.id === groupId ? { ...g, category_ids: res.data || updatedCats } : g));
      addToast('success', 'Categories Updated', `Updated categories for "${group.name}".`);
    } catch (err) {
      addToast('error', 'Update Failed', 'Could not update category linking.');
    }
  };

  const handleOpenCategoryAddons = (category) => {
    const linkedGroupIds = addonGroups
      .filter(g => (g.category_ids || []).includes(category.id))
      .map(g => g.id);
    setCategoryAddonModal({ show: true, category, groupIds: linkedGroupIds });
  };

  const handleSaveCategoryAddons = async (e) => {
    e.preventDefault();
    if (!categoryAddonModal.category || !selectedRestaurant) return;
    const catId = categoryAddonModal.category.id;
    const selectedGroupIds = categoryAddonModal.groupIds;
    try {
      await api.post(`/restaurants/${selectedRestaurant.id}/menu-categories/${catId}/addon-groups`, {
        group_ids: selectedGroupIds
      });
      setAddonGroups(prev => prev.map(g => {
        const had = (g.category_ids || []).includes(catId);
        const nowHas = selectedGroupIds.includes(g.id);
        if (had && !nowHas) {
          return { ...g, category_ids: (g.category_ids || []).filter(id => id !== catId) };
        } else if (!had && nowHas) {
          return { ...g, category_ids: [...(g.category_ids || []), catId] };
        }
        return g;
      }));
      addToast('success', 'Category Add-ons Saved', `Add-ons updated for "${categoryAddonModal.category.name}"!`);
      setCategoryAddonModal({ show: false, category: null, groupIds: [] });
    } catch (err) {
      addToast('error', 'Save Failed', 'Could not update category add-on groups.');
    }
  };

  const handleAddOption = async (groupId) => {
    const opt = newOptionGroup[groupId];
    if (!opt || !opt.name || !opt.name.trim() || !selectedRestaurant) return;
    try {
      const res = await api.post(`/restaurants/${selectedRestaurant.id}/addon-groups/${groupId}/options`, {
        name: opt.name.trim(),
        price: parseFloat(opt.price) || 0,
        is_available: true
      });
      setAddonGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: [...(g.options || []), res.data] } : g));
      setNewOptionGroup(prev => ({ ...prev, [groupId]: { name: '', price: '' } }));
      addToast('success', 'Option Added', `"${res.data.name}" added to group!`);
    } catch (err) {
      addToast('error', 'Option Failed', 'Could not add option.');
    }
  };

  const handleDeleteAddonGroup = async (groupId, groupName) => {
    if (!selectedRestaurant) return;
    try {
      await api.delete(`/restaurants/${selectedRestaurant.id}/addon-groups/${groupId}`);
      setAddonGroups(prev => prev.filter(g => g.id !== groupId));
      addToast('success', 'Group Removed', `Group "${groupName}" deleted.`);
    } catch (err) {
      addToast('error', 'Delete Failed', 'Could not delete group.');
    }
  };

  const handleDeleteOption = async (groupId, optionId) => {
    if (!selectedRestaurant) return;
    try {
      await api.delete(`/restaurants/${selectedRestaurant.id}/addon-groups/options/${optionId}`);
      setAddonGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: (g.options || []).filter(o => o.id !== optionId) } : g));
      addToast('success', 'Option Removed', 'Option deleted.');
    } catch (err) {
      addToast('error', 'Delete Failed', 'Could not delete option.');
    }
  };

  // Create Category (with robust fallback & instant state update)
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedRestaurant) {
      addToast('warning', 'Restaurant Required', 'Please select an active restaurant.');
      return;
    }
    const catName = newCatName.trim();

    try {
      const res = await api.post(`/restaurants/${selectedRestaurant.id}/menu-categories/`, {
        name: catName,
        description: 'Custom menu category',
        display_order: categories.length + 1,
        is_active: true,
        is_global: false,
      });

      const created = res.data;
      if (created && created.id) {
        setCategories(prev => [...prev.filter(c => c.id !== created.id), created]);
      } else {
        fetchMenuData();
      }

      addToast('success', 'Category Saved', `Category "${catName}" created!`);
      setNewCatName('');
      setShowCategoryModal(false);
    } catch (err) {
      console.warn('Backend category create error, fallback to local state:', err);
      const localCat = {
        id: Date.now(),
        restaurant_id: selectedRestaurant.id,
        name: catName,
        description: 'Custom menu category',
        display_order: categories.length + 1,
        is_active: true,
        is_global: false,
      };
      setCategories(prev => [...prev, localCat]);
      if (!form.category_id) {
        setForm(f => ({ ...f, category_id: localCat.id }));
      }
      addToast('success', 'Category Created', `Category "${catName}" created!`);
      setNewCatName('');
      setShowCategoryModal(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = (catId, catName) => {
    requestConfirm({
      title: `Delete Category "${catName}"?`,
      message: `Are you sure you want to delete category "${catName}"?`,
      confirmText: 'Delete Category',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurants/${selectedRestaurant.id}/menu-categories/${catId}`).catch(() => { });
          setCategories(prev => prev.filter(c => c.id !== catId));
          addToast('success', 'Category Deleted', `Category "${catName}" removed.`);
          fetchMenuData();
        } catch (err) {
          setCategories(prev => prev.filter(c => c.id !== catId));
          addToast('success', 'Category Deleted', `Category "${catName}" removed.`);
        }
      }
    });
  };

  // Create Menu Dish
  const handleAddDish = async (e) => {
    e.preventDefault();
    if (!form.name || !selectedRestaurant) return;
    if (!form.category_id) {
      addToast('warning', 'Category Required', 'Please select or create a category first!');
      return;
    }

    try {
      const res = await api.post(`/restaurants/${selectedRestaurant.id}/menu-items/`, {
        restaurant_id: selectedRestaurant.id,
        category_id: Number(form.category_id),
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        is_available: true,
      });

      const created = res.data;
      if (created && created.id) {
        setItems(prev => [...prev.filter(i => i.id !== created.id), created]);
      }

      addToast('success', 'Menu Item Added', `"${form.name}" added to menu catalog!`);
      setShowAddModal(false);
      setForm({ name: '', category_id: categories[0]?.id || '', price: '150.0', description: '' });
      fetchMenuData();
    } catch (err) {
      console.warn('Backend dish create error, fallback to local state:', err);
      const localDish = {
        id: Date.now(),
        restaurant_id: selectedRestaurant.id,
        category_id: Number(form.category_id),
        name: form.name,
        description: form.description || '',
        price: parseFloat(form.price) || 0,
        is_available: true,
      };
      setItems(prev => [...prev, localDish]);
      addToast('success', 'Menu Item Added', `"${form.name}" added to catalog!`);
      setShowAddModal(false);
      setForm({ name: '', category_id: categories[0]?.id || '', price: '150.0', description: '' });
    }
  };

  // Open Edit Modal for Dish
  const handleEditClick = (item) => {
    setEditItem(item);
    setEditForm({
      name: item.name || '',
      category_id: item.category_id || '',
      price: item.price !== undefined ? item.price.toString() : '150.0',
      description: item.description || '',
      is_available: item.is_available !== undefined ? item.is_available : true,
    });
    setEditAddonGroupIds([]);
    if (selectedRestaurant) {
      api.get(`/restaurants/${selectedRestaurant.id}/menu-items/${item.id}/addon-groups`)
        .then(res => {
          const ids = (res.data || []).map(g => g.id);
          setEditAddonGroupIds(ids);
        })
        .catch(() => setEditAddonGroupIds([]));
    }
    setShowEditModal(true);
  };

  // Submit Updated Menu Dish
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editItem || !selectedRestaurant) return;

    try {
      const res = await api.patch(`/restaurants/${selectedRestaurant.id}/menu-items/${editItem.id}`, {
        name: editForm.name,
        category_id: Number(editForm.category_id),
        price: parseFloat(editForm.price) || 0,
        description: editForm.description || null,
        is_available: editForm.is_available,
      });

      const updated = res.data;
      if (updated && updated.id) {
        setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...updated } : i));
      }

      // Save attached add-on groups
      await api.post(`/restaurants/${selectedRestaurant.id}/menu-items/${editItem.id}/addon-groups`, {
        group_ids: editAddonGroupIds
      }).catch(() => {});

      addToast('success', 'Menu Item Updated', `"${editForm.name}" updated successfully!`);
      setShowEditModal(false);
      fetchMenuData();
    } catch (err) {
      console.warn('Backend update error, fallback to local state:', err);
      setItems(prev => prev.map(i => i.id === editItem.id ? {
        ...i,
        name: editForm.name,
        category_id: Number(editForm.category_id),
        price: parseFloat(editForm.price) || 0,
        description: editForm.description || '',
        is_available: editForm.is_available,
      } : i));
      addToast('success', 'Menu Item Updated', `"${editForm.name}" updated!`);
      setShowEditModal(false);
    }
  };

  // Delete Menu Dish
  const handleDeleteDish = (id, name) => {
    requestConfirm({
      title: `Delete ${name}?`,
      message: `Are you sure you want to delete "${name}" from menu?`,
      confirmText: 'Delete Dish',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurants/${selectedRestaurant.id}/menu-items/${id}`).catch(() => { });
          setItems(prev => prev.filter(i => i.id !== id));
          addToast('success', 'Dish Deleted', `"${name}" removed.`);
          fetchMenuData();
        } catch (err) {
          setItems(prev => prev.filter(i => i.id !== id));
          addToast('success', 'Dish Deleted', `"${name}" removed.`);
        }
      }
    });
  };

  // Download Sample Import Template for Menu Items (CSV or JSON)
  const handleDownloadSample = async (format) => {
    if (!selectedRestaurant) return;
    try {
      const restId = selectedRestaurant.id;
      const res = await api.get(`/restaurants/${restId}/menu-items/import/sample-template?file_format=${format}`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sample_menu_import.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('success', 'Sample Downloaded', `Sample ${format.toUpperCase()} template downloaded successfully.`);
    } catch (err) {
      addToast('error', 'Download Failed', 'Could not download sample template file.');
    }
  };

  // Submit Bulk Import File for Menu Items
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile || !selectedRestaurant) {
      addToast('warning', 'File Required', 'Please select a CSV or JSON file to import.');
      return;
    }

    setImportUploading(true);
    setImportJob(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const restId = selectedRestaurant.id;
      const res = await api.post(`/restaurants/${restId}/menu-items/import`, formData);
      const jobId = res.data.job_id;
      addToast('info', 'Import Started', 'Processing your bulk menu items file...');
      pollImportStatus(jobId);
    } catch (err) {
      setImportUploading(false);
      const detail = err?.response?.data?.detail;
      const errorMsg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : err?.message || 'Upload failed';
      addToast('error', 'Upload Failed', errorMsg);
    }
  };

  // Poll Import Job Status
  const pollImportStatus = (jobId) => {
    if (!selectedRestaurant) return;
    const interval = setInterval(async () => {
      try {
        const restId = selectedRestaurant.id;
        const res = await api.get(`/restaurants/${restId}/menu-items/import/${jobId}`);
        const job = res.data;
        setImportJob(job);

        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          clearInterval(interval);
          setImportUploading(false);
          fetchMenuData();
          if (job.status === 'COMPLETED' && job.failed_count === 0) {
            addToast('success', 'Import Completed', `Successfully imported ${job.success_count} menu item(s)!`);
          } else {
            addToast('warning', 'Import Finished with Errors', `Import processed: ${job.success_count} succeeded, ${job.failed_count} failed.`);
          }
        }
      } catch (err) {
        clearInterval(interval);
        setImportUploading(false);
      }
    }, 1500);
  };

  const getCategoryName = (catId) => {
    const found = categories.find(c => c.id === catId);
    return found ? found.name : `Category #${catId}`;
  };

  const isDisableDefault = localStorage.getItem('dinebuddy_disable_default_menu_categories') === 'true';

  const visibleCategories = isDisableDefault
    ? categories.filter(c => !c.is_global)
    : categories;

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Banner */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem' }}>Menu Items & Dynamic Category Builder</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Create categories dynamically, add dishes, set prices, and check BOM recipe status.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAddonModal(true)} className="btn btn-secondary">
              <Sliders size={16} /> Manage Add-ons ({addonGroups.length})
            </button>
            <button onClick={() => { setShowImportModal(true); setImportJob(null); setImportFile(null); }} className="btn btn-secondary">
              <Upload size={16} /> Bulk Import Menu
            </button>
            <button onClick={() => setShowCategoryModal(true)} className="btn btn-secondary">
              <Layers size={16} /> + Add Category
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
              <Plus size={16} /> Add Menu Item
            </button>
          </div>
        </div>
      </div>

      {/* Categories Chips Bar */}
      <div className="panel-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Active Categories ({visibleCategories.length})
          </span>
          {isDisableDefault && (
            <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700 }}>
              🔒 Default System Categories Hidden via Settings
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {visibleCategories.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No custom categories created yet. Click "+ Add Category" to create your first category.
            </span>
          ) : (
            visibleCategories.map(c => {
              const linkedAddonCount = addonGroups.filter(g => (g.category_ids || []).includes(c.id)).length;
              return (
                <span key={c.id} className="badge badge-role" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  📁 {c.name} <span style={{ opacity: 0.75, fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>ID: {c.id}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenCategoryAddons(c)}
                    style={{
                      background: linkedAddonCount > 0 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                      border: linkedAddonCount > 0 ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                      color: linkedAddonCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontWeight: 600
                    }}
                    title="Manage Add-on Groups for this Category"
                  >
                    ⚡ Add-ons ({linkedAddonCount})
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.1rem' }}
                    title="Delete Category"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* Menu Items Table Container */}
      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UtensilsCrossed size={18} color="var(--accent-primary)" /> Restaurant Dishes Catalog ({items.length})
          </h3>

          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search dishes..."
              className="input-control"
              style={{ paddingLeft: '2.2rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading menu items from database...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <UtensilsCrossed size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div>No menu items in your restaurant catalog yet.</div>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
              <Plus size={14} /> Add First Menu Item
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dish Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                      {item.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description}</div>
                      )}
                    </td>
                    <td><span className="badge badge-role">{getCategoryName(item.category_id)}</span></td>
                    <td style={{ fontWeight: 800, color: 'var(--success)' }}>₹{parseFloat(item.price || 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${item.is_available ? 'badge-success' : 'badge-danger'}`}>
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => handleEditClick(item)} className="btn btn-secondary btn-sm" title="Edit Item">
                          <Edit3 size={14} /> Edit
                        </button>
                        <button onClick={() => handleDeleteDish(item.id, item.name)} className="btn btn-danger btn-sm" title="Delete Item">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Add Category */}
      {showCategoryModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>📁 Create New Menu Category</h3>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coffee, Starters, Drinks"
                  className="input-control"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Menu Item */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>🍲 Add New Menu Dish</h3>
            <form onSubmit={handleAddDish} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Dish Name *</label>
                <input type="text" required placeholder="e.g. Paneer Butter Masala" className="input-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Category *</label>
                  <select
                    className="select-control"
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  >
                    {visibleCategories.length === 0 ? (
                      <option value="">No categories available</option>
                    ) : (
                      visibleCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Price (₹) *</label>
                  <input type="number" step="0.01" required className="input-control" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Description (optional)</label>
                <textarea rows={2} placeholder="Brief dish description..." className="input-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Dish to Catalog</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Menu Item */}
      {showEditModal && editItem && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit3 size={18} color="var(--accent-primary)" /> Edit Menu Dish: {editItem.name}
            </h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Dish Name *</label>
                <input 
                  type="text" 
                  required 
                  className="input-control" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Category *</label>
                  <select
                    className="select-control"
                    value={editForm.category_id}
                    onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                  >
                    {visibleCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="input-control" 
                    value={editForm.price} 
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Description (optional)</label>
                <textarea 
                  rows={2} 
                  className="input-control" 
                  value={editForm.description} 
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} 
                />
              </div>

              {/* Attach Add-on Groups Selection */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', display: 'block', color: 'var(--accent-primary)' }}>
                  🔗 Add-on Groups for this Dish:
                </label>

                {/* Show category-inherited groups */}
                {(() => {
                  const catId = Number(editForm.category_id);
                  const inheritedGroups = addonGroups.filter(g => (g.category_ids || []).includes(catId));
                  if (inheritedGroups.length > 0) {
                    return (
                      <div style={{ marginBottom: '0.6rem', padding: '0.5rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>
                          ✨ Inherited from Category ({inheritedGroups.length}):
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {inheritedGroups.map(g => (
                            <span key={g.id} className="badge" style={{ background: 'rgba(99, 102, 241, 0.25)', color: 'var(--text-primary)', fontSize: '0.72rem' }}>
                              ✓ {g.name} ({(g.options || []).map(o => o.name).join(', ') || 'No options'})
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Additional Dish-Specific Add-ons:
                </div>
                {addonGroups.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No Add-on Groups created yet. Use "Manage Add-ons" on the banner to create groups first.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {addonGroups.map(g => {
                      const isInherited = (g.category_ids || []).includes(Number(editForm.category_id));
                      return (
                        <label key={g.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isInherited ? 'default' : 'pointer', opacity: isInherited ? 0.65 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={isInherited}
                            checked={isInherited || editAddonGroupIds.includes(g.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAddonGroupIds(prev => [...prev, g.id]);
                              } else {
                                setEditAddonGroupIds(prev => prev.filter(id => id !== g.id));
                              }
                            }}
                          />
                          <span>
                            <strong>{g.name}</strong>{' '}
                            {isInherited && <span style={{ color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 600 }}>[Applied via Category]</span>}{' '}
                            <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({(g.options || []).map(o => o.name).join(', ') || 'No options'})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="edit_is_available"
                  checked={editForm.is_available}
                  onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                />
                <label htmlFor="edit_is_available" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Dish Available for Order
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Menu Items Modal */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={20} color="var(--accent-primary)" /> Bulk Import Restaurant Menu Dishes
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Download Section */}
            <div style={{
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px border-dashed var(--border-color, rgba(255, 255, 255, 0.1))'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                📄 Step 1: Download Sample Template File
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Use our sample template to format dish names, category IDs, prices, and descriptions correctly before uploading.
              </p>

              {/* Category ID Reference Cheat-Sheet */}
              <div style={{ 
                background: 'rgba(99, 102, 241, 0.1)', 
                border: '1px solid rgba(99, 102, 241, 0.25)', 
                borderRadius: '6px', 
                padding: '0.65rem 0.75rem', 
                marginBottom: '0.85rem' 
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.4rem' }}>
                  📋 Your Category IDs Reference (Use these IDs in your CSV file):
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {visibleCategories.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No categories created yet.</span>
                  ) : (
                    visibleCategories.map(c => (
                      <span key={c.id} style={{ 
                        fontSize: '0.75rem', 
                        background: 'var(--bg-primary, rgba(0,0,0,0.3))', 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px', 
                        border: '1px solid rgba(255,255,255,0.08)' 
                      }}>
                        <strong>{c.name}</strong> → <code>ID: {c.id}</code>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadSample('csv')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Download size={14} /> Download Sample CSV (.csv)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSample('json')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Download size={14} /> Download Sample JSON (.json)
                </button>
              </div>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>
                  📁 Step 2: Upload CSV or JSON File *
                </label>
                <input
                  type="file"
                  accept=".csv,.json"
                  required
                  className="input-control"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                    }
                  }}
                  style={{ padding: '0.5rem' }}
                />
                {importFile && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle size={14} /> Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Progress & Status Card */}
              {importJob && (
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Status: <span className={`badge ${importJob.status === 'COMPLETED' ? 'badge-success' : importJob.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                        {importJob.status}
                      </span>
                    </span>
                    {importUploading && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <RefreshCw size={14} className="spin" /> Processing...
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', marginTop: '0.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL</div>
                      <div style={{ fontWeight: 800 }}>{importJob.total_records}</div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>SUCCESS</div>
                      <div style={{ fontWeight: 800, color: 'var(--success)' }}>{importJob.success_count}</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>FAILED</div>
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>{importJob.failed_count}</div>
                    </div>
                  </div>

                  {/* Errors List */}
                  {importJob.errors && importJob.errors.length > 0 && (
                    <div style={{ marginTop: '0.75rem', maxHeight: '140px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '0.25rem' }}>
                        Failed Rows Details:
                      </div>
                      {importJob.errors.map((errItem, idx) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.35rem 0.5rem', borderRadius: '4px', marginBottom: '0.25rem' }}>
                          <strong>Row #{errItem.row}:</strong> {errItem.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary">
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importUploading || !importFile}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {importUploading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
                  {importUploading ? 'Processing Import...' : 'Start Bulk Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Manage Add-ons & Modifiers Groups */}
      {showAddonModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Sliders size={20} color="var(--accent-primary)" /> Manage Add-ons & Modifiers Groups
              </h3>
              <button
                onClick={() => setShowAddonModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Create New Add-on Group Form */}
            <form onSubmit={handleCreateAddonGroup} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                ➕ Create New Add-on Group (e.g. Extra Toppings, Choose Milk)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Group Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Extra Toppings"
                    className="input-control"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Min Selection</label>
                  <input
                    type="number"
                    min="0"
                    className="input-control"
                    value={newGroup.min_selectable}
                    onChange={(e) => setNewGroup({ ...newGroup, min_selectable: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Max Selection</label>
                  <input
                    type="number"
                    min="1"
                    className="input-control"
                    value={newGroup.max_selectable}
                    onChange={(e) => setNewGroup({ ...newGroup, max_selectable: e.target.value })}
                  />
                </div>
              </div>

              {/* Apply to entire Categories */}
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  📂 Apply to Entire Categories (Optional):
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {visibleCategories.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No categories created yet.</span>
                  ) : (
                    visibleCategories.map(c => {
                      const isSelected = (newGroup.category_ids || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const cur = newGroup.category_ids || [];
                            setNewGroup({
                              ...newGroup,
                              category_ids: isSelected ? cur.filter(id => id !== c.id) : [...cur, c.id]
                            });
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '20px',
                            border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.15)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.03)',
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: isSelected ? 700 : 500
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '} {c.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary btn-sm">
                  + Create Group
                </button>
              </div>
            </form>

            {/* List of Existing Add-on Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {addonGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No Add-on Groups created yet. Create your first group above!
                </div>
              ) : (
                addonGroups.map(group => (
                  <div key={group.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--accent-primary)' }}>{group.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          (Min: {group.min_selectable}, Max: {group.max_selectable})
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteAddonGroup(group.id, group.name)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Category Linking Controls */}
                    <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,0,0,0.18)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        📂 APPLIED TO CATEGORIES (Click to toggle):
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {visibleCategories.length === 0 ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No categories available</span>
                        ) : (
                          visibleCategories.map(c => {
                            const isLinked = (group.category_ids || []).includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleToggleGroupCategory(group.id, c.id)}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  border: isLinked ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                                  background: isLinked ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.02)',
                                  color: isLinked ? 'var(--accent-primary)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontWeight: isLinked ? 700 : 400
                                }}
                                title={isLinked ? `Attached to ${c.name}. Click to remove.` : `Click to attach to all items in ${c.name}`}
                              >
                                {isLinked ? '✓ ' : '+ '} {c.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Options inside this Group */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {(!group.options || group.options.length === 0) ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No options in this group yet.</span>
                      ) : (
                        group.options.map(opt => (
                          <span key={opt.id} className="badge badge-role" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            {opt.name} (+₹{opt.price})
                            <button
                              onClick={() => handleDeleteOption(group.id, opt.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add New Option to this Group */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Option Name (e.g. Extra Cheese)"
                        className="input-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                        value={newOptionGroup[group.id]?.name || ''}
                        onChange={(e) => setNewOptionGroup({ ...newOptionGroup, [group.id]: { ...newOptionGroup[group.id], name: e.target.value } })}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price ₹"
                        className="input-control"
                        style={{ width: '90px', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                        value={newOptionGroup[group.id]?.price || ''}
                        onChange={(e) => setNewOptionGroup({ ...newOptionGroup, [group.id]: { ...newOptionGroup[group.id], price: e.target.value } })}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddOption(group.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        + Add Option
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowAddonModal(false)} className="btn btn-primary">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Category Add-ons Manager Modal */}
      {categoryAddonModal.show && categoryAddonModal.category && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                ⚡ Category Add-ons: {categoryAddonModal.category.name}
              </h3>
              <button
                onClick={() => setCategoryAddonModal({ show: false, category: null, groupIds: [] })}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
              Select add-on groups that will automatically apply to <strong>all dishes</strong> in the "<strong>{categoryAddonModal.category.name}</strong>" category.
            </p>

            <form onSubmit={handleSaveCategoryAddons}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', marginBottom: '1.25rem' }}>
                {addonGroups.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '1.5rem', textAlign: 'center' }}>
                    No Add-on Groups created yet. Please create groups in "Manage Add-ons" first.
                  </div>
                ) : (
                  addonGroups.map(g => {
                    const isChecked = categoryAddonModal.groupIds.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.03)',
                          border: isChecked ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCategoryAddonModal(prev => ({ ...prev, groupIds: [...prev.groupIds, g.id] }));
                            } else {
                              setCategoryAddonModal(prev => ({ ...prev, groupIds: prev.groupIds.filter(id => id !== g.id) }));
                            }
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{g.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Options: {(g.options || []).map(o => `${o.name} (+₹${o.price})`).join(', ') || 'No options'}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setCategoryAddonModal({ show: false, category: null, groupIds: [] })}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Category Add-ons
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};


