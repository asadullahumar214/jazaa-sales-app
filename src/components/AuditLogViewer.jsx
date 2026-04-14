import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../store';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [filterAction, setFilterAction] = useState('All');

  useEffect(() => {
    setLogs(getAuditLogs());
    const interval = setInterval(() => setLogs(getAuditLogs()), 3000);
    return () => clearInterval(interval);
  }, []);

  const actionTypes = ['All', ...new Set(logs.map(l => l.action))];
  const filteredLogs = filterAction === 'All' ? logs : logs.filter(l => l.action === filterAction);

  const getActionBadge = (action) => {
    const styles = {
      STOCK_OVERWRITE: { bg: 'rgba(251, 191, 36, 0.15)', color: '#d97706' },
      FRESH_PURCHASE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669' },
      USER_CREATED: { bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb' },
      USER_ACTIVATED: { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669' },
      USER_DEACTIVATED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' },
      USER_DELETED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' },
      ORDER_CANCELLED: { bg: 'rgba(251, 191, 36, 0.15)', color: '#d97706' },
    };
    const s = styles[action] || { bg: '#f1f5f9', color: '#64748b' };
    return (
      <span style={{
        display: 'inline-block',
        padding: '0.15rem 0.5rem',
        borderRadius: '99px',
        fontSize: '0.7rem',
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap'
      }}>
        {action}
      </span>
    );
  };

  return (
    <div className="card mt-4 mb-4">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h3>📋 Audit Trail</h3>
        <div className="flex items-center gap-4" style={{ gap: '0.5rem' }}>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>Filter:</span>
          <select 
            className="form-select" 
            style={{ width: 'auto', minHeight: '36px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-muted" style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>
          No audit entries recorded yet.
        </div>
      ) : (
        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Action</th>
                <th>User</th>
                <th>Details</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice().reverse().map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    {new Date(log.date).toLocaleString()}
                  </td>
                  <td>{getActionBadge(log.action)}</td>
                  <td style={{ fontWeight: 500 }}>{log.userId}</td>
                  <td style={{ fontSize: '0.85rem', maxWidth: '300px', whiteSpace: 'normal' }}>
                    {log.details}
                  </td>
                  <td style={{ fontSize: '0.85rem', fontStyle: log.reason ? 'normal' : 'italic', color: log.reason ? 'inherit' : 'var(--text-muted)' }}>
                    {log.reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
