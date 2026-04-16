import React, { useState, useEffect } from 'react';
import { calculateTaxesAndTotals } from '../taxEngine';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceGenerator({ customer, inventory, settingsObj, onSend, onCancel, initialCart = [] }) {
  const [format, setFormat] = useState('TP'); // 'TP', 'RP'
  const [items, setItems] = useState([]);

  // Initialize with initialCart or one empty row
  useEffect(() => {
    if (initialCart.length > 0) {
      setItems(initialCart.map(c => ({
        productId: String(c.id),
        qty: c.qty,
        discount: c.discount || 0
      })));
    } else {
      setItems([{ productId: '', qty: 1, discount: 0 }]);
    }
  }, [initialCart]);

  if (!customer) {
    return <div className="p-4 text-center text-muted">Please select a customer first.</div>;
  }

  const addRow = () => {
    setItems([...items, { productId: '', qty: 1, discount: 0 }]);
  };

  const removeRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // Calculate row data
  const invoiceData = items.map(item => {
    const product = inventory.find(p => String(p.id) === String(item.productId));
    if (!product) return null;
    
    // Inject discount into calculation
    // Note: taxEngine might need a small adjustment to accept manual discount pct
    // For now, we manually handle discount override if needed, or pass it in
    return calculateTaxesAndTotals(customer.type, product, parseInt(item.qty || 0), settingsObj, item.discount / 100);
  }).filter(Boolean);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const enforceFloor = currentUser.floor_check_enabled !== false;
  const enforceStock = currentUser.stock_check_enabled !== false;

  const anyBelowFloor = invoiceData.some(row => row.isBelowFloor);
  const blockedByFloor = enforceFloor && anyBelowFloor;

  const anyOutOfStock = invoiceData.some(row => {
    const product = inventory.find(p => p.name === row.productName);
    return product && parseInt(row.qty) > (product.stock || 0);
  });
  const blockedByStock = enforceStock && anyOutOfStock;

  const grandTotal = invoiceData.reduce((sum, row) => sum + row.total, 0);

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const date = new Date();
    
    const dateFormatted = date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).replace(/ /g, '-');
    
    const fileNameDate = dateFormatted.replace(/-/g, '').toLowerCase();
    const fileName = `${fileNameDate}_${customer.name.replace(/\s+/g, '')}_${Math.round(grandTotal)}.pdf`;

    // Header Branding
    doc.setTextColor(29, 78, 216); // Blue
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text("3U Enterprises", 15, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    // Using address from Image 1
    doc.text("Pakistan Central Ideal, Ashiana Quaid road, Ferozpur road, Lahore", 15, 26);
    doc.text("Phone: +92 307 5636773 | NTN # 4545123-2", 15, 30);

    doc.setFontSize(24);
    doc.setTextColor(203, 213, 225);
    doc.text("INVOICE", 195, 24, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.line(15, 35, 195, 35);

    // Customer Detail Header
    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Bill To", 15, 43);
    
    doc.setFontSize(12);
    doc.text(customer.name || 'N/A', 15, 49);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    doc.text(`Booker: ${user.name || 'Unknown'}`, 15, 55);
    doc.text(`${customer.location || customer.address || 'N/A'}`, 15, 60);
    doc.text(`NTN: ${customer.ntn || 'None'}`, 15, 65);
    
    doc.text(`Date: ${dateFormatted}`, 195, 43, { align: 'right' });
    doc.text(`Invoice #: ${Math.floor(1000 + Math.random() * 9000)}`, 195, 49, { align: 'right' });
    doc.text(`Distributor: 3U Enterprises`, 195, 55, { align: 'right' });
    doc.setTextColor(234, 179, 8); // Yellow for Brand
    doc.text(`Brand: Jazaa`, 195, 61, { align: 'right' });

    let headers, tableData, columnStyles;
    if (format === 'TP') {
      // 11 Columns: Product, Type, Qty, Rate, Disc %, After Disc, GST Amt, Amt after GST, Adv %, Adv Amt, Total
      headers = [["Product", "Prod type", "Qty", "Rate", "Discount %", "After Disc rate", "GST Amt", "Amt after GST", "Adv tax %", "Adv tax Amt", "Total"]];
      tableData = invoiceData.map((row) => [
        row.productName,
        row.productType || 'N',
        row.qty,
        row.rate.toFixed(2),
        (row.discPctTP * 100).toFixed(2) + "%",
        row.afterDiscRate.toFixed(2),
        row.gstAmt.toFixed(2),
        (row.afterDiscRate + row.gstAmt).toFixed(2),
        (row.advPct * 100).toFixed(2) + "%",
        row.advTaxAmt.toFixed(2),
        row.total.toFixed(2)
      ]);
      columnStyles = {
        0: { cellWidth: 35, halign: 'left' },
        1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 15, halign: 'center' },
        7: { cellWidth: 15, halign: 'center' },
        8: { cellWidth: 15, halign: 'center' },
        9: { cellWidth: 15, halign: 'center' },
        10: { cellWidth: 15, halign: 'center' }
      };
    } else {
      // 6 Columns: Product, Qty, RP, Disc % on RP, Rate After Disc, Total
      headers = [["Product", "Qty", "RP", "Disc % on RP", "Rate After Disc", "Total"]];
      tableData = invoiceData.map((row) => [
        row.productName,
        row.qty,
        row.rp.toFixed(2),
        (row.discPctRP * 100).toFixed(2) + "%",
        (row.total / row.qty).toFixed(2),
        row.total.toFixed(2)
      ]);
      columnStyles = {
         0: { halign: 'left' }
      };
    }

    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 75,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [255, 255, 255], textColor: [71, 85, 105], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [226, 232, 240] },
      bodyStyles: { textColor: [30, 41, 59], halign: 'center', lineWidth: 0.1, lineColor: [226, 232, 240] },
      columnStyles: columnStyles
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Total Banner
    doc.setFillColor(37, 99, 235); // Blue banner
    doc.rect(140, finalY, 55, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("TOTAL PKR", 138, finalY + 6.5, { align: 'right' });
    doc.text(`Rs. ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 167.5, finalY + 6.5, { align: 'center' });

    // Footer lines
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text("Received By:", 15, finalY + 25);
    doc.line(60, finalY + 25, 110, finalY + 25);
    doc.text("Sign / Stamp:", 15, finalY + 40);
    doc.line(60, finalY + 40, 110, finalY + 40);
    
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text("Thank you for your business.", 15, finalY + 5);

    doc.save(fileName);
    onSend('pdf', `Exported ${format}`, Math.round(grandTotal), format);
  };

  return (
    <div className="card animate-in premium-card">
      {/* PROFESSIONAL CUSTOMER HEADER */}
      <div className="customer-header-card mb-6 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
             <p className="sales-label">Customer / Shop</p>
             <h3 className="portal-title" style={{ fontSize: '1.4rem' }}>{customer.name}</h3>
             <p className="portal-subtitle">📍 {customer.address || 'Address not added'}</p>
          </div>
          <div className="sales-pill">
             <div className="flex flex-col gap-1">
                <p className="text-xs"><strong>📞</strong> {customer.phone || 'N/A'}</p>
                <p className="text-xs"><strong>🏪</strong> {customer.shop_type || customer.type}</p>
             </div>
          </div>
        </div>
        <button onClick={onCancel} className="absolute top-2 right-4 text-slate-300 hover:text-red-500 transition-colors text-xl">✕</button>
      </div>

      {/* LINE-BY-LINE ENTRY TABLE */}
      <div className="flex justify-between items-end mb-3">
        <h3 className="text-sm font-bold uppercase text-slate-500 tracking-tight">Invoice Details</h3>
        {format === 'TP' && (
          <div className="flex items-center gap-1.5 text-primary text-[0.65rem] font-bold animate-swipe">
            <span>⬅️ SWIPE FOR TAXES</span>
            <div className="w-4 h-0.5 bg-primary/30 rounded-full"></div>
          </div>
        )}
      </div>
      <div className="table-responsive">
        <table className="w-full text-nowrap">
          <thead>
            <tr className="bg-slate-100 text-[0.65rem] font-bold uppercase text-slate-600">
              <th className="p-2 text-left sticky-column" style={{ minWidth: '180px' }}>Product</th>
              {format === 'TP' && <th className="p-2 text-center">Type</th>}
              <th className="p-2 text-center" style={{ width: '100px' }}>Qty</th>
              <th className="p-2 text-center">{format === 'TP' ? 'Rate' : 'RP'}</th>
              <th className="p-2 text-center" style={{ width: '100px' }}>Disc %</th>
              {format === 'TP' && (
                <>
                  <th className="p-2 text-center">After Disc</th>
                  <th className="p-2 text-center">GST Amt</th>
                  <th className="p-2 text-center">After GST</th>
                  <th className="p-2 text-center">Adv %</th>
                  <th className="p-2 text-center">Adv Amt</th>
                </>
              )}
              {format === 'RP' && <th className="p-2 text-center">Net Rate</th>}
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-center" style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const product = inventory.find(p => String(p.id) === String(item.productId));
              const rowData = product ? calculateTaxesAndTotals(customer.type, product, parseInt(item.qty || 0), settingsObj, (item.discount || 0) / 100) : null;
              
              return (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-1 sticky-column">
                    <div className="relative group">
                      <input 
                        type="text"
                        placeholder="Search Product..."
                        className="form-input text-xs h-9 min-h-0 bg-white"
                        style={{ padding: '0 0.5rem', width: '100%' }}
                        value={item.searchTerm || (product?.name ? `${product.name} (${product.brand})` : '')}
                        onChange={(e) => updateItem(index, 'searchTerm', e.target.value)}
                        onFocus={() => updateItem(index, 'isSearching', true)}
                      />
                      
                      {item.isSearching && (
                        <div className="absolute top-full left-0 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl z-50 rounded-lg">
                          {inventory
                            .filter(p => !item.searchTerm || p.name.toLowerCase().includes(item.searchTerm.toLowerCase()) || p.brand?.toLowerCase().includes(item.searchTerm.toLowerCase()))
                            .map(p => (
                              <div 
                                key={p.id} 
                                className="p-2 text-xs hover:bg-slate-100 cursor-pointer border-b border-slate-50 flex justify-between gap-2"
                                onClick={() => {
                                  updateItem(index, 'productId', p.id);
                                  updateItem(index, 'searchTerm', '');
                                  updateItem(index, 'isSearching', false);
                                }}
                              >
                                <div className="font-bold">{p.name} <span className="text-[10px] text-muted font-normal">({p.brand})</span></div>
                                <div className={`font-bold ${p.stock <= 5 ? 'text-red-600' : 'text-slate-400'}`}>Avl: {p.stock}</div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-1 px-1">
                       {product && <span className={`text-[10px] font-bold ${product.stock <= 0 ? 'text-red-600' : 'text-slate-400'}`}>Stock: {product.stock}</span>}
                       {rowData?.isBelowFloor && (
                        <div className="text-[0.55rem] text-red-600 font-bold uppercase">
                          ⚠️ Below Min (Rs. {rowData.floorPrice})
                        </div>
                       )}
                       {product && enforceStock && parseInt(item.qty) > product.stock && (
                         <div className="text-[0.55rem] text-red-600 font-bold uppercase">
                          🚫 Out of Stock
                         </div>
                       )}
                    </div>
                  </td>
                  {format === 'TP' && <td className="p-1 text-center text-xs opacity-60">{rowData?.productType || '-'}</td>}
                  <td className="p-1 text-center">
                    <input 
                      type="number" 
                      className="form-input text-base text-center h-12 min-h-0 p-2 font-bold" 
                      style={{ width: '100px' }}
                      value={item.qty} 
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                    />
                  </td>
                  <td className="p-1 text-center text-xs">
                    {product ? (format === 'TP' ? Number(product.rate || 0).toFixed(2) : Number(product.rp || 0).toFixed(2)) : '-'}
                  </td>
                  <td className="p-1 text-center">
                    <input 
                      type="number" 
                      className="form-input text-base text-center h-12 min-h-0 p-2 font-bold" 
                      style={{ width: '100px' }}
                      value={item.discount} 
                      onChange={(e) => updateItem(index, 'discount', e.target.value)}
                    />
                  </td>
                  {format === 'TP' && (
                    <>
                      <td className="p-1 text-center text-xs">{rowData?.afterDiscRate.toFixed(2) || '-'}</td>
                      <td className="p-1 text-center text-xs">{rowData?.gstAmt.toFixed(2) || '-'}</td>
                      <td className="p-1 text-center text-xs">{rowData?.amtAfterGst.toFixed(2) || '-'}</td>
                      <td className="p-1 text-center text-xs">{(rowData?.advPct * 100).toFixed(1)}%</td>
                      <td className="p-1 text-center text-xs">{rowData?.advTaxAmt.toFixed(2) || '-'}</td>
                    </>
                  )}
                  {format === 'RP' && <td className="p-1 text-center text-xs">{rowData ? (rowData.total / rowData.qty).toFixed(2) : '-'}</td>}
                  <td className="p-1 text-right font-bold text-xs text-primary">
                    {rowData ? rowData.total.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td className="p-1 text-center">
                    <button onClick={() => removeRow(index)} className="text-slate-300 hover:text-red-500 transition-colors">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="btn btn-outline w-full mt-4 border-dashed border-2 hover:border-primary hover:text-primary py-2 text-sm font-bold">
        + Add New Line
      </button>

      {/* FOOTER & EXPORT */}
      <div className="mt-8 pt-6 border-t border-slate-200">
         <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="flex gap-2">
               {['TP', 'RP'].map(f => (
                 <button 
                  key={f} 
                  onClick={() => setFormat(f)}
                  className={`btn ${format === f ? 'btn-primary' : 'btn-outline'}`}
                  style={{ minHeight: '40px', padding: '0 1rem', fontSize: '0.8rem' }}
                 >
                   {f} Format
                 </button>
               ))}
            </div>
            
            <div className="text-right">
               <p className="text-xs text-muted uppercase font-bold mb-1 tracking-widest">Grand Total</p>
               <h2 className="text-3xl font-bold text-primary">Rs. {Math.round(grandTotal).toLocaleString()}</h2>
               <p className="text-[0.65rem] text-muted italic mt-1">Inclusive of all taxes & discounts</p>
            </div>
         </div>

          <div className="mt-8">
            <button 
              className="btn btn-primary w-full py-4 text-lg font-bold shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              disabled={blockedByFloor || blockedByStock || items.length === 0 || !items.some(i => i.productId)}
              onClick={generatePDF}
              style={{
                opacity: (blockedByFloor || blockedByStock || items.length === 0 || !items.some(i => i.productId)) ? 0.6 : 1,
                background: (blockedByFloor || blockedByStock) ? '#94a3b8' : 'var(--primary)',
                cursor: (blockedByFloor || blockedByStock) ? 'not-allowed' : 'pointer'
              }}
            >
               {blockedByFloor ? '🚫 Below Floor - Adjust Prices' : 
                blockedByStock ? '🚫 Check Stock - Adjust Quantities' : 
                '✅ Confirm & Finish Booking'}
            </button>
          </div>
      </div>
    </div>
  );
}
