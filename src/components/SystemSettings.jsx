import React, { useState, useEffect } from 'react';
import { getTaxSettings, setTaxSettings, addAuditLog } from '../store';

export default function SystemSettings() {
  const [settings, setLocalSettings] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const s = await getTaxSettings();
      setLocalSettings(s);
    };
    fetch();
  }, []);

  const handleChange = (category, field, value) => {
    let parsed = parseFloat(value);
    if (isNaN(parsed)) parsed = 0;
    
    if (!field) {
        // Direct update for top-level fields
        setLocalSettings(prev => ({ ...prev, [category]: parsed }));
        return;
    }

    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parsed
      }
    }));
  };

  const saveSettings = async () => {
    // Ensure defaults for intelligence
    const finalSettings = {
        ...settings,
        aging_threshold: settings.aging_threshold || 10
    };
    await setTaxSettings(finalSettings);
    await addAuditLog({
      action: 'SETTINGS_UPDATED',
      userId: 'admin',
      details: `Updated tax and system logic configurations.`
    });
    alert("Settings saved successfully!");
  };

  if (!settings) return null;

  const categories = [
    { key: 'ur', label: 'Unregistered (None) ➔ 2.5%' },
    { key: 'it', label: 'IT Registered ➔ 0.5%' },
    { key: 'registered', label: 'STRN + IT (Both) ➔ 0.5%' }
  ];

  const handleColorChange = (val) => {
    setLocalSettings(prev => ({
      ...prev,
      primary_color: val
    }));
  };

  return (
    <div className="card mt-4 mb-4">
      <h3>⚙️ System Logic & Settings</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Adjust tax percentages across different customer profiles and product types. Values are decimals (e.g., 0.18 for 18%). FOC adjustments should be handled through inventory.
      </p>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="card !bg-slate-50 border-l-4 border-l-primary">
            <h4 className="text-sm font-bold uppercase mb-2">App Branding</h4>
            <div className="flex items-center gap-4">
              <div className="form-group mb-0">
                <label className="text-[10px]">Primary Theme Color</label>
                <input 
                  type="color" 
                  value={settings.primary_color || '#2563eb'} 
                  onChange={e => handleColorChange(e.target.value)}
                  className="h-10 w-20 cursor-pointer rounded border-none p-0"
                />
              </div>
              <p className="text-xs text-muted">This color will be used for buttons and headers.</p>
            </div>
          </div>

          <div className="card !bg-amber-50 border-l-4 border-l-amber-400">
            <h4 className="text-sm font-bold uppercase mb-2 text-amber-900">Business Intelligence</h4>
            <div className="flex items-center gap-4">
              <div className="form-group mb-0">
                <label className="text-[10px] text-amber-700">Slow Moving Threshold (Days)</label>
                <input 
                  type="number" 
                  value={settings.aging_threshold || 10} 
                  onChange={e => handleChange('aging_threshold', null, e.target.value)}
                  className="form-input !h-10 !w-24 text-center font-bold"
                />
              </div>
              <p className="text-[11px] text-amber-800">Identify products that haven't sold in this many days in the intelligence reports.</p>
            </div>
          </div>
       </div>

      <div className="grid grid-cols-1 md-grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {categories.map(({ key, label }) => (
          <div key={key} className="card" style={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>{label}</h4>
            
            <div className="form-group">
              <label>Advance Tax (e.g. 0.005 = 0.5%)</label>
              <input 
                type="number" step="0.001" className="form-input" 
                value={settings[key]?.advPct || 0}
                onChange={e => handleChange(key, 'advPct', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>GST - Core Products (N)</label>
              <input 
                type="number" step="0.01" className="form-input" 
                value={settings[key]?.n || 0}
                onChange={e => handleChange(key, 'n', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>GST - Rice (R)</label>
              <input 
                type="number" step="0.01" className="form-input" 
                value={settings[key]?.r || 0}
                onChange={e => handleChange(key, 'r', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>GST - Recipe (TS)</label>
              <input 
                type="number" step="0.01" className="form-input" 
                value={settings[key]?.ts || 0}
                onChange={e => handleChange(key, 'ts', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>GST - Exempt (E)</label>
              <input 
                type="number" step="0.01" className="form-input" 
                value={settings[key]?.e || 0}
                onChange={e => handleChange(key, 'e', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={saveSettings} className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}
