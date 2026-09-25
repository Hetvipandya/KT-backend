'use strict';

const PDFDocument = require('pdfkit');
const Company = require('../models/Company');
const Customer = require('../models/Customer');

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const mapStatusLabel = (status) => {
  if (!status) return 'APPROVED';
  const s = String(status).toUpperCase();
  if (s === 'PAID') return 'SUCCESS';
  if (s === 'POSTED') return 'APPROVED';
  if (s === 'DRAFT' || s === 'PARTIALLY_PAID') return 'PENDING';
  if (s === 'CANCELLED') return 'CANCELLED';
  return s;
};

// Color Palette
const PRIMARY     = '#1E3A8A'; // Deep Navy Header
const ACCENT      = '#2563EB'; // Royal Blue Accent
const DARK        = '#0F172A'; // Slate Primary Text
const MID         = '#475569'; // Slate Secondary Text
const LIGHT       = '#64748B'; // Slate Muted Text
const BG_SOFT     = '#F8FAFC'; // Soft Slate Fill
const BORDER      = '#E2E8F0'; // Crisp Divider Line

const LEFT_MARGIN   = 40;
const RIGHT_MARGIN  = 555;
const PAGE_WIDTH    = 595;
const CONTENT_WIDTH = RIGHT_MARGIN - LEFT_MARGIN;

const generateInvoicePdf = async (invoice) => {
  const [company, customer] = await Promise.all([
    Company.findById(invoice.companyId).lean(),
    Customer.findById(invoice.customerId?._id || invoice.customerId).lean()
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: LEFT_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── 1. Calculate Dynamic Header Height ──────────────────────────────────
    let compName = company?.name || company?.companyName || 'KEVALON TECHNOLOGY';
    if (!compName || compName.toLowerCase().includes('tapzy')) {
      compName = 'KEVALON TECHNOLOGY';
    }
    const compFontSize = compName.length > 30 ? 14 : 16;
    
    doc.fontSize(compFontSize).font('Helvetica-Bold');
    const compNameHeight = doc.heightOfString(compName, { width: 330 });

    const compGstin = company?.gstin || company?.gstNumber || '24BQSPH0154B1Z9';
    const compPan = company?.pan || company?.panNumber || 'BQSPH0154';
    const taxDetails = `GSTIN: ${compGstin}   PAN: ${compPan}`;
    
    const compAddrArr = [company?.address, company?.city, company?.state, company?.pincode].filter(Boolean);
    const compAddr = (compAddrArr.length && !company?.address?.toLowerCase().includes('tapzy'))
      ? compAddrArr.join(', ')
      : 'Solaris Business Hub, Memnagar, Ahmedabad, Gujarat - 380052, India';

    const compPhoneStr = company?.phone || '+91 78620 24638';
    const compEmailStr = company?.email || 'contact@kevalontechnology.in';
    const compContact = `Ph: ${compPhoneStr}  |  ${compEmailStr}`;

    doc.fontSize(8.5).font('Helvetica');
    const taxHeight = doc.heightOfString(taxDetails, { width: 330 });
    const addrHeight = compAddr ? doc.heightOfString(compAddr, { width: 330 }) : 0;
    const contactHeight = compContact ? doc.heightOfString(compContact, { width: 330 }) : 0;

    const totalHeaderContentHeight = compNameHeight + 6 + taxHeight + (addrHeight ? addrHeight + 3 : 0) + (contactHeight ? contactHeight + 3 : 0);
    const headerHeight = Math.max(105, totalHeaderContentHeight + 30);

    // Render Header Background Box
    doc.rect(0, 0, PAGE_WIDTH, headerHeight).fill(PRIMARY);

    // Render Header Content
    let headY = 18;

    // Company Name
    doc.fillColor('#FFFFFF')
       .fontSize(compFontSize).font('Helvetica-Bold')
       .text(compName, LEFT_MARGIN, headY, { width: 330 });
    headY += compNameHeight + 5;

    // Company Tax & Address Details
    doc.fontSize(8.5).font('Helvetica').fillColor('#E2E8F0')
       .text(taxDetails, LEFT_MARGIN, headY, { width: 330 });
    headY += taxHeight + 3;

    if (compAddr) {
      doc.text(compAddr, LEFT_MARGIN, headY, { width: 330 });
      headY += addrHeight + 3;
    }

    if (compContact) {
      doc.text(compContact, LEFT_MARGIN, headY, { width: 330 });
    }

    // Right Side Header (TAX INVOICE & Status Badge)
    doc.fillColor('#FFFFFF')
       .fontSize(16).font('Helvetica-Bold')
       .text('TAX INVOICE', 380, 18, { align: 'right', width: 175 });

    const statusText = mapStatusLabel(invoice.status);
    const badgeColor = (statusText === 'SUCCESS' || statusText === 'APPROVED') ? '#4ADE80' : '#FDE047';
    doc.fontSize(10).font('Helvetica-Bold')
       .fillColor(badgeColor)
       .text(statusText, 380, 42, { align: 'right', width: 175 });

    // ── 2. Invoice Details Grid (Invoice No, Dates) ──────────────────────────
    let y = headerHeight + 15;
    const gridHeight = 44;

    doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, gridHeight).fill(BG_SOFT).strokeColor(BORDER).lineWidth(1).stroke();

    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT)
       .text('INVOICE NO.', LEFT_MARGIN + 12, y + 8)
       .text('INVOICE DATE', LEFT_MARGIN + 150, y + 8)
       .text('DUE DATE', LEFT_MARGIN + 280, y + 8)
       .text('STATUS', LEFT_MARGIN + 410, y + 8);

    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(ACCENT)
       .text(invoice.invoiceNumber || '—', LEFT_MARGIN + 12, y + 24);

    doc.fontSize(9.5).font('Helvetica').fillColor(DARK)
       .text(fmtDate(invoice.invoiceDate), LEFT_MARGIN + 150, y + 24)
       .text(fmtDate(invoice.dueDate), LEFT_MARGIN + 280, y + 24)
       .text(statusText, LEFT_MARGIN + 410, y + 24);

    y += gridHeight + 15;

    // ── 3. Bill To & Dynamic Customer Address ─────────────────────────────────
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT).text('BILL TO', LEFT_MARGIN, y);
    if (invoice.reference) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT).text('REFERENCE', LEFT_MARGIN + 310, y);
    }
    y += 12;

    const custName = customer?.name || invoice.customerName || '—';
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(DARK)
       .text(custName, LEFT_MARGIN, y, { width: 290 });

    if (invoice.reference) {
      doc.fontSize(9.5).font('Helvetica').fillColor(DARK)
         .text(invoice.reference, LEFT_MARGIN + 310, y, { width: 190 });
    }

    doc.fontSize(10.5).font('Helvetica-Bold');
    y += doc.heightOfString(custName, { width: 290 }) + 4;

    doc.fontSize(8.5).font('Helvetica').fillColor(MID);
    const addr = customer?.billingAddress;
    if (addr) {
      const addrLine = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country]
        .filter(Boolean).join(', ');
      doc.text(addrLine, LEFT_MARGIN, y, { width: 290 });
      y += doc.heightOfString(addrLine, { width: 290 }) + 4;
    }

    const { extractPanFromGstin } = require('../utils/gst.utils');
    const custPan = customer?.pan || extractPanFromGstin(customer?.gstin);
    if (customer?.gstin || custPan) {
      doc.text(`GSTIN: ${customer?.gstin || '—'}${custPan ? '   PAN: ' + custPan : ''}`, LEFT_MARGIN, y, { width: 290 });
      y += 13;
    }
    if (customer?.phone) {
      doc.text(`Phone: ${customer.phone}`, LEFT_MARGIN, y, { width: 290 });
      y += 13;
    }

    y += 12;

    // ── 4. Line Items Table Header ───────────────────────────────────────────
    doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, 22).fill(PRIMARY);

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('#',          LEFT_MARGIN + 6,   y + 6);
    doc.text('Description',LEFT_MARGIN + 24,  y + 6, { width: 200 });
    doc.text('Qty',        LEFT_MARGIN + 230, y + 6, { width: 40, align: 'right' });
    doc.text('Rate',       LEFT_MARGIN + 275, y + 6, { width: 65, align: 'right' });
    doc.text('Discount',   LEFT_MARGIN + 345, y + 6, { width: 55, align: 'right' });
    doc.text('Tax',        LEFT_MARGIN + 405, y + 6, { width: 50, align: 'right' });
    doc.text('Amount',     LEFT_MARGIN + 460, y + 6, { width: 50, align: 'right' });

    y += 22;

    // Table Rows
    (invoice.lineItems || []).forEach((item, idx) => {
      doc.fontSize(8.5).font('Helvetica');
      const descHeight = doc.heightOfString(item.description || '—', { width: 200 });
      const rowH = Math.max(22, descHeight + 10);
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : BG_SOFT;

      doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, rowH).fill(rowBg);

      doc.fillColor(DARK);
      doc.text(String(idx + 1),         LEFT_MARGIN + 6,   y + 6);
      doc.text(item.description || '—', LEFT_MARGIN + 24,  y + 6, { width: 200 });
      doc.text(String(item.quantity),   LEFT_MARGIN + 230, y + 6, { width: 40, align: 'right' });
      doc.text(fmt(item.rate),          LEFT_MARGIN + 275, y + 6, { width: 65, align: 'right' });
      doc.text(fmt(item.discount || 0), LEFT_MARGIN + 345, y + 6, { width: 55, align: 'right' });
      doc.text(fmt(item.taxAmount || 0),LEFT_MARGIN + 405, y + 6, { width: 50, align: 'right' });
      doc.font('Helvetica-Bold').text(fmt(item.totalAmount), LEFT_MARGIN + 460, y + 6, { width: 50, align: 'right' });

      y += rowH;
    });

    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 12;

    // ── 5. Totals Box ────────────────────────────────────────────────────────
    const totalsX = 330;
    const addTotalRow = (label, value, isBold = false, color = DARK) => {
      doc.fontSize(9)
         .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(color)
         .text(label, totalsX, y, { width: 100, align: 'right' })
         .text(value,  totalsX + 105, y, { width: CONTENT_WIDTH - (totalsX - LEFT_MARGIN) - 105, align: 'right' });
      y += 16;
    };

    addTotalRow('Sub Total', fmt(invoice.subTotal));
    if (invoice.discountTotal > 0) addTotalRow('Discount', `- ${fmt(invoice.discountTotal)}`);
    if (invoice.taxTotal > 0) addTotalRow('GST Total', fmt(invoice.taxTotal));
    if (invoice.roundOff) addTotalRow('Round Off', fmt(invoice.roundOff));

    doc.moveTo(totalsX + 30, y).lineTo(RIGHT_MARGIN, y).strokeColor(ACCENT).lineWidth(1).stroke();
    y += 6;
    addTotalRow('GRAND TOTAL', fmt(invoice.grandTotal), true, ACCENT);

    if (invoice.balanceDue > 0 && invoice.balanceDue !== invoice.grandTotal) {
      addTotalRow('Amount Received', fmt(invoice.amountReceived || 0));
      addTotalRow('Balance Due', fmt(invoice.balanceDue), true, '#DC2626');
    }

    // ── 6. Notes ─────────────────────────────────────────────────────────────
    if (invoice.notes) {
      y += 10;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT).text('NOTES', LEFT_MARGIN, y);
      y += 12;
      doc.fontSize(8.5).font('Helvetica').fillColor(MID).text(invoice.notes, LEFT_MARGIN, y, { width: 300 });
    }

    // ── 7. Footer ────────────────────────────────────────────────────────────
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY, PAGE_WIDTH, 40).fill(PRIMARY);
    doc.fontSize(8).font('Helvetica').fillColor('#FFFFFF')
       .text('Thank you for your business!', LEFT_MARGIN, footerY + 8, { align: 'center', width: CONTENT_WIDTH })
       .text(`Generated on ${fmtDate(new Date())}  |  ${compName}`, LEFT_MARGIN, footerY + 22, { align: 'center', width: CONTENT_WIDTH });

    doc.end();
  });
};

module.exports = { generateInvoicePdf };
