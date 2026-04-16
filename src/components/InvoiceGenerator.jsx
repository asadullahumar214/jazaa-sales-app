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

  const anyBelowFloor = invoiceData.some(row => row.isBelowFloor);
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
    doc.setTextColor(29, 78, 216); // var(--primary)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text("3U Enterprises", 15, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.text("Kamaha road New Defence Garden Scheme Lhr", 15, 26);
    doc.text("Phone: +92 307 5636773 | NTN # 4545123-2", 15, 30);

    doc.setFontSize(24);
    doc.setTextColor(203, 213, 225);
    doc.text(format === 'TP' ? 'SALES INVOICE (TP)' : 'RETAIL INVOICE (RP)', 195, 24, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.line(15, 35, 195, 35);

    // Customer Detail Header
    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("BILL TO:", 15, 43);
    
    doc.setFontSize(12);
    doc.text(customer.name, 15, 49);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact: ${customer.phone || 'N/A'}`, 15, 55);
    doc.text(`Address: ${customer.address || 'N/A'}`, 15, 60);
    if (customer.ntn || customer.strn) {
      doc.text(`${customer.strn ? 'STRN' : 'NTN'}: ${customer.strn || customer.ntn}`, 15, 65);
    }
    
    doc.text(`Date: ${dateFormatted}`, 195, 43, { align: 'right' });
    doc.text(`Invoice #: JZ-${Date.now().toString().slice(-6)}`, 195, 49, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Distributor: 3U Enterprises`, 195, 55, { align: 'right' });

    let headers, tableData;
    if (format === 'TP') {
      headers = [["#", "Product", "Qty", "Rate", "Disc %", "GST Amt", "Adv Tax", "Total"]];
      tableData = invoiceData.map((row, i) => [
        i + 1, row.productName, row.qty, row.rate.toLocaleString(),
        (row.discPctTP * 100).toFixed(1) + "%", row.gstAmt.toFixed(2),
        row.advTaxAmt.toFixed(1), row.total.toLocaleString(undefined, {minimumFractionDigits: 1})
      ]);
    } else {
      headers = [["#", "Product", "Qty", "Retail Price", "Trade Disc", "Net Rate", "Total"]];
      tableData = invoiceData.map((row, i) => [
        i + 1, row.productName, row.qty, row.rp.toLocaleString(),
        (row.discPctRP * 100).toFixed(1) + "%", row.rateAfterDiscRP.toFixed(2),
        row.total.toLocaleString(undefined, {minimumFractionDigits: 1})
      ]);
    }

    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 75,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, halign: 'center' },
      columnStyles: { 1: { halign: 'left' } }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 78, 216);
    doc.text(`GRAND TOTAL: Rs. ${Math.round(grandTotal).toLocaleString()}`, 195, finalY + 10, { align: 'right' });

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
      <h3 className="text-sm font-bold mb-3 uppercase text-slate-500 tracking-tight">Invoice Details</h3>
      <div className="table-responsive" style={{ border: 'none' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 text-xs font-bold uppercase text-slate-600">
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-center" style={{ width: '80px' }}>Qty</th>
              <th className="p-3 text-center" style={{ width: format === 'TP' ? '100px' : '120px' }}>{format === 'TP' ? 'TP Rate' : 'Retail Price'}</th>
              <th className="p-3 text-center" style={{ width: '90px' }}>Disc %</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center" style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const product = inventory.find(p => String(p.id) === String(item.productId));
              const rowData = product ? calculateTaxesAndTotals(customer.type, product, parseInt(item.qty || 0), settingsObj, (item.discount || 0) / 100) : null;
              
              return (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-2">
                    <select 
                      className="form-select text-sm h-10 min-h-0" 
                      value={item.productId} 
                      onChange={(e) => updateItem(index, 'productId', e.target.value)}
                    >
                      <option value="">-- Select Product --</option>
                      {inventory.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.brand}) [Stock: {p.stock}]</option>
                      ))}
                    </select>
                    {rowData?.isBelowFloor && (
                      <div className="text-[0.6rem] text-red-600 font-bold mt-1 uppercase animate-pulse">
                        ⚠️ Below Min Price (Rs. {rowData.floorPrice})
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <input 
                      type="number" 
                      className="form-input text-sm text-center h-10 min-h-0 p-1" 
                      value={item.qty} 
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-center text-sm font-medium">
                    {product ? (format === 'TP' ? Number(product.rate || 0).toLocaleString() : Number(product.rp || 0).toLocaleString()) : '-'}
                  </td>
                  <td className="p-2 text-center">
                    <input 
                      type="number" 
                      className="form-input text-sm text-center h-10 min-h-0 p-1" 
                      value={item.discount} 
                      onChange={(e) => updateItem(index, 'discount', e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-right font-bold text-sm">
                    {rowData ? `Rs. ${rowData.total.toLocaleString()}` : '0.00'}
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => removeRow(index)} className="text-red-300 hover:text-red-500 text-lg">🗑️</button>
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
              disabled={anyBelowFloor || items.length === 0 || !items.some(i => i.productId)}
              onClick={generatePDF}
              style={{
                opacity: (anyBelowFloor || items.length === 0 || !items.some(i => i.productId)) ? 0.6 : 1,
                background: anyBelowFloor ? '#94a3b8' : 'var(--primary)',
                cursor: anyBelowFloor ? 'not-allowed' : 'pointer'
              }}
            >
              {anyBelowFloor ? '🚫 Below Floor - Adjust Prices' : '✅ Confirm & Finish Booking'}
            </button>
         </div>
      </div>
    </div>
  );
}
