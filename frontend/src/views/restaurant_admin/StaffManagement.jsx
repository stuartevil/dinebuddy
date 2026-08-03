import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiClient';
import { Users, Plus, Search, Mail, Phone, Shield, Trash2, CheckCircle, Edit3 } from 'lucide-react';

export const StaffManagement = () => {
  const { addToast, selectedRestaurant, requestConfirm } = useAuth();

  const [staffList, setStaffList] = useState([
    { id: 101, name: 'Rahul Sharma', email: 'rahul.sharma@dinebuddy.com', phone: '+91 98123 45678', role: 'Cashier & POS', status: 'Active', joined: '2025-12-01' },
    { id: 102, name: 'Chef Suresh Kumar', email: 'suresh.chef@dinebuddy.com', phone: '+91 98765 12345', role: 'Head Kitchen Chef', status: 'Active', joined: '2026-01-10' },
    { id: 103, name: 'Priya Verma', email: 'priya.waiter@dinebuddy.com', phone: '+91 91234 88888', role: 'Floor Waiter', status: 'Active', joined: '2026-02-05' },
    { id: 104, name: 'Amit Patel', email: 'amit.p@dinebuddy.com', phone: '+91 99887 11111', role: 'Assistant Manager', status: 'Inactive', joined: '2026-02-15' },
  ]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Cashier & POS', password: 'password123' });

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !selectedRestaurant) return;

    try {
      // 1. Create staff user in database
      const userRes = await api.post('/users/', {
        full_name: form.name,
        email: form.email,
        password: form.password || 'password123',
        role: 'RESTAURANT_STAFF',
      });

      const newUser = userRes.data;

      // 2. Assign staff user to current restaurant
      await api.post(`/restaurants/${selectedRestaurant.id}/staff`, {
        user_id: newUser.id,
      });

      const created = {
        id: newUser.id,
        name: newUser.full_name,
        email: newUser.email,
        phone: form.phone || '+91 98000 00000',
        role: form.role,
        status: 'Active',
        joined: new Date().toISOString().split('T')[0],
      };

      setStaffList(prev => [...prev, created]);
      setShowAddModal(false);
      addToast('success', 'Staff Member Added', `"${form.name}" onboarded & assigned to ${selectedRestaurant.name}!`);
      setForm({ name: '', email: '', phone: '', role: 'Cashier & POS', password: 'password123' });
    } catch (err) {
      addToast('error', 'Staff Creation Failed', err?.response?.data?.detail || err.message);
    }
  };

  const handleToggleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    addToast('info', 'Staff Status Updated', `Staff status changed to ${nextStatus}`);
  };

  const handleDeleteStaff = (id, name) => {
    requestConfirm({
      title: `Remove Staff Member ${name}?`,
      message: `Are you sure you want to remove ${name} from ${selectedRestaurant.name}? This action cannot be undone.`,
      confirmText: 'Remove Staff',
      onConfirm: () => {
        setStaffList(prev => prev.filter(s => s.id !== id));
        addToast('warning', 'Staff Removed', `${name} has been removed.`);
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
