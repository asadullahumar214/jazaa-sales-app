import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getOrders, getUsers } from '../store';

export default function ReportsManager() {
  const [orders, setOrders] = useState([]);
  const [users, setLocalUsers] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetch = async () => {
    const ords = await getOrders();
    const usrs = await getUsers();
    setOrders(ords);
    setLocalUsers(usrs.filter(u => u.role !== 'admin'));
  };

  useEffect(() => {
    fetch();
  }, []);

  const filteredOrdersByDate = (orders || []).filter(o => {
    const orderDate = new Date(o.date).toISOString().split('T')[0];
    return orderDate >= dateRange.start && orderDate <= dateRange.end;
  });

  const handleExport = (bookerId = 'ALL') => {
    let targetOrders = filteredOrdersByDate;
    if (bookerId !== 'ALL') targetOrders = targetOrders.filter(o => o.bookerId === bookerId);
    if (targetOrders.length === 0) return alert("No data for selection.");

    const rows = [];
    targetOrders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          rows.push({
            'Date': new Date(o.date).toLocaleDateString(),
            'Order ID': o.id,
            'Status': (o.status || '').toUpperCase(),
            'Booker': users.find(u => u.id === o.bookerId)?.name || o.bookerId,
            'Customer': o.customerName,
            'Format': o.invoiceFormat || 'TP',
            'SKU': item.id,
            'Qty': item.qty,
            'Total Val (PKR)': o.totalValue,
            'Cancel Reason': o.cancel_reason || ''
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jazaa Sales");
    XLSX.writeFile(wb, `Jazaa_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);
  };

  const getStats = (bId) => {
    const list = filteredOrdersByDate.filter(o => o.bookerId === bId);
    const confirmed = list.filter(o => o.status === 'confirmed');
    const valueConf = confirmed.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    return {
       totalCount: list.length,
       confCount: confirmed.length,
       cancCount: list.filter(o => o.status === 'cancelled').length,
       valueConf
    };
  };

  const cancellationBreakdown = filteredOrdersByDate
    .filter(o => o.status === 'cancelled' && o.cancel_reason)
    .reduce((acc, o) => {
      const reason = o.cancel_reason.trim();
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  const totalSales = filteredOrdersByDate.filter(o => o.status === 'confirmed').reduce((sum, o) => sum + (o.totalValue || 0), 0);
  const totalConfirmed = filteredOrdersByDate.filter(o => o.status === 'confirmed').length;
  const totalCancelled = filteredOrdersByDate.filter(o => o.status === 'cancelled').length;

  return (
    <div className="card mt-4 mb-4">
      <div className="mb-6">
        <h3 className="text-xl font-bold">Sales Intelligence</h3>
        <p className="text-sm text-muted">Performance tracking and data exports.</p>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
        <label className="text-xs font-bold text-muted uppercase mb-2 block">Date Filter</label>
        <div className="flex flex-col gap-2">
           <div className="flex gap-2">
              <input type="date" className="form-input flex-1" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
              <input type="date" className="form-input flex-1" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
           </div>
           <button className="btn btn-primary w-full py-3" onClick={fetch}>Update Report Results</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
         <div className="card text-center" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
            <p className="text-[10px] text-blue-600 uppercase font-black">Period Sales</p>
            <p className="text-xl font-black text-blue-900">Rs. {totalSales.toLocaleString()}</p>
         </div>
         <div className="card text-center" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <p className="text-[10px] text-green-600 uppercase font-black">Confirmed</p>
            <p className="text-xl font-black text-green-900">{totalConfirmed}</p>
         </div>
         <div className="card text-center" style={{ background: '#fef2f2', borderColor: '#fee2e2' }}>
            <p className="text-[10px] text-red-600 uppercase font-black">Cancelled</p>
            <p className="text-xl font-black text-red-900">{totalCancelled}</p>
         </div>
      </div>
      
      {Object.keys(cancellationBreakdown).length > 0 && (
        <div className="card mb-8" style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
          <h4 className="text-sm text-red-800 mb-3 font-bold uppercase" style={{ fontSize: '0.7rem' }}>Cancellation Insights</h4>
          <div className="flex flex-wrap gap-2">
             {Object.entries(cancellationBreakdown).map(([reason, count]) => (
               <div key={reason} className="bg-white px-3 py-1 rounded-full border border-red-100 flex gap-3 items-center">
                 <span className="text-xs font-medium">{reason}</span>
                 <span className="bg-red-600 text-white px-1.5 py-0.2 rounded-full text-[10px]">{count}</span>
               </div>
             ))}
          </div>
        </div>
      )}

      <h4 className="text-sm font-bold text-muted uppercase mb-4" style={{ fontSize: '0.7rem' }}>Booker Performance</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => {
          const stats = getStats(u.id);
          return (
            <div key={u.id} className="card-item border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-2">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active ? '#22c55e' : '#ef4444' }}></div>
                    <h5 className="font-bold text-sm" style={{ margin: 0 }}>{u.name}</h5>
                 </div>
                 <button className="text-[10px] font-bold text-primary underline" onClick={() => handleExport(u.id)}>
                    EXPORT
                 </button>
              </div>
              
              <div className="flex justify-between items-end border-t border-slate-50 pt-3">
                 <div>
                    <p className="text-[10px] text-muted uppercase">Confirmed / Cancel</p>
                    <p className="font-bold text-sm">{stats.confCount} <span className="text-red-500 font-normal">(-{stats.cancCount})</span></p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] text-muted uppercase">Sales Value</p>
                    <p className="font-bold text-primary">Rs. {stats.valueConf.toLocaleString()}</p>
                 </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <button className="btn btn-secondary w-full py-4 font-bold" onClick={() => handleExport('ALL')}>
          📥 MASTER EXCEL REPORT
        </button>
      </div>
    </div>
  );
}
