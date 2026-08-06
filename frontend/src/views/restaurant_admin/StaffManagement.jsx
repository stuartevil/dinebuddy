import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { Users, Plus, Search, Mail, Phone, Shield, Trash2, CheckCircle, Edit3 } from 'lucide-react';

export const StaffManagement = () => {
  const { addToast, selectedRestaurant, requestConfirm } = useAuth();

  const [staffList, setStaffList] = useState([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Cashier & POS', password: 'password123' });

  const [loading, setLoading] = useState(true);

  // Fetch real staff list from backend API
  const fetchStaffList = async () => {
    if (!selectedRestaurant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/users/', { params: { restaurant_id: selectedRestaurant.id } });
      const rawUsers = Array.isArray(res.data) ? res.data : [];
      
      const formatted = rawUsers.map(u => ({
        id: u.id,
        name: u.full_name,
        email: u.email,
        phone: u.phone || '—',
        role: u.role === 'restaurant_admin' ? 'Assistant Manager' : 'Cashier & POS',
        status: u.is_active ? 'Active' : 'Inactive',
        joined: new Date().toISOString().split('T')[0],
      }));
      setStaffList(formatted);
    } catch (err) {
      console.warn('Failed to load staff list from API:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
  }, [selectedRestaurant]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !selectedRestaurant) return;

    try {
      const payload = {
        full_name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password || 'password123',
        role: 'restaurant_staff',
        restaurant_id: selectedRestaurant.id,
      };

      const userRes = await api.post('/users/', payload);
      const newUser = userRes.data;

      addToast('success', 'Staff Member Added', `"${form.name}" onboarded & assigned to ${selectedRestaurant.name}!`);
      setShowAddModal(false);
      setForm({ name: '', email: '', phone: '', role: 'Cashier & POS', password: 'password123' });
      fetchStaffList();
    } catch (err) {
      addToast('error', 'Staff Creation Failed', err?.response?.data?.detail || err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextIsActive = currentStatus !== 'Active';
    try {
      await api.patch(`/users/${id}/status`, { is_active: nextIsActive });
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, status: nextIsActive ? 'Active' : 'Inactive' } : s));
      addToast('info', 'Staff Status Updated', `Staff status updated to ${nextIsActive ? 'Active' : 'Inactive'}`);
      fetchStaffList();
    } catch (err) {
      addToast('error', 'Status Update Failed', err?.response?.data?.detail || err.message);
    }
  };

  const handleDeleteStaff = (id, name) => {
    requestConfirm({
      title: `Remove Staff Member ${name}?`,
      message: `Are you sure you want to remove ${name} from ${selectedRestaurant.name}? This action cannot be undone.`,
      confirmText: 'Remove Staff',
      onConfirm: async () => {
        try {
          await api.delete(`/users/${id}`);
          setStaffList(prev => prev.filter(s => s.id !== id));
          addToast('warning', 'Staff Removed', `${name} has been removed.`);
          fetchStaffList();
        } catch (err) {
          addToast('error', 'Remove Failed', err?.response?.data?.detail || err.message);
        }
      }
    });
  };

  const filtered = staffList.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All' || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header Banner */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-role" style={{ marginBottom: '0.5rem' }}>
              🏪 {selectedRestaurant.name} • TEAM MANAGEMENT
            </span>
            <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={24} color="var(--accent-primary)" /> Restaurant Staff & Employee Management
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Create accounts for cashiers, kitchen chefs, waiters, and assign operational roles.
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} /> Add Staff Member
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL TEAM MEMBERS</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem' }}>{staffList.length}</div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTIVE STAFF</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--success)' }}>
            {staffList.filter(s => s.status === 'Active').length}
          </div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>KITCHEN CHEFS</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--accent-primary)' }}>
            {staffList.filter(s => s.role.includes('Chef')).length}
          </div>
        </div>

        <div className="panel-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>CASHIERS & WAITERS</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--info)' }}>
            {staffList.filter(s => s.role.includes('Cashier') || s.role.includes('Waiter')).length}
          </div>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search staff by name/email..."
              className="input-control"
              style={{ paddingLeft: '2.2rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="select-control" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: '180px' }}>
            <option value="All">All Staff Roles</option>
            <option value="Cashier & POS">Cashier & POS</option>
            <option value="Head Kitchen Chef">Head Kitchen Chef</option>
            <option value="Floor Waiter">Floor Waiter</option>
            <option value="Assistant Manager">Assistant Manager</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading restaurant staff members from database...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div>No staff members found for this restaurant yet.</div>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
              <Plus size={14} /> Add First Staff Member
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Name & Email</th>
                  <th>Phone Number</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.email}</span>
                    </td>
                    <td>{s.phone}</td>
                    <td><span className="badge badge-role">{s.role}</span></td>
                    <td>
                      <span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.joined}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleToggleStatus(s.id, s.status)} className={`btn btn-sm ${s.status === 'Active' ? 'btn-danger' : 'btn-success'}`}>
                          {s.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDeleteStaff(s.id, s.name)} className="btn btn-danger btn-sm" title="Delete Staff">
                          <Trash2 size={14} />
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

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 style={{ marginBottom: '1.25rem' }}>Add New Staff Member</h3>
            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Full Name *</label>
                <input type="text" required placeholder="e.g. Ramesh Kumar" className="input-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Email Address *</label>
                  <input type="email" required placeholder="ramesh@dinebuddy.com" className="input-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Phone Number</label>
                  <input type="text" placeholder="+91 98765 43210" className="input-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Operational Role</label>
                  <select className="select-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="Cashier & POS">Cashier & POS</option>
                    <option value="Head Kitchen Chef">Head Kitchen Chef</option>
                    <option value="Floor Waiter">Floor Waiter</option>
                    <option value="Assistant Manager">Assistant Manager</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Initial Password</label>
                  <input type="password" required className="input-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
