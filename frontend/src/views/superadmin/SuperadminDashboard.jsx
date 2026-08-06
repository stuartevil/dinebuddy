import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  Users, 
  Plus, 
  Search, 
  CheckCircle, 
  Eye,
  Edit,
  Trash2,
  Upload,
  X,
  ImageIcon,
  UserCheck,
} from 'lucide-react';

import { api, getMediaUrl } from '../../services/apiClient';

export const SuperadminDashboard = ({ activeRoute }) => {
  const { restaurants, setRestaurants, switchRestaurant, addToast, requestConfirm, fetchRestaurants } = useAuth();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', description: '', cuisine_type: '',
    owner_name: '', owner_email: '', owner_password: 'Password@123',
  });

  // Re-assign Owner State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignRestaurant, setReassignRestaurant] = useState(null);
  const [reassignForm, setReassignForm] = useState({
    full_name: '', email: '', phone: '', password: 'Password@123',
  });

  // Users Management State
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');

  useEffect(() => {
    fetchUsersList();
  }, []);

  const fetchUsersList = async () => {
    try {
      const res = await api.get('/users/');
      setUsersList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Failed to fetch platform users:', err.message);
    }
  };

  // Edit Restaurant state
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', description: '', cuisine_type: '', is_active: true,
  });

  // Logo upload state
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;

    let logo_url = null;

    // 1. Upload logo first if one was selected
    if (logoFile) {
      setLogoUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', logoFile);
        const uploadRes = await api.post('/upload/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logo_url = uploadRes.data.url;
      } catch (err) {
        addToast('error', 'Logo Upload Failed', err?.response?.data?.detail || err.message);
        setLogoUploading(false);
        return;
      }
      setLogoUploading(false);
    }

    // 2. Create restaurant with logo_url and owner user credentials
    const payload = {
      name: form.name,
      slug: form.name.toLowerCase().trim().replace(/\s+/g, '-'),
      city: form.city || null,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      description: form.description || null,
      cuisine_type: form.cuisine_type || null,
      logo_url,
      is_active: true,
      owner_name: form.owner_name || `${form.name} Owner`,
      owner_email: form.owner_email || form.email || null,
      owner_password: form.owner_password || 'Password@123',
    };

    try {
      await api.post('/restaurants/', payload);
      addToast('success', 'Restaurant Created', `"${form.name}" onboarded & Owner Account created!`);
      if (fetchRestaurants) fetchRestaurants();
    } catch (err) {
      console.warn('Backend API call failed:', err?.response?.data?.detail || err.message);
      addToast('error', 'Failed to Create', err?.response?.data?.detail || 'Could not reach backend.');
    }

    setShowAddModal(false);
    setForm({ name: '', email: '', phone: '', address: '', city: '', description: '', cuisine_type: '', owner_name: '', owner_email: '', owner_password: 'Password@123' });
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleOpenEdit = (r) => {
    setEditingRestaurant(r);
    setEditForm({
      name: r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      address: r.address || '',
      city: r.city || '',
      description: r.description || '',
      cuisine_type: r.cuisine_type || '',
      is_active: r.is_active ?? true,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRestaurant || !editForm.name) return;

    try {
      await api.put(`/restaurants/${editingRestaurant.id}`, editForm);
      addToast('success', 'Restaurant Updated', `"${editForm.name}" updated successfully!`);
      if (fetchRestaurants) fetchRestaurants();
      setEditingRestaurant(null);
    } catch (err) {
      addToast('error', 'Update Failed', err?.response?.data?.detail || err.message);
    }
  };

  const handleDeleteRestaurant = (id, name) => {
    requestConfirm({
      title: `Delete ${name}?`,
      message: `Are you sure you want to permanently delete "${name}" from PostgreSQL database? This action cannot be undone.`,
      confirmText: 'Yes, Delete Permanently',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurants/${id}`);
          addToast('success', 'Restaurant Deleted', `"${name}" removed from database.`);
          if (fetchRestaurants) fetchRestaurants();
        } catch (err) {
          addToast('error', 'Delete Failed', err?.response?.data?.detail || err.message);
        }
      }
    });
  };

  const handleOpenReassign = (r) => {
    setReassignRestaurant(r);
    setReassignForm({
      full_name: '',
      email: '',
      phone: '',
      password: 'Password@123',
    });
    setShowReassignModal(true);
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignRestaurant || !reassignForm.email || !reassignForm.full_name) return;

    try {
      const payload = {
        full_name: reassignForm.full_name,
        email: reassignForm.email,
        phone: reassignForm.phone || null,
        password: reassignForm.password || 'Password@123',
        role: 'restaurant_admin',
        restaurant_id: reassignRestaurant.id,
      };

      await api.post('/users/', payload);
      addToast('success', 'Admin Re-assigned', `New owner account created & assigned to "${reassignRestaurant.name}"!`);
      setShowReassignModal(false);
      fetchUsersList();
      fetchRestaurants();
    } catch (err) {
      addToast('error', 'Re-assign Failed', err?.response?.data?.detail || err.message);
    }
  };

  const filtered = (restaurants || []).filter(r => {
    const nameStr = (r?.name || '').toLowerCase();
    const ownerStr = (r?.owner_name || r?.owner || '').toLowerCase();
    const searchLower = (search || '').toLowerCase();
    const matchSearch = nameStr.includes(searchLower) || ownerStr.includes(searchLower);

    const rStatus = r?.is_active ? 'Active' : 'Suspended';
    const matchStatus = statusFilter === 'All' || rStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Banner */}
      <div className="panel-card" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(19, 27, 46, 0.9))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-danger" style={{ marginBottom: '0.5rem' }}>
              🌐 PLATFORM SUPERADMIN CONTROL CENTER
            </span>
            <h1 style={{ fontSize: '1.8rem' }}>
              {activeRoute === '/admin/users' 
                ? 'Platform Users Directory' 
                : activeRoute === '/admin/restaurants'
                ? 'Restaurants Management'
                : 'DineBuddy Platform Administration'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {activeRoute === '/admin/users'
                ? 'View and audit all registered platform users, superadmins, and restaurant owners.'
                : 'Manage platform restaurants, onboard new venues, and manage store access.'}
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={18} /> Add New Restaurant
          </button>
        </div>
      </div>

      {/* KPI Cards — only real data from /restaurants/ & /users/ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>TOTAL RESTAURANTS</span>
            <Building2 size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem' }}>{restaurants.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Onboarded in platform</div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>ACTIVE RESTAURANTS</span>
            <CheckCircle size={20} color="var(--success)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)' }}>
            {restaurants.filter(r => r.is_active).length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Currently active</div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>PLATFORM USERS</span>
            <Users size={20} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--warning)' }}>
            {usersList.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Registered accounts</div>
        </div>
      </div>

      {/* VIEW 1: PLATFORM USERS VIEW (/admin/users) */}
      {activeRoute === '/admin/users' ? (
        <div className="panel-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} color="var(--accent-primary)" /> Platform Registered Users
            </h3>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Search user name/email..." 
                  className="input-control" 
                  style={{ paddingLeft: '2.2rem' }}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              <select className="select-control" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} style={{ width: '150px' }}>
                <option value="All">All Roles</option>
                <option value="ADMIN">Superadmin</option>
                <option value="RESTAURANT_ADMIN">Restaurant Admin</option>
                <option value="RESTAURANT_STAFF">Staff</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Loading platform users from database...
                    </td>
                  </tr>
                ) : (
                  usersList
                    .filter(u => {
                      const matchQuery = (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                                         (u.email || '').toLowerCase().includes(userSearch.toLowerCase());
                      const roleUpper = (u.role || '').toUpperCase();
                      const matchRole = userRoleFilter === 'All' || roleUpper === userRoleFilter || (userRoleFilter === 'ADMIN' && roleUpper === 'ADMIN');
                      return matchQuery && matchRole;
                    })
                    .map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name || 'N/A'}</div>
                        </td>
                        <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{u.email}</td>
                        <td>
                          <span className={`badge ${
                            u.role === 'admin' ? 'badge-danger' : u.role === 'restaurant_admin' ? 'badge-role' : 'badge-success'
                          }`}>
                            {u.role === 'admin' ? '🌐 SUPERADMIN' : u.role === 'restaurant_admin' ? '🏪 RESTAURANT OWNER' : '👨‍🍳 STAFF'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: u.is_verified ? 'var(--success)' : 'var(--text-muted)' }}>
                            {u.is_verified ? '✓ Verified' : 'Unverified'}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* VIEW 2: RESTAURANTS DIRECTORY TABLE (/admin/dashboard & /admin/restaurants) */}
      {activeRoute !== '/admin/users' ? (
        <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={20} color="var(--accent-primary)" /> Platform Restaurant Directory
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search restaurant..." 
                className="input-control" 
                style={{ paddingLeft: '2.2rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select className="select-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '130px' }}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Slug</th>
                <th>City</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No matching restaurants found in database.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {r.logo_url ? (
                          <img
                            src={getMediaUrl(r.logo_url)}
                            alt={r.name}
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-color)',
                              background: '#fff',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</div>
                          {r.cuisine_type && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.cuisine_type}</span>}
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.slug}</span></td>
                    <td>{r.city || r.address || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>
                      <span className={`badge ${r.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button onClick={() => switchRestaurant(r.id)} className="btn btn-secondary btn-sm" title="Inspect Restaurant">
                          <Eye size={14} /> Inspect
                        </button>
                        <button onClick={() => handleOpenReassign(r)} className="btn btn-secondary btn-sm" title="Re-assign Owner Admin Credentials">
                          <UserCheck size={14} /> Re-assign Owner
                        </button>
                        <button onClick={() => handleOpenEdit(r)} className="btn btn-secondary btn-sm" title="Edit Restaurant">
                          <Edit size={14} /> Edit
                        </button>
                        <button onClick={() => handleDeleteRestaurant(r.id, r.name)} className="btn btn-danger btn-sm" title="Delete Restaurant">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {/* Add Restaurant Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '560px' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>🏪 Onboard New Restaurant</h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Restaurant Name */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Restaurant Name *</label>
                <input type="text" required placeholder="e.g. Royal Punjab Dhaba" className="input-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              {/* Phone + Restaurant Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Phone Number</label>
                  <input type="text" placeholder="+91 98765 43210" className="input-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Restaurant Contact Email</label>
                  <input type="email" placeholder="contact@restaurant.com" className="input-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              {/* Owner Account Section */}
              <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔑 Restaurant Admin Account (For Login)
                </span>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Owner Full Name</label>
                  <input type="text" placeholder="e.g. Ramesh Kumar" className="input-control" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Owner Login Email *</label>
                    <input type="email" required placeholder="owner@gmail.com" className="input-control" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Initial Password *</label>
                    <input type="text" required placeholder="Password@123" className="input-control" value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} />
                  </div>
                </div>
              </div>


              {/* City + Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>City</label>
                  <input type="text" placeholder="Delhi" className="input-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Street Address</label>
                  <input type="text" placeholder="123 Main Street..." className="input-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>

              {/* Cuisine Type */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Cuisine Type</label>
                <select className="select-control" value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })}>
                  <option value="">— Select Cuisine —</option>
                  <option value="North Indian">North Indian</option>
                  <option value="South Indian">South Indian</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Continental">Continental</option>
                  <option value="Italian">Italian</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Bakery & Cafe">Bakery & Cafe</option>
                  <option value="Multi-Cuisine">Multi-Cuisine</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Description (optional)</label>
                <textarea rows={2} placeholder="Brief description of the restaurant..." className="input-control" style={{ resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Logo Upload */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  Restaurant Logo (optional)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Preview box */}
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '12px',
                      border: '2px dashed var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <ImageIcon size={28} color="var(--text-muted)" />
                    )}
                  </div>

                  {/* Pick / Remove buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload size={14} /> {logoPreview ? 'Change Logo' : 'Pick Logo'}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', background: 'transparent', fontSize: '0.75rem' }}
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      >
                        <X size={13} /> Remove
                      </button>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      JPEG / PNG / WebP · Max 5 MB
                    </span>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleLogoSelect}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Onboard Restaurant to DB</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Edit Restaurant Modal */}
      {editingRestaurant && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '560px' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>✏️ Edit Restaurant #{editingRestaurant.id}</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Restaurant Name *</label>
                <input type="text" required className="input-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Phone Number</label>
                  <input type="text" className="input-control" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Email Address</label>
                  <input type="email" className="input-control" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>City</label>
                  <input type="text" className="input-control" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Address</label>
                  <input type="text" className="input-control" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Cuisine Type</label>
                <select className="select-control" value={editForm.cuisine_type} onChange={(e) => setEditForm({ ...editForm, cuisine_type: e.target.value })}>
                  <option value="">— Select Cuisine —</option>
                  <option value="North Indian">North Indian</option>
                  <option value="South Indian">South Indian</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Continental">Continental</option>
                  <option value="Italian">Italian</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Bakery & Cafe">Bakery & Cafe</option>
                  <option value="Multi-Cuisine">Multi-Cuisine</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Description</label>
                <textarea rows={2} className="input-control" style={{ resize: 'vertical' }} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="edit_is_active" 
                  checked={editForm.is_active} 
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} 
                  style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="edit_is_active" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Restaurant Active Status</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditingRestaurant(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Re-assign Owner Modal */}
      {showReassignModal && reassignRestaurant && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <UserCheck size={20} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Re-assign Restaurant Owner</h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Creating new admin credentials for: <strong style={{ color: 'var(--accent-primary)' }}>"{reassignRestaurant.name}"</strong>
                </p>
              </div>
              <button onClick={() => setShowReassignModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.8rem',
              color: '#f87171',
            }}>
              ⚠️ A <strong>new Restaurant Admin account</strong> will be created and linked to this restaurant. The old (deleted) admin's credentials will no longer work.
            </div>

            <form onSubmit={handleReassignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. Atharva Mishra"
                  value={reassignForm.full_name}
                  onChange={(e) => setReassignForm({ ...reassignForm, full_name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  className="input-control"
                  placeholder="e.g. newowner@thelab93.com"
                  value={reassignForm.email}
                  onChange={(e) => setReassignForm({ ...reassignForm, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Phone (Optional)</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="+91 98765 43210"
                    value={reassignForm.phone}
                    onChange={(e) => setReassignForm({ ...reassignForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>New Password *</label>
                  <input
                    type="text"
                    required
                    className="input-control"
                    placeholder="Password@123"
                    value={reassignForm.password}
                    onChange={(e) => setReassignForm({ ...reassignForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowReassignModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <UserCheck size={15} /> Create & Assign Owner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

