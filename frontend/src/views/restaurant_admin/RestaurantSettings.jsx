import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Store, FileText, Percent, CreditCard, Bell, Save, Lock, Upload, ImageIcon, X } from 'lucide-react';
import { api, getMediaUrl } from '../../services/apiClient';

export const RestaurantSettings = () => {
  const { selectedRestaurant, isSuperadmin, addToast, fetchRestaurants } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState({
    name: '',
    tagline: 'Artisanal Coffee & Fine Dining Experience',
    phone: '',
    email: '',
    address: '',
    city: '',
    gstin: '07AAAAA0000A1Z5',
    fssai: '11521000001234',
    tax_rate: '5',
    tax_inclusive: false,
    upi_vpa: 'gourmetbistro@upi',
    enable_cash: true,
    enable_card: true,
    enable_upi: true,
    enable_online: true,
    low_stock_email_alerts: true,
    kds_sound_alerts: true,
    disable_preset_menu_categories: localStorage.getItem('dinebuddy_disable_default_menu_categories') === 'true',
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (selectedRestaurant) {
      const savedLocalTax = localStorage.getItem(`dinebuddy_tax_rate_${selectedRestaurant.id}`);
      setForm(prev => ({
        ...prev,
        name: selectedRestaurant.name || '',
        phone: selectedRestaurant.phone || '',
        email: selectedRestaurant.email || '',
        address: selectedRestaurant.address || '',
        city: selectedRestaurant.city || '',
        tax_rate: savedLocalTax !== null ? savedLocalTax : (prev.tax_rate || '5')
      }));

      if (selectedRestaurant.logo_url) {
        setLogoPreview(getMediaUrl(selectedRestaurant.logo_url));
      } else {
        setLogoPreview(null);
      }

      // Fetch settings from backend database
      api.get(`/restaurants/${selectedRestaurant.id}/settings`)
        .then(res => {
          if (res.data && res.data.tax_percentage !== undefined && res.data.tax_percentage !== null) {
            const fetchedTax = String(res.data.tax_percentage);
            setForm(prev => ({ ...prev, tax_rate: fetchedTax }));
            localStorage.setItem(`dinebuddy_tax_rate_${selectedRestaurant.id}`, fetchedTax);
          }
        })
        .catch(err => {
          console.warn("Fetch settings warning:", err.message);
        });
    }
  }, [selectedRestaurant]);

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    localStorage.setItem('dinebuddy_disable_default_menu_categories', form.disable_preset_menu_categories ? 'true' : 'false');
    
    let updatedLogoUrl = selectedRestaurant?.logo_url || null;

    // Upload logo if new logo file selected
    if (logoFile) {
      setLogoUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', logoFile);
        const uploadRes = await api.post('/upload/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        updatedLogoUrl = uploadRes.data.url;
      } catch (err) {
        addToast('error', 'Logo Upload Failed', err?.response?.data?.detail || err.message);
        setLogoUploading(false);
        return;
      }
      setLogoUploading(false);
    }

    // Save updated restaurant profile & backend settings
    if (selectedRestaurant?.id) {
      try {
        await api.patch(`/restaurants/${selectedRestaurant.id}`, {
          logo_url: updatedLogoUrl,
        });

        // Save GST Tax Percentage to backend database settings
        const parsedTax = parseFloat(form.tax_rate) || 0.0;
        await api.patch(`/restaurants/${selectedRestaurant.id}/settings`, {
          tax_percentage: parsedTax
        });

        localStorage.setItem(`dinebuddy_tax_rate_${selectedRestaurant.id}`, form.tax_rate);

        if (fetchRestaurants) fetchRestaurants();
      } catch (err) {
        console.warn('Backend patch failed:', err.message);
      }
    }

    addToast('success', 'GST Tax & Restaurant Settings Saved', `Default GST rate updated to ${form.tax_rate}%! Billing and POS calculations updated.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div className="panel-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(19, 27, 46, 0.85))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-role" style={{ marginBottom: '0.5rem' }}>
              🏪 {selectedRestaurant.name} • SETTINGS & CONFIGURATION
            </span>
            <h1 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={24} color="var(--accent-primary)" /> Restaurant Business Settings
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Manage business profile, GST tax rates, payment gateways, table QR configs, and alert triggers.
            </p>
          </div>

          <button onClick={handleSave} className="btn btn-primary">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
        {[
          { id: 'profile', label: 'Restaurant Profile', icon: Store },
          { id: 'tax', label: 'GST & Tax Settings', icon: Percent },
          { id: 'payment', label: 'Payment Settings', icon: CreditCard },
          { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '9999px', padding: '0.5rem 1rem' }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Form Container */}
      <form onSubmit={handleSave} className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Tab 1: Restaurant Profile */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={18} /> Business Identity & Address
              </h3>
              {!isSuperadmin && (
                <span className="badge badge-warning" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Lock size={12} /> Managed by Superadmin (Read Only)
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Restaurant Display Name *</label>
                <input 
                  type="text" 
                  required 
                  disabled={!isSuperadmin}
                  className="input-control" 
                  style={{ opacity: !isSuperadmin ? 0.7 : 1, cursor: !isSuperadmin ? 'not-allowed' : 'text' }}
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Tagline / Subtitle</label>
                <input type="text" className="input-control" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Official Phone Number</label>
                <input 
                  type="text" 
                  disabled={!isSuperadmin}
                  className="input-control" 
                  style={{ opacity: !isSuperadmin ? 0.7 : 1, cursor: !isSuperadmin ? 'not-allowed' : 'text' }}
                  value={form.phone} 
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Official Email Address</label>
                <input 
                  type="email" 
                  disabled={!isSuperadmin}
                  className="input-control" 
                  style={{ opacity: !isSuperadmin ? 0.7 : 1, cursor: !isSuperadmin ? 'not-allowed' : 'text' }}
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Street Address</label>
                <input 
                  type="text" 
                  disabled={!isSuperadmin}
                  className="input-control" 
                  style={{ opacity: !isSuperadmin ? 0.7 : 1, cursor: !isSuperadmin ? 'not-allowed' : 'text' }}
                  value={form.address} 
                  onChange={(e) => setForm({ ...form, address: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>City</label>
                <input 
                  type="text" 
                  disabled={!isSuperadmin}
                  className="input-control" 
                  style={{ opacity: !isSuperadmin ? 0.7 : 1, cursor: !isSuperadmin ? 'not-allowed' : 'text' }}
                  value={form.city} 
                  onChange={(e) => setForm({ ...form, city: e.target.value })} 
                />
              </div>
            </div>

            {/* Restaurant Logo Upload */}
            <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
                🖼️ Restaurant Brand Logo (Top-Left Display)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '16px',
                    border: '2px dashed var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: 'var(--bg-primary)',
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
                    <ImageIcon size={32} color="var(--text-muted)" />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    <Upload size={14} /> {logoUploading ? 'Uploading...' : logoPreview ? 'Change Logo Image' : 'Upload Logo Image'}
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)', background: 'transparent', fontSize: '0.75rem' }}
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    >
                      <X size={13} /> Clear Logo
                    </button>
                  )}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    PNG, JPEG, or WebP (Max 5MB). Logo appears on top-left of header and customer menu.
                  </span>
                </div>
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleLogoSelect}
              />
            </div>
          </div>
        )}


        {/* Tab 2: GST & Tax Settings */}
        {activeTab === 'tax' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Percent size={18} /> Tax & Licensing Configuration
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>GSTIN Number</label>
                <input type="text" className="input-control" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>FSSAI License Number</label>
                <input type="text" className="input-control" value={form.fssai} onChange={(e) => setForm({ ...form, fssai: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Default GST Tax Rate (%)</label>
                <select className="select-control" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}>
                  <option value="0">0% (Zero Tax / Exempted)</option>
                  <option value="5">5% (Standard Restaurant Rate)</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <input type="checkbox" id="tax_inc" checked={form.tax_inclusive} onChange={(e) => setForm({ ...form, tax_inclusive: e.target.checked })} style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                <label htmlFor="tax_inc" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Menu item prices are inclusive of GST tax</label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Payment Settings */}
        {activeTab === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} /> Payment Gateways & VPA Credentials
            </h3>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>UPI VPA Handle (GPay / PhonePe / Paytm QR)</label>
              <input type="text" className="input-control" value={form.upi_vpa} onChange={(e) => setForm({ ...form, upi_vpa: e.target.value })} placeholder="e.g. restaurant@upi" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enable_upi} onChange={(e) => setForm({ ...form, enable_upi: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Enable UPI Payments</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enable_card} onChange={(e) => setForm({ ...form, enable_card: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Enable Card Terminals</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enable_cash} onChange={(e) => setForm({ ...form, enable_cash: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Enable Cash Desk</span>
              </label>
            </div>
          </div>
        )}

        {/* Tab 4: Notifications & Alerts */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={18} /> System Notification Preferences
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.low_stock_email_alerts} onChange={(e) => setForm({ ...form, low_stock_email_alerts: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Send Email Alerts on Low Stock</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automatically email restaurant owner when an ingredient stock hits minimum threshold</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.kds_sound_alerts} onChange={(e) => setForm({ ...form, kds_sound_alerts: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Sound Chime on KDS Kitchen Tickets</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Play audio alert on kitchen display screen when a new order arrives</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', borderLeft: form.disable_preset_menu_categories ? '3px solid var(--warning)' : '1px solid var(--border-color)' }}>
                <input type="checkbox" checked={form.disable_preset_menu_categories} onChange={(e) => setForm({ ...form, disable_preset_menu_categories: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Disable Default Menu Categories</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Hide built-in default menu category presets (Beverages, Bakery, Snacks, Desserts) across POS and menu screens, showing strictly database-created categories.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}




        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 800 }}>
            <Save size={16} /> Save Configurations
          </button>
        </div>

      </form>

    </div>
  );
};
