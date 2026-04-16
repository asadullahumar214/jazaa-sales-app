import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getOrders, getUsers, getTaxSettings, getInventory } from '../store';

export default function ReportsManager() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [users, setLocalUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetch = async () => {
    const [ords, usrs, stgs, inv] = await Promise.all([
      getOrders(), 
      getUsers(), 
      getTaxSettings(),
      getInventory()
    ]);
    setOrders(ords);
    setLocalUsers(usrs.filter(u => u.role !== 'admin'));
    setSettings(stgs);
    setInventory(inv);
  };

  useEffect(() => {
    fetch();
  }, []);

  const eodStats = useMemo(() => {
    const today = new Date().toLocaleDateString();
    const todayOrders = orders.filter(o => new Date(o.date).toLocaleDateString() === today && o.status === 'confirmed');
    
    const revenue = todayOrders.reduce((s,o) => s + (o.totalValue || 0), 0);
    const orderCount = todayOrders.length;
    
    const bookerStats = {};
    todayOrders.forEach(o => {
      bookerStats[o.bookerId] = (bookerStats[o.bookerId] || 0) + (o.totalValue || 0);
    });
    const topBookerId = Object.entries(bookerStats).sort((a,b) => b[1] - a[1])[0]?.[0];
    const topBooker = users.find(u => u.id === topBookerId)?.name || 'N/A';

    const customerStats = {};
    todayOrders.forEach(o => {
      customerStats[o.customerName] = (customerStats[o.customerName] || 0) + (o.totalValue || 0);
    });
    const topCustomer = Object.entries(customerStats).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return { revenue, orderCount, topBooker, topCustomer };
  }, [orders, users]);

  const slowMovingItems = useMemo(() => {
    if (!settings || !inventory.length) return [];
    const thresholdDays = settings.aging_threshold || 10;
    const cutoff = new Date(Date.now() - thresholdDays * 86400000);
    
    // Items sold in the last X days
    const recentSoldIds = new Set();
    orders.forEach(o => {
      if (o.status === 'confirmed' && new Date(o.date) > cutoff) {
        o.items.forEach(i => recentSoldIds.add(String(i.id)));
      }
    });

    return inventory.filter(inv => !recentSoldIds.has(String(inv.id)))
      .sort((a,b) => b.stock - a.stock);
  }, [inventory, orders, settings]);

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
      <div className="mb-8">
        <h3 className="text-xl font-bold">Business Intelligence</h3>
        <p className="text-sm text-muted">Field analytics and inventory aging insights.</p>
      </div>

      {/* NEW: Automated EOD Dashboard */}
      <div className="mb-8 card !bg-emerald-50 !border-emerald-100">
         <h4 className="text-[10px] uppercase font-bold text-emerald-600 mb-4 tracking-[0.2em]">Automated EOD Summary (Today)</h4>
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
               <p className="text-[10px] text-muted uppercase font-bold mb-1">Total Sales</p>
               <p className="text-xl font-black text-emerald-900">Rs. {eodStats.revenue.toLocaleString()}</p>
            </div>
            <div>
               <p className="text-[10px] text-muted uppercase font-bold mb-1">Confirmed Orders</p>
               <p className="text-xl font-black text-emerald-900">{eodStats.orderCount}</p>
            </div>
            <div>
               <p className="text-[10px] text-muted uppercase font-bold mb-1">Top Booker</p>
               <p className="text-xl font-black text-emerald-900 truncate">{eodStats.topBooker}</p>
            </div>
            <div>
               <p className="text-[10px] text-muted uppercase font-bold mb-1">Top Customer</p>
               <p className="text-xl font-black text-emerald-900 truncate">{eodStats.topCustomer}</p>
            </div>
         </div>
      </div>

      {/* NEW: Inventory Aging Report */}
      <div className="mb-8 card !bg-amber-50 !border-amber-100">
         <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-[10px] uppercase font-bold text-amber-600 tracking-[0.2em]">Slow Moving Stock</h4>
            <p className="text-[10px] text-amber-700 font-medium">No sales in last {settings?.aging_threshold || 10} days</p>
          </div>
          <span className="bg-amber-200 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded-full">{slowMovingItems.length} SKUs</span>
         </div>
         
         <div className="max-h-48 overflow-y-auto pr-2 no-scrollbar">
            <div className="grid grid-cols-1 gap-2">
               {slowMovingItems.map(item => (
                 <div key={item.id} className="flex justify-between items-center bg-white/50 p-2 rounded-lg border border-amber-200/50">
                    <div>
                       <p className="text-[11px] font-bold text-amber-900">{item.name}</p>
                       <p className="text-[9px] text-amber-700">{item.brand || 'General'}</p>
                    </div>
                    <p className="text-[11px] font-black text-amber-900">{item.stock} <span className="text-[9px] font-normal">in stock</span></p>
                 </div>
               ))}
               {slowMovingItems.length === 0 && <p className="text-center py-4 text-[11px] text-amber-700 italic">All products are moving within threshold!</p>}
            </div>
         </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
        <label className="text-xs font-bold text-muted uppercase mb-2 block tracking-widest">Historical Filter</label>
        <div className="flex flex-col gap-2">
           <div className="flex gap-2">
              <input type="date" className="form-input flex-1" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
              <input type="date" className="form-input flex-1" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
           </div>
           <button className="btn btn-primary w-full py-3 shadow-lg shadow-primary/20" onClick={fetch}>Update Reports</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
         <div className="card text-center" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <p className="text-[10px] text-slate-500 uppercase font-black">Period Sales</p>
            <p className="text-xl font-black text-slate-900">Rs. {totalSales.toLocaleString()}</p>
         </div>
         <div className="card text-center" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <p className="text-[10px] text-slate-500 uppercase font-black">Confirmed</p>
            <p className="text-xl font-black text-slate-900">{totalConfirmed}</p>
         </div>
         <div className="card text-center" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <p className="text-[10px] text-slate-500 uppercase font-black">Cancelled</p>
            <p className="text-xl font-black text-slate-900">{totalCancelled}</p>
         </div>
      </div>
      
      {Object.keys(cancellationBreakdown).length > 0 && (
        <div className="card mb-8 !bg-red-50 !border-red-100">
          <h4 className="text-[10px] text-red-800 mb-3 font-bold uppercase tracking-widest">Cancellation Reasons Analysis</h4>
          <div className="flex flex-wrap gap-2">
             {Object.entries(cancellationBreakdown).map(([reason, count]) => (
               <div key={reason} className="bg-white px-3 py-1.5 rounded-xl border border-red-100 flex gap-3 items-center shadow-sm">
                 <span className="text-[11px] font-bold text-red-900">{reason}</span>
                 <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">{count}</span>
               </div>
             ))}
          </div>
        </div>
      )}

      <h4 className="text-[10px] font-bold text-muted uppercase mb-4 tracking-[0.2em]">Field Team Performance</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => {
          const stats = getStats(u.id);
          return (
            <div key={u.id} className="card-item border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <h5 className="font-bold text-sm text-slate-800" style={{ margin: 0 }}>{u.name}</h5>
                 </div>
                 <button className="text-[10px] font-bold text-primary tracking-widest hover:underline" onClick={() => handleExport(u.id)}>
                    EXPORT LOG
                 </button>
              </div>
              
              <div className="flex justify-between items-end border-t border-slate-50 pt-3">
                 <div>
                    <p className="text-[10px] text-muted uppercase font-bold">Conf / Cancel</p>
                    <p className="font-black text-sm text-slate-700">{stats.confCount} <span className="text-red-500 font-normal">(-{stats.cancCount})</span></p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] text-muted uppercase font-bold">Sales Value</p>
                    <p className="font-black text-primary">Rs. {stats.valueConf.toLocaleString()}</p>
                 </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <button className="btn btn-secondary w-full py-4 font-black tracking-[0.3em] overflow-hidden relative group" onClick={() => handleExport('ALL')}>
          <span className="relative z-10 text-xs">DOWNLOAD MASTER EXCEL REPORT</span>
          <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform"></div>
        </button>
      </div>
    </div>
  );
}
