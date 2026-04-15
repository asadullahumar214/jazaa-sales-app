import React, { useState } from 'react';
import { calculateTaxesAndTotals } from '../taxEngine';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceGenerator({ cart, customer, settingsObj, onSend, onCancel }) {
  const [format, setFormat] = useState('TP'); // 'TP', 'RP', 'ECOMM', 'GRN'

  if (!customer) {
    return <div className="p-4 text-center">Please select a customer to generate invoice.</div>;
  }

  const invoiceData = cart.map(item => {
    return calculateTaxesAndTotals(customer.type, item.product, item.qty, settingsObj);
  });

  const anyBelowFloor = invoiceData.some(row => row.isBelowFloor);

  const grandTotal = invoiceData.reduce((sum, row) => sum + row.total, 0);
  const ecommCommission = grandTotal * 0.05;
  const ecommFinal = grandTotal + ecommCommission;

    const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const date = new Date();
    
    // Standard Date Format: 15-Apr-2024
    const dateFormatted = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/ /g, '-');
    
    // File Name format: 15-Apr-24_CustomerName_1234.pdf
    const fileNameDate = dateFormatted.replace(/-/g, '').toLowerCase();
    const displayTotal = format === 'ECOMM' ? ecommFinal : grandTotal;
    const fileName = `${fileNameDate}_${customer.name.replace(/\s+/g, '')}_${Math.round(displayTotal)}.pdf`;

    // Branding Header
    doc.setTextColor(37, 99, 235); // Primary Blue
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text("3U Enterprises", 15, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // Text Slate 600
    doc.setFont('helvetica', 'normal');
    doc.text("Kamaha road New Defence Garden Scheme Lhr", 15, 26);
    doc.text("Phone: +92 307 5636773", 15, 30);
    
    // Display NTN/STRN if available
    doc.text(`NTN # 4545123-2`, 15, 34);

    // Document Title
    doc.setFontSize(28);
    doc.setTextColor(203, 213, 225); // Slate 300
    const docTitle = format === 'GRN' ? 'GRN / DC' : format === 'ECOMM' ? 'ECOMMERCE INVOICE' : 'SALES INVOICE';
    doc.text(docTitle, 195, 24, { align: 'right' });

    // Customer & Metadata Section
    doc.setDrawColor(241, 245, 249);
    doc.line(15, 40, 195, 40);

    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("BILL TO:", 15, 48);
    
    doc.setFontSize(12);
    doc.text(customer.name, 15, 54);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact: ${customer.phone || 'N/A'}`, 15, 60);
    doc.text(`Address: ${customer.location || 'N/A'}`, 15, 65);
    if (customer.ntn || customer.strn) {
      doc.text(`${customer.strn ? 'STRN' : 'NTN'}: ${customer.strn || customer.ntn}`, 15, 70);
    }
    
    doc.setFontSize(9);
    doc.text(`Date: ${dateFormatted}`, 195, 48, { align: 'right' });
    doc.text(`Invoice #: JZ-${Date.now().toString().slice(-6)}`, 195, 54, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Distributor: 3U Enterprises`, 195, 60, { align: 'right' });
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(`Product Brand: Jazaa`, 195, 66, { align: 'right' });

    let headers, data;

    if (format === 'TP') {
      headers = [["#", "Product", "Type", "Qty", "Rate", "Disc", "GST", "Adv", "Total"]];
      data = invoiceData.map((row, i) => [
        i + 1,
        cart[i].product.name,
        cart[i].product.product_type,
        cart[i].qty,
        row.rate.toLocaleString(),
        (row.discPctTP * 100).toFixed(1) + "%",
        row.gstAmt.toFixed(2),
        row.advTaxAmt.toFixed(1),
        row.total.toLocaleString(undefined, {minimumFractionDigits: 2})
      ]);
    } else if (format === 'RP') {
      headers = [["#", "Product", "Qty", "Retail Price", "Trade Disc", "Net Rate", "Total"]];
      data = invoiceData.map((row, i) => [
        i + 1,
        cart[i].product.name,
        cart[i].qty,
        row.rp.toLocaleString(),
        (row.discPctRP * 100).toFixed(1) + "%",
        row.rateAfterDiscRP.toFixed(2),
        row.total.toLocaleString(undefined, {minimumFractionDigits: 2})
      ]);
    } else if (format === 'ECOMM') {
      headers = [["#", "Product", "Qty", "Rate", "GST", "Total", "Comm(5%)", "Final"]];
      data = invoiceData.map((row, i) => {
        const comm = row.total * 0.05;
        return [
          i + 1,
          cart[i].product.name,
          cart[i].qty,
          row.rate.toLocaleString(),
          row.gstAmt.toFixed(2),
          row.total.toLocaleString(),
          comm.toFixed(2),
          (row.total + comm).toLocaleString(undefined, {minimumFractionDigits: 2})
        ];
      });
    } else if (format === 'GRN') {
      headers = [["#", "Product", "Booked Qty", "FOC", "Total Units"]];
      data = invoiceData.map((row, i) => [
        i + 1,
        cart[i].product.name,
        cart[i].qty,
        cart[i].product.foc || 0,
        (cart[i].qty + (cart[i].product.foc || 0))
      ]);
    }

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 75,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'center', cellPadding: 3 },
      bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 2.5 },
      columnStyles: { 
        1: { halign: 'left', cellWidth: 'auto' },
        0: { cellWidth: 8 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Summary Box
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.rect(130, finalY, 65, 35, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    
    const subtotalText = format === 'ECOMM' ? grandTotal : invoiceData.reduce((s,r) => s + (r.total), 0);
    
    doc.text(`Subtotal:`, 135, finalY + 8);
    doc.text(`Rs. ${Math.round(subtotalText).toLocaleString()}`, 190, finalY + 8, { align: 'right' });
    
    if (format === 'TP') {
        const gstTotal = invoiceData.reduce((s,r) => s + r.gstAmt * r.qty, 0);
        const advTotal = invoiceData.reduce((s,r) => s + r.advTaxAmt * r.qty, 0);
        doc.text(`Total GST:`, 135, finalY + 14);
        doc.text(`+ Rs. ${Math.round(gstTotal).toLocaleString()}`, 190, finalY + 14, { align: 'right' });
    }

    if (format === 'ECOMM') {
        doc.text(`Commission (5%):`, 135, finalY + 14);
        doc.text(`+ Rs. ${Math.round(ecommCommission).toLocaleString()}`, 190, finalY + 14, { align: 'right' });
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`GRAND TOTAL`, 135, finalY + 25);
    doc.text(`Rs. ${Math.round(displayTotal).toLocaleString()}`, 190, finalY + 25, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.text(`Items: ${invoiceData.length} | Units: ${cart.reduce((s,i)=>s+i.qty, 0)}`, 190, finalY + 32, { align: 'right' });

    // Footer lines
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Prepared By: Jazaa Sales App", 15, 280);
    doc.text("Received By: ___________________", 110, finalY + 30);
    doc.text("Sign / Stamp: ___________________", 110, finalY + 40);

    doc.save(fileName);
    
    // Save to Supabase
    onSend('pdf', `Exported ${format}`, displayTotal, format);
  };

  return (
    <div className="card mt-4 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold">Invoice Preview</h3>
          <p className="text-sm text-muted">Customer: {customer.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['RP', 'TP', 'ECOMM', 'GRN'].map(f => (
            <button 
              key={f}
              className={`btn ${format === f ? 'btn-primary' : 'btn-outline'}`} 
              style={{ minHeight: '40px', padding: '0 1rem', fontSize: '0.85rem' }}
              onClick={() => setFormat(f)}
            >
              {f} Format
            </button>
          ))}
        </div>
      </div>

      {anyBelowFloor && (
        <div className="card bg-red-50 border-red-200 mb-6 p-4 animate-in shadow-lg" style={{ borderLeft: '4px solid #ef4444' }}>
           <div className="flex items-center gap-2 mb-1">
             <span className="text-xl">⚠️</span>
             <p className="text-red-800 text-sm font-bold uppercase tracking-wide">Security & Discount Guardrail Violation</p>
           </div>
           <p className="text-red-700 text-xs leading-relaxed">
             One or more items in your cart are priced <strong>below the official Jazaa Floor Price</strong> for this customer category. 
             Order confirmation is blocked until prices are adjusted to meet minimum profit thresholds.
           </p>
        </div>
      )}

      <div className="table-responsive" style={{ marginBottom: '1.5rem' }}>
        <table>
          <thead>
            {format === 'TP' && (
              <tr>
                <th>Product</th><th>Type</th><th>Qty</th><th>Rate</th><th>Disc %</th><th>GST Amt</th><th>Adv Tax</th><th>Total</th>
              </tr>
            )}
            {format === 'RP' && (
              <tr>
                <th>Product</th><th>Qty</th><th>RP</th><th>Disc %</th><th>After Disc</th><th>Total</th>
              </tr>
            )}
            {format === 'ECOMM' && (
              <tr>
                <th>Product</th><th>Qty</th><th>Rate</th><th>GST</th><th>Base Total</th><th>Comm(5%)</th><th>Final</th>
              </tr>
            )}
            {format === 'GRN' && (
              <tr>
                <th>Product</th><th>Qty</th><th>FOC</th><th>Total (N+F)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {invoiceData.map((row, i) => (
              <tr key={i} className={row.isBelowFloor ? 'bg-red-50' : ''}>
                <td>
                  {cart[i].product.name}
                  {row.isBelowFloor && (
                    <div className="text-[0.65rem] text-red-600 font-bold">
                      MIN ALLOWED: Rs. {row.floorPrice}
                    </div>
                  )}
                </td>
                {format === 'TP' && (
                  <>
                    <td>{cart[i].product.product_type}</td>
                    <td>{cart[i].qty}</td>
                    <td>{row.rate.toFixed(2)}</td>
                    <td>{(row.discPctTP * 100).toFixed(1)}%</td>
                    <td>{row.gstAmt.toFixed(2)}</td>
                    <td>{row.advTaxAmt.toFixed(2)}</td>
                  </>
                )}
                {format === 'RP' && (
                  <>
                    <td>{cart[i].qty}</td>
                    <td>{row.rp.toFixed(2)}</td>
                    <td>{(row.discPctRP * 100).toFixed(1)}%</td>
                    <td>{row.rateAfterDiscRP.toFixed(2)}</td>
                  </>
                )}
                {format === 'ECOMM' && (
                  <>
                    <td>{cart[i].qty}</td>
                    <td>{row.rate.toFixed(2)}</td>
                    <td>{row.gstAmt.toFixed(2)}</td>
                    <td>{row.total.toFixed(2)}</td>
                    <td>{(row.total * 0.05).toFixed(2)}</td>
                  </>
                )}
                {format === 'GRN' && (
                  <>
                    <td>{cart[i].qty}</td>
                    <td>{cart[i].product.foc || 0}</td>
                    <td>{cart[i].qty + (cart[i].product.foc || 0)}</td>
                  </>
                )}
                <td className="font-bold">
                  Rs. {format === 'ECOMM' ? (row.total * 1.05).toFixed(2) : format === 'GRN' ? '-' : row.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-2 mb-6">
        {format === 'ECOMM' && (
          <div className="text-muted">Base Total: Rs. {grandTotal.toFixed(2)}</div>
        )}
        <div className="text-2xl font-bold">
           TOTAL: <span className="text-primary">Rs. {(format === 'ECOMM' ? ecommFinal : grandTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
      </div>

      <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
         <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1 }}>Discard Order</button>
          <button 
            className="btn btn-primary" 
            onClick={generatePDF} 
            style={{ 
              flex: 3, 
              padding: '1rem', 
              fontSize: '1.1rem', 
              fontWeight: 'bold',
              opacity: anyBelowFloor ? 0.6 : 1,
              background: anyBelowFloor ? '#94a3b8' : 'var(--primary)',
              cursor: anyBelowFloor ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            disabled={anyBelowFloor}
          >
             {anyBelowFloor ? '🚫 Order Blocked (Below Floor)' : '✅ Confirm & Export PDF'}
          </button>
      </div>
    </div>
  );
}

