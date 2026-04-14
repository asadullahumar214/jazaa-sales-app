import React, { useState } from 'react';
import { calculateTaxesAndTotals } from '../taxEngine';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function InvoiceGenerator({ cart, customer, settingsObj, onSend, onCancel }) {
  const [format, setFormat] = useState('TP'); // 'TP' or 'RP'

  if (!customer) {
    return <div>Please select a customer to generate invoice.</div>;
  }

  const invoiceData = cart.map(item => {
    return calculateTaxesAndTotals(customer.type, item.product, item.qty, settingsObj);
  });

  const grandTotal = invoiceData.reduce((sum, row) => sum + row.total, 0);

  const generatePDF = () => {
    const doc = new jsPDF();
    const date = new Date();
    
    // Format date: 14apr26
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' }).toLowerCase();
    const year = date.getFullYear().toString().slice(-2);
    const dateStr = `${day}${month}${year}`;
    
    // Filename: 14apr26_Asad_1547.23
    const fileName = `${dateStr}_${customer.name.replace(/\s+/g, '')}_${grandTotal.toFixed(2)}.pdf`;

    doc.setFontSize(20);
    doc.text("JAZAA SALES INVOICE", 15, 20);
    
    doc.setFontSize(10);
    doc.text(`Customer: ${customer.name}`, 15, 30);
    doc.text(`Contact: ${customer.phone || 'N/A'}`, 15, 35);
    doc.text(`Tax Type: ${customer.type} ${customer.type === 'IT' ? '(NTN: ' + customer.ntn + ')' : customer.type === 'Both' ? '(STRN: ' + customer.strn + ')' : ''}`, 15, 40);
    doc.text(`Date: ${date.toLocaleDateString()}`, 15, 45);
    doc.text(`Format: ${format}`, 15, 50);

    const headers = format === 'TP' 
      ? [["Product", "Qty", "Rate", "Disc %", "After Disc", "GST", "Adv Tax", "Total"]]
      : [["Product", "Qty", "RP", "Disc %", "After Disc", "Total"]];

    const data = invoiceData.map((row, i) => {
      const prod = cart[i].product;
      return format === 'TP' 
        ? [prod.name, cart[i].qty, row.rate.toFixed(2), (row.discPctTP * 100).toFixed(2) + "%", row.afterDiscRate.toFixed(2), row.gstAmt.toFixed(2), row.advTaxAmt.toFixed(2), row.total.toFixed(2)]
        : [prod.name, cart[i].qty, row.rp.toFixed(2), (row.discPctRP * 100).toFixed(2) + "%", row.rateAfterDiscRP.toFixed(2), row.total.toFixed(2)];
    });

    doc.autoTable({
      head: headers,
      body: data,
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text(`GRAND TOTAL: PKR ${grandTotal.toFixed(2)}`, 15, finalY);

    doc.save(fileName);
    
    // Call onSend to log the order in the database
    onSend('pdf', 'PDF Exported', grandTotal, format);
  };

  return (
    <div className="card mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3>Invoice Preview</h3>
        <div className="flex gap-2">
          <button className={`btn ${format === 'TP' ? 'btn-primary' : 'btn-outline'}`} style={{minHeight:'40px', padding:'0.5rem 1rem'}} onClick={() => setFormat('TP')}>TP Format</button>
          <button className={`btn ${format === 'RP' ? 'btn-primary' : 'btn-outline'}`} style={{minHeight:'40px', padding:'0.5rem 1rem'}} onClick={() => setFormat('RP')}>RP Format</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <table style={{ minWidth: format === 'TP' ? '800px' : '600px' }}>
          <thead>
            {format === 'TP' ? (
              <tr>
                <th>Product</th><th>Qty</th><th>Rate</th><th>Disc %</th><th>After Disc</th><th>GST Amt</th><th>Adv Tax</th><th>Total</th>
              </tr>
            ) : (
              <tr>
                <th>Product</th><th>Qty</th><th>RP</th><th>Disc %</th><th>Rate After Disc</th><th>Total</th>
              </tr>
            )}
          </thead>
          <tbody>
            {invoiceData.map((row, i) => (
              <tr key={i}>
                <td>{cart[i].product.name}</td>
                <td>{cart[i].qty}</td>
                {format === 'TP' ? (
                  <>
                    <td>{row.rate.toFixed(2)}</td>
                    <td>{(row.discPctTP * 100).toFixed(2)}%</td>
                    <td>{row.afterDiscRate.toFixed(2)}</td>
                    <td>{row.gstAmt.toFixed(2)}</td>
                    <td>{row.advTaxAmt.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td>{row.rp.toFixed(2)}</td>
                    <td>{(row.discPctRP * 100).toFixed(2)}%</td>
                    <td>{row.rateAfterDiscRP.toFixed(2)}</td>
                  </>
                )}
                <td className="font-bold">Rs. {row.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-right mt-4 text-2xl">
           TOTAL: <span style={{ color: 'var(--primary)', fontWeight: 800 }}>Rs. {grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-4 mt-6" style={{ flexWrap: 'wrap' }}>
         <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1 }}>Discard Order</button>
         <button className="btn btn-secondary" onClick={generatePDF} style={{ flex: 2 }}>
            📄 Export & Save PDF
         </button>
      </div>
    </div>
  );
}

