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
    
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parsed
      }
    }));
  };

  const saveSettings = async () => {
    await setTaxSettings(settings);
    await addAuditLog({
      action: 'SETTINGS_UPDATED',
      userId: 'admin',
      details: `Updated tax and system logic configurations.`
    });
    alert("Settings saved successfully! Future orders will use these rates.");
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

      <div className="card mb-6 border-l-4 border-l-primary bg-slate-50">
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
           <p className="text-xs text-muted">This color will be used for buttons, headers, and highlights across the entire app.</p>
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
