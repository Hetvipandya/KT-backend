'use strict';

const fmtCurrency = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
};

const numberToWords = (num) => {
  if (!num || isNaN(num)) return "Zero Rupees Only";
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n) => {
    if ((n = n.toString()).length > 9) return "overflow";
    const n_array = ("000000000" + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n_array) return "";
    let str = "";
    str += n_array[1] != 0 ? (a[Number(n_array[1])] || b[n_array[1][0]] + " " + a[n_array[1][1]]) + "Crore " : "";
    str += n_array[2] != 0 ? (a[Number(n_array[2])] || b[n_array[2][0]] + " " + a[n_array[2][1]]) + "Lakh " : "";
    str += n_array[3] != 0 ? (a[Number(n_array[3])] || b[n_array[3][0]] + " " + a[n_array[3][1]]) + "Thousand " : "";
    str += n_array[4] != 0 ? (a[Number(n_array[4])] || b[n_array[4][0]] + " " + a[n_array[4][1]]) + "Hundred " : "";
    str += n_array[5] != 0 ? (str != "" ? "and " : "") + (a[Number(n_array[5])] || b[n_array[5][0]] + " " + a[n_array[5][1]]) : "";
    return str;
  };

  const amount = Math.floor(Math.abs(num));
  const words = inWords(amount);
  return words ? words.trim() + " Rupees Only" : "Zero Rupees Only";
};

const mapStatusLabel = (status) => {
  if (!status) return 'APPROVED';
  const s = String(status).toUpperCase();
  if (s === 'PAID') return 'SUCCESS';
  if (s === 'POSTED') return 'APPROVED';
  if (s === 'DRAFT' || s === 'PARTIALLY_PAID') return 'PENDING';
  if (s === 'CANCELLED') return 'CANCELLED';
  return s;
};

const renderInvoiceHtml = (invoice, company = {}, customer = {}) => {
  const compName = company.name || company.companyName || 'KEVALON TECHNOLOGY';
  const compGstin = company.gstin || company.gstNumber || '—';
  const compPan = company.pan || '—';
  const compAddressArr = [company.address, company.city, company.state, company.pincode].filter(Boolean);
  const compAddress = compAddressArr.length ? compAddressArr.join(', ') : 'Solaris Business Hub, Ahmedabad, Gujarat, India';
  const compPhone = company.phone || '+91 78620 24638';
  const compEmail = company.email || 'contact@kevalontechnology.in';

  const custName = customer.name || invoice.customerName || 'Customer';
  const custGstin = customer.gstin || invoice.customerGstin || '—';
  const custPan = customer.pan || '—';
  const custPhone = customer.phone || '—';

  let custAddrStr = '—';
  if (customer.billingAddress) {
    const b = customer.billingAddress;
    custAddrStr = [b.line1, b.line2, b.city, b.state, b.pincode, b.country].filter(Boolean).join(', ');
  } else if (invoice.billingAddress) {
    const b = invoice.billingAddress;
    custAddrStr = typeof b === 'string' ? b : [b.line1, b.line2, b.city, b.state, b.pincode, b.country].filter(Boolean).join(', ');
  }

  const statusText = mapStatusLabel(invoice.status || invoice.rawStatus);
  let statusBadgeClass = 'badge-approved';
  if (statusText === 'SUCCESS') statusBadgeClass = 'badge-success';
  if (statusText === 'PENDING') statusBadgeClass = 'badge-pending';
  if (statusText === 'CANCELLED') statusBadgeClass = 'badge-cancelled';

  const lineItems = invoice.lineItems || [];
  const grandTotal = invoice.grandTotal || 0;
  const grandTotalWords = numberToWords(grandTotal);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice - ${invoice.invoiceNumber || 'INV'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f3f4f6; color: #1f2937; padding: 20px; }
    
    .action-bar {
      max-width: 850px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }

    .action-bar-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    
    .btn-print {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .btn-print:hover { background: #1d4ed8; }

    .invoice-card {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb;
    }

    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .company-title { font-size: 22px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
    .company-tax { font-size: 12px; font-weight: 600; color: #4b5563; margin-top: 4px; }
    .company-sub { font-size: 12px; color: #6b7280; margin-top: 2px; line-height: 1.4; }
    .invoice-badge { text-align: right; vertical-align: top; }
    .invoice-badge h2 { font-size: 22px; color: #1e3a8a; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
    
    .badge-tag {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-approved { background-color: #dcfce7; color: #15803d; }
    .badge-success { background-color: #dcfce7; color: #166534; }
    .badge-pending { background-color: #fef9c3; color: #a16207; }
    .badge-cancelled { background-color: #fee2e2; color: #b91c1c; }

    .divider { height: 2px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%); margin-bottom: 25px; border-radius: 2px; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      padding: 14px 18px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 25px;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .meta-val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .meta-val-accent { color: #2563eb; }

    .billing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 25px;
    }
    .billing-box h3 { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .cust-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .cust-detail { font-size: 12px; color: #4b5563; line-height: 1.5; }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      border: 1px solid #cbd5e1;
    }
    .items-table th {
      background: #1e3a8a;
      color: #ffffff;
      font-size: 12px;
      text-transform: uppercase;
      padding: 10px 12px;
      text-align: left;
      font-weight: 700;
    }
    .items-table td {
      padding: 10px 12px;
      font-size: 13px;
      border-bottom: 1px solid #e2e8f0;
      color: #1f2937;
    }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .amount-col { font-weight: 600; color: #0f172a; }

    .totals-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 25px;
    }
    .notes-box { width: 55%; font-size: 12px; color: #4b5563; line-height: 1.5; }
    .notes-box strong { font-size: 12px; color: #0f172a; text-transform: uppercase; display: block; margin-bottom: 4px; }

    .totals-table {
      width: 40%;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 10px;
      font-size: 13px;
    }
    .totals-label { color: #4b5563; text-align: right; }
    .totals-val { font-weight: 600; color: #0f172a; text-align: right; }
    
    .grand-total-row td {
      border-top: 2px solid #2563eb;
      font-weight: 800 !important;
      font-size: 15px !important;
      color: #1e3a8a !important;
      padding-top: 10px;
    }

    .banner-words {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 12px 18px;
      border-radius: 6px;
      font-size: 12px;
      color: #1e40af;
      margin-bottom: 30px;
    }
    .banner-words strong { font-weight: 700; }

    .signatures-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
    .sig-box { text-align: center; width: 40%; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-bottom: 8px; }
    .sig-label { font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; }

    .footer-note { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px; }

    @media print {
      body { background: #ffffff; padding: 0; }
      .action-bar { display: none !important; }
      .invoice-card { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>

  <div class="action-bar">
    <div>
      <div class="action-bar-title">Tax Invoice Document</div>
      <span style="color: #6b7280; font-size: 12px;">Invoice No: <strong>${invoice.invoiceNumber || '—'}</strong></span>
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ Print / Download PDF
    </button>
  </div>

  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td>
          <div class="company-title">${compName}</div>
          <div class="company-tax">GSTIN: ${compGstin} &nbsp;|&nbsp; PAN: ${compPan}</div>
          <div class="company-sub">${compAddress}<br>Email: ${compEmail} | Phone: ${compPhone}</div>
        </td>
        <td class="invoice-badge">
          <h2>TAX INVOICE</h2>
          <span class="badge-tag ${statusBadgeClass}">${statusText}</span>
        </td>
      </tr>
    </table>

    <div class="divider"></div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Invoice No</span>
        <span class="meta-val meta-val-accent">${invoice.invoiceNumber || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Invoice Date</span>
        <span class="meta-val">${fmtDate(invoice.invoiceDate)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Due Date</span>
        <span class="meta-val">${fmtDate(invoice.dueDate)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Reference</span>
        <span class="meta-val">${invoice.reference || '—'}</span>
      </div>
    </div>

    <div class="billing-section">
      <div class="billing-box">
        <h3>Billed To (Customer)</h3>
        <div class="cust-name">${custName}</div>
        <div class="cust-detail">
          ${custAddrStr !== '—' ? `${custAddrStr}<br>` : ''}
          ${custGstin !== '—' ? `GSTIN: ${custGstin}<br>` : ''}
          ${custPan !== '—' ? `PAN: ${custPan}<br>` : ''}
          ${custPhone !== '—' ? `Phone: ${custPhone}` : ''}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 5%;">#</th>
          <th style="width: 35%;">Description</th>
          <th class="text-right" style="width: 10%;">Qty</th>
          <th class="text-right" style="width: 12%;">Rate</th>
          <th class="text-right" style="width: 12%;">Discount</th>
          <th class="text-right" style="width: 11%;">GST</th>
          <th class="text-right" style="width: 15%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((item, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${item.description || '—'}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${fmtCurrency(item.rate)}</td>
            <td class="text-right">${fmtCurrency(item.discount || 0)}</td>
            <td class="text-right">${fmtCurrency(item.taxAmount || 0)}</td>
            <td class="text-right amount-col">${fmtCurrency(item.totalAmount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-container">
      <div class="notes-box">
        ${invoice.notes ? `
          <strong>Notes & Remarks:</strong>
          <p>${invoice.notes}</p>
        ` : ''}
      </div>

      <table class="totals-table">
        <tr>
          <td class="totals-label">Sub Total:</td>
          <td class="totals-val">${fmtCurrency(invoice.subTotal)}</td>
        </tr>
        ${invoice.discountTotal > 0 ? `
          <tr>
            <td class="totals-label">Discount Total:</td>
            <td class="totals-val">- ${fmtCurrency(invoice.discountTotal)}</td>
          </tr>
        ` : ''}
        ${invoice.taxTotal > 0 ? `
          <tr>
            <td class="totals-label">GST Total:</td>
            <td class="totals-val">${fmtCurrency(invoice.taxTotal)}</td>
          </tr>
        ` : ''}
        ${invoice.roundOff ? `
          <tr>
            <td class="totals-label">Round Off:</td>
            <td class="totals-val">${fmtCurrency(invoice.roundOff)}</td>
          </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td class="totals-label">Grand Total:</td>
          <td class="totals-val">${fmtCurrency(grandTotal)}</td>
        </tr>
        ${invoice.balanceDue > 0 && invoice.balanceDue !== grandTotal ? `
          <tr>
            <td class="totals-label">Amount Received:</td>
            <td class="totals-val">${fmtCurrency(invoice.amountReceived || 0)}</td>
          </tr>
          <tr>
            <td class="totals-label" style="color: #dc2626; font-weight: 700;">Balance Due:</td>
            <td class="totals-val" style="color: #dc2626; font-weight: 700;">${fmtCurrency(invoice.balanceDue)}</td>
          </tr>
        ` : ''}
      </table>
    </div>

    <div class="banner-words">
      <strong>Amount in Words:</strong> ${grandTotalWords}
    </div>

    <table class="signatures-table">
      <tr>
        <td class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Customer Signature</div>
        </td>
        <td style="width: 20%;"></td>
        <td class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Authorized Signatory (${compName})</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      This is a computer-generated tax invoice and does not require a physical seal.
    </div>
  </div>

</body>
</html>`;
};

module.exports = {
  renderInvoiceHtml,
  numberToWords,
  fmtCurrency
};
