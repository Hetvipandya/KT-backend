'use strict';

const PDFDocument = require('pdfkit');
const Company = require('../models/Company');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => {
  const abs = Math.abs(n || 0);
  return `Rs. ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtBal = (bal) => {
  const absVal = fmt(bal);
  const type = bal >= 0 ? 'Dr' : 'Cr';
  return `${absVal} ${type}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Colours & Fonts ──────────────────────────────────────────────────────────

const BRAND   = '#1a56db';   // primary color
const DARK    = '#111827';   // text color
const MID     = '#374151';   // secondary text
const LIGHT   = '#6b7280';   // muted text
const LINE    = '#e5e7eb';   // divider lines
const ACCENT  = '#eff6ff';   // table header bg

// ─── Column Layout ────────────────────────────────────────────────────────────

const LEFT_MARGIN  = 40;
const RIGHT_MARGIN = 555;
const PAGE_WIDTH   = 595;

/**
 * Generates a professional Ledger Statement PDF buffer.
 * @param {Object} history  - the ledger history object returned by ledgerService.getLedgerHistory
 * @returns {Promise<Buffer>}
 */
const generateLedgerPdf = async (history) => {
  // Fetch company details
  const company = await Company.findById(history.companyId).lean();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: LEFT_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header Band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_WIDTH, 90).fill(BRAND);

    // Company Name
    doc.fillColor('#ffffff')
       .fontSize(18).font('Helvetica-Bold')
       .text(company?.name || 'Your Company', LEFT_MARGIN, 22, { width: 300 });

    // Company GSTIN / PAN
    doc.fontSize(8).font('Helvetica')
       .text(`GSTIN: ${company?.gstin || '—'}   PAN: ${company?.pan || '—'}`, LEFT_MARGIN, 48)
       .text(`${[company?.address, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')}`, LEFT_MARGIN, 58)
       .text(`${company?.phone || ''}${company?.email ? '  |  ' + company.email : ''}`, LEFT_MARGIN, 68);

    // STATEMENT label
    doc.fontSize(16).font('Helvetica-Bold')
       .text('LEDGER STATEMENT', LEFT_MARGIN, 22, { align: 'right', width: RIGHT_MARGIN - LEFT_MARGIN });

    doc.fillColor(DARK);

    // ── Ledger Meta Info ─────────────────────────────────────────────────────
    let y = 105;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('ACCOUNT NAME', LEFT_MARGIN, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('PERIOD', 320, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('FINANCIAL YEAR', 450, y);

    y += 13;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND)
       .text(`${history.account.name} (${history.account.code})`, LEFT_MARGIN, y, { width: 250 });
    
    doc.fontSize(9.5).font('Helvetica').fillColor(DARK);
    const fromStr = history.period.from ? fmtDate(history.period.from) : 'Start';
    const toStr = history.period.to ? fmtDate(history.period.to) : 'End';
    doc.text(`${fromStr} to ${toStr}`, 320, y);
    doc.text(history.financialYear?.yearLabel || '—', 450, y);

    // Divider
    y += 20;
    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(LINE).lineWidth(1).stroke();

    // ── Summary Box ──────────────────────────────────────────────────────────
    y += 12;
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 40).fill(ACCENT);
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
    doc.text('OPENING BALANCE', LEFT_MARGIN + 10, y + 8,  { width: 110, align: 'center' });
    doc.text('TOTAL DEBITS',    LEFT_MARGIN + 130, y + 8, { width: 110, align: 'center' });
    doc.text('TOTAL CREDITS',   LEFT_MARGIN + 250, y + 8, { width: 110, align: 'center' });
    doc.text('CLOSING BALANCE', LEFT_MARGIN + 370, y + 8, { width: 130, align: 'center' });

    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(DARK);
    doc.text(fmtBal(history.openingBalance),          LEFT_MARGIN + 10, y + 20,  { width: 110, align: 'center' });
    doc.text(fmt(history.totals.debit),              LEFT_MARGIN + 130, y + 20, { width: 110, align: 'center' });
    doc.text(fmt(history.totals.credit),             LEFT_MARGIN + 250, y + 20, { width: 110, align: 'center' });
    doc.fillColor(BRAND).text(fmtBal(history.closingBalance), LEFT_MARGIN + 370, y + 20, { width: 130, align: 'center' });

    y += 50;

    // ── Transactions Table ───────────────────────────────────────────────────
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill('#f3f4f6');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BRAND);
    doc.text('Date',         LEFT_MARGIN + 5,   y + 5);
    doc.text('Ref / Source', LEFT_MARGIN + 70,  y + 5, { width: 100 });
    doc.text('Narration',    LEFT_MARGIN + 175, y + 5, { width: 170 });
    doc.text('Debit (Dr)',   LEFT_MARGIN + 350, y + 5, { width: 50, align: 'right' });
    doc.text('Credit (Cr)',  LEFT_MARGIN + 405, y + 5, { width: 50, align: 'right' });
    doc.text('Balance',      LEFT_MARGIN + 460, y + 5, { width: 50, align: 'right' });

    y += 22;

    (history.entries || []).forEach((entry, idx) => {
      // Check page break if Y coordinate gets close to page bottom
      if (y > 750) {
        doc.addPage();
        y = 50;
        // Table header on next page
        doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill('#f3f4f6');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BRAND);
        doc.text('Date',         LEFT_MARGIN + 5,   y + 5);
        doc.text('Ref / Source', LEFT_MARGIN + 70,  y + 5, { width: 100 });
        doc.text('Narration',    LEFT_MARGIN + 175, y + 5, { width: 170 });
        doc.text('Debit (Dr)',   LEFT_MARGIN + 350, y + 5, { width: 50, align: 'right' });
        doc.text('Credit (Cr)',  LEFT_MARGIN + 405, y + 5, { width: 50, align: 'right' });
        doc.text('Balance',      LEFT_MARGIN + 460, y + 5, { width: 50, align: 'right' });
        y += 22;
      }

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      const rowH = 24;
      doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, rowH).fill(rowBg);

      doc.fontSize(8).font('Helvetica').fillColor(DARK);
      doc.text(fmtDate(entry.date), LEFT_MARGIN + 5, y + 6);
      
      const ref = entry.reference || entry.source || '—';
      doc.text(ref, LEFT_MARGIN + 70, y + 6, { width: 100, ellipsis: true });
      
      const narr = [entry.narration, entry.remarks].filter(Boolean).join(' - ') || '—';
      doc.text(narr, LEFT_MARGIN + 175, y + 6, { width: 170, ellipsis: true });

      const debStr = entry.debit > 0 ? fmt(entry.debit).replace('Rs. ', '') : '—';
      const credStr = entry.credit > 0 ? fmt(entry.credit).replace('Rs. ', '') : '—';
      doc.text(debStr, LEFT_MARGIN + 350, y + 6, { width: 50, align: 'right' });
      doc.text(credStr, LEFT_MARGIN + 405, y + 6, { width: 50, align: 'right' });

      const balStr = `${fmt(entry.runningBalance).replace('Rs. ', '')} ${entry.balanceType}`;
      doc.font('Helvetica-Bold').text(balStr, LEFT_MARGIN + 460, y + 6, { width: 50, align: 'right' });

      y += rowH;
    });

    // Table bottom border
    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(LINE).lineWidth(0.5).stroke();

    // ── Footer ───────────────────────────────────────────────────────────────
    // Write footer on all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 45;
      doc.rect(0, footerY, PAGE_WIDTH, 45).fill(BRAND);
      doc.fontSize(8).font('Helvetica').fillColor('#ffffff')
         .text(`Ledger Statement for ${history.account.name}  |  Generated on ${fmtDate(new Date())}`, LEFT_MARGIN, footerY + 14, { align: 'left', width: 350 })
         .text(`Page ${i + 1} of ${pages.count}`, 350 + LEFT_MARGIN, footerY + 14, { align: 'right', width: RIGHT_MARGIN - LEFT_MARGIN - 350 });
    }

    doc.end();
  });
};

module.exports = { generateLedgerPdf };
