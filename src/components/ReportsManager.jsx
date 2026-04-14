import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getOrders, getUsers } from '../store';

export default function ReportsManager() {
  const [orders, setOrders] = useState([]);
  const [users, setLocalUsers] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      const ords = await getOrders();
      const usrs = await getUsers();
      setOrders(ords);
      setLocalUsers(usrs.filter(u => u.role !== 'admin'));
    };
    fetch();
  }, []);

  const handleExport = (bookerId = 'ALL') => {
    // Filter orders
    let filteredOrders = (orders || []);
    if (bookerId !== 'ALL') {
      filteredOrders = filteredOrders.filter(o => o.bookerId === bookerId);
    }

    if (filteredOrders.length === 0) {
      alert("No data found for the selected exporter.");
      return;
    }

    // Flatten for Excel
    const rows = [];
    filteredOrders.forEach(o => {
      // Create one row per item
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          rows.push({
            'Date': new Date(o.date).toLocaleDateString(),
            'Order ID': o.id,
            'Status': (o.status || '').toUpperCase(),
            'OrderBooker ID': o.bookerId,
            'Customer Name': o.customerName,
            'Invoice Format': o.invoiceFormat || 'TP',
            'Product ID': item.id,
            'Qty Ordered': item.qty,
            'Order Total Value (Rs.)': o.totalValue,
            'Cancel Reason': o.cancel_reason || ''
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    
    // Save
    XLSX.writeFile(workbook, `Jazaa_Sales_Report_${bookerId}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStats = (bId) => {
    const list = (orders || []).filter(o => o.bookerId === bId);
    const confirmed = list.filter(o => o.status === 'confirmed');
    const cancelled = list.filter(o => o.status === 'cancelled');
    
    const valueConf = confirmed.reduce((acc, sum) => acc + (sum.totalValue || 0), 0);
    
    return {
       totalCount: list.length,
       confCount: confirmed.length,
       cancCount: cancelled.length,
       valueConf
    };
  };

  // Cancellation Reason Breakdown
  const cancellationBreakdown = (orders || [])
    .filter(o => o.status === 'cancelled' && o.cancel_reason)
    .reduce((acc, o) => {
      const reason = o.cancel_reason.trim();
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  return (
    <div className="card mt-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3>📈 OrderBooker Reports</h3>
        <button className="btn btn-secondary" onClick={() => handleExport('ALL')}>
          Export ALL Orders to Excel
        </button>
      </div>
      
      {/* Cancellation Analysis Section */}
      <div className="card mb-4" style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
        <h4 style={{ color: '#991b1b', marginBottom: '1rem' }}>⚠️ Cancellation Analysis</h4>
        {Object.keys(cancellationBreakdown).length > 0 ? (
          <div className="grid grid-cols-1 md-grid-cols-2 gap-4">
            <div className="table-responsive">
              <table style={{ background: 'transparent' }}>
                <thead>
                  <tr>
                    <th style={{ color: '#991b1b', borderBottomColor: '#fecaca' }}>Reason for Cancellation</th>
                    <th style={{ color: '#991b1b', borderBottomColor: '#fecaca' }}>Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cancellationBreakdown).map(([reason, count]) => (
                    <tr key={reason}>
                      <td style={{ borderBottomColor: '#fecaca' }}>{reason}</td>
                      <td style={{ borderBottomColor: '#fecaca', fontWeight: 'bold' }}>{count} orders</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
               <p style={{ fontSize: '0.9rem', color: '#7f1d1d' }}>
                  <strong>Insight:</strong> The most common reason is 
                  <span className="font-bold"> "{Object.entries(cancellationBreakdown).sort((a,b) => b[1]-a[1])[0][0]}"</span>.
               </p>
               <p style={{ fontSize: '0.8rem', color: '#7f1d1d', opacity: 0.8 }}>
                  Frequent cancellations may indicate issues with pricing, stock availability, or shopkeeper reliability.
               </p>
            </div>
          </div>
        ) : (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>No cancellation data available yet.</p>
        )}
      </div>

      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        View performance metrics and export detailed billing records for each orderbooker.
      </p>

      <div className="grid grid-cols-1 md-grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {users.map(u => {
          const stats = getStats(u.id);
          return (
            <div key={u.id} className="card" style={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <div className="flex justify-between items-start mb-2">
                 <h4 className="font-bold">{u.name} <span style={{ fontSize: '0.8rem', fontWeight: 500, background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{u.id}</span></h4>
                 <span style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: u.is_active ? 'var(--secondary)' : 'var(--danger)'
                  }}></span>
              </div>
              
              <div className="flex justify-between mb-4">
                 <div>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>Confirmed</p>
                    <p className="font-bold">{stats.confCount}</p>
                 </div>
                 <div>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>Cancelled</p>
                    <p className="font-bold" style={{ color: 'var(--danger)' }}>{stats.cancCount}</p>
                 </div>
                 <div>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>Sales (Confirmed)</p>
                    <p className="font-bold text-green-600">Rs. {stats.valueConf.toFixed(2)}</p>
                 </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem' }} onClick={() => handleExport(u.id)}>
                Export "{u.name}" Excel Report
              </button>
            </div>
          )
        })}

        {users.length === 0 && (
          <p className="text-muted">No orderbookers exist in the system yet.</p>
        )}
      </div>
    </div>
  );
}
