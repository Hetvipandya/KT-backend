'use strict';

const PDFDocument = require('pdfkit');
const Company = require('../models/Company');

const fmt = (n) => {
  const abs = Math.abs(n || 0);
  return `Rs. ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BRAND   = '#1a56db';
const DARK    = '#111827';
const LIGHT   = '#6b7280';
const LINE    = '#e5e7eb';
const ACCENT  = '#eff6ff';

const LEFT_MARGIN  = 40;
const RIGHT_MARGIN = 555;
const PAGE_WIDTH   = 595;

const addHeader = (doc, title, company) => {
  doc.rect(0, 0, PAGE_WIDTH, 90).fill(BRAND);
  doc.fillColor('#ffffff')
     .fontSize(18).font('Helvetica-Bold')
     .text(company?.name || 'Your Company', LEFT_MARGIN, 22, { width: 300 });

  doc.fontSize(8).font('Helvetica')
     .text(`GSTIN: ${company?.gstin || '—'}   PAN: ${company?.pan || '—'}`, LEFT_MARGIN, 48)
     .text(`${[company?.address, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')}`, LEFT_MARGIN, 58)
     .text(`${company?.phone || ''}${company?.email ? '  |  ' + company.email : ''}`, LEFT_MARGIN, 68);

  doc.fontSize(16).font('Helvetica-Bold')
     .text(title.toUpperCase(), LEFT_MARGIN, 22, { align: 'right', width: RIGHT_MARGIN - LEFT_MARGIN });

  doc.fillColor(DARK);
};

const addFooter = (doc, title) => {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 45;
    doc.rect(0, footerY, PAGE_WIDTH, 45).fill(BRAND);
    doc.fontSize(8).font('Helvetica').fillColor('#ffffff')
       .text(`${title}  |  Generated on ${fmtDate(new Date())}`, LEFT_MARGIN, footerY + 14, { align: 'left', width: 350 })
       .text(`Page ${i + 1} of ${pages.count}`, 350 + LEFT_MARGIN, footerY + 14, { align: 'right', width: RIGHT_MARGIN - LEFT_MARGIN - 350 });
  }
};

const generateTrialBalancePdf = async (company, payload) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: LEFT_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addHeader(doc, 'TRIAL BALANCE', company);

    let y = 105;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('PERIOD', LEFT_MARGIN, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('FINANCIAL YEAR', 320, y);

    y += 13;
    doc.fontSize(9.5).font('Helvetica').fillColor(DARK);
    const fromStr = payload.period.from ? fmtDate(payload.period.from) : 'Start';
    const toStr = payload.period.to ? fmtDate(payload.period.to) : 'End';
    doc.text(`${fromStr} to ${toStr}`, LEFT_MARGIN, y);
    doc.text(payload.financialYear?.label || '—', 320, y);

    y += 20;
    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(LINE).lineWidth(1).stroke();

    y += 12;
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 40).fill(ACCENT);
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
    doc.text('TOTAL DEBITS', LEFT_MARGIN + 50, y + 8, { width: 180, align: 'center' });
    doc.text('TOTAL CREDITS', LEFT_MARGIN + 280, y + 8, { width: 180, align: 'center' });

    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND);
    doc.text(fmt(payload.totals.debit), LEFT_MARGIN + 50, y + 20, { width: 180, align: 'center' });
    doc.text(fmt(payload.totals.credit), LEFT_MARGIN + 280, y + 20, { width: 180, align: 'center' });

    y += 55;

    // Table Header
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill('#f3f4f6');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BRAND);
    doc.text('Code', LEFT_MARGIN + 5, y + 5);
    doc.text('Account Name', LEFT_MARGIN + 80, y + 5, { width: 200 });
    doc.text('Debit', LEFT_MARGIN + 300, y + 5, { width: 100, align: 'right' });
    doc.text('Credit', LEFT_MARGIN + 410, y + 5, { width: 100, align: 'right' });

    y += 22;

    (payload.accounts || []).forEach((acc, idx) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
        doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill('#f3f4f6');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BRAND);
        doc.text('Code', LEFT_MARGIN + 5, y + 5);
        doc.text('Account Name', LEFT_MARGIN + 80, y + 5, { width: 200 });
        doc.text('Debit', LEFT_MARGIN + 300, y + 5, { width: 100, align: 'right' });
        doc.text('Credit', LEFT_MARGIN + 410, y + 5, { width: 100, align: 'right' });
        y += 22;
      }

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 22).fill(rowBg);

      doc.fontSize(8).font('Helvetica').fillColor(DARK);
      doc.text(acc.code, LEFT_MARGIN + 5, y + 6);
      doc.text(acc.name, LEFT_MARGIN + 80, y + 6, { width: 200, ellipsis: true });
      doc.text(acc.debit > 0 ? fmt(acc.debit).replace('Rs. ', '') : '—', LEFT_MARGIN + 300, y + 6, { width: 100, align: 'right' });
      doc.text(acc.credit > 0 ? fmt(acc.credit).replace('Rs. ', '') : '—', LEFT_MARGIN + 410, y + 6, { width: 100, align: 'right' });

      y += 22;
    });

    addFooter(doc, 'Trial Balance');
    doc.end();
  });
};

const generateProfitLossPdf = async (company, payload) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: LEFT_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addHeader(doc, 'PROFIT & LOSS STATEMENT', company);

    let y = 105;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('PERIOD', LEFT_MARGIN, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('FINANCIAL YEAR', 320, y);

    y += 13;
    doc.fontSize(9.5).font('Helvetica').fillColor(DARK);
    const fromStr = payload.period.from ? fmtDate(payload.period.from) : 'Start';
    const toStr = payload.period.to ? fmtDate(payload.period.to) : 'End';
    doc.text(`${fromStr} to ${toStr}`, LEFT_MARGIN, y);
    doc.text(payload.financialYear?.label || '—', 320, y);

    y += 20;
    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(LINE).lineWidth(1).stroke();

    y += 12;
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 40).fill(ACCENT);
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
    doc.text('TOTAL REVENUE', LEFT_MARGIN + 20, y + 8, { width: 140, align: 'center' });
    doc.text('TOTAL EXPENSES', LEFT_MARGIN + 180, y + 8, { width: 140, align: 'center' });
    doc.text('NET PROFIT / LOSS', LEFT_MARGIN + 340, y + 8, { width: 160, align: 'center' });

    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND);
    doc.text(fmt(payload.totalIncome), LEFT_MARGIN + 20, y + 20, { width: 140, align: 'center' });
    doc.text(fmt(payload.totalExpenses), LEFT_MARGIN + 180, y + 20, { width: 140, align: 'center' });
    doc.text(fmt(payload.netProfit), LEFT_MARGIN + 340, y + 20, { width: 160, align: 'center' });

    y += 55;

    (payload.lines || []).forEach((group) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND).text(group.group, LEFT_MARGIN, y);
      y += 15;

      doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 18).fill('#f3f4f6');
      doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
      doc.text('Account Name', LEFT_MARGIN + 10, y + 4);
      doc.text('Amount', LEFT_MARGIN + 400, y + 4, { width: 100, align: 'right' });
      y += 20;

      group.accounts.forEach((acc, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill(rowBg);

        doc.fontSize(8.5).font('Helvetica').fillColor(DARK);
        doc.text(acc.name, LEFT_MARGIN + 10, y + 5);
        doc.text(fmt(acc.amount).replace('Rs. ', ''), LEFT_MARGIN + 400, y + 5, { width: 100, align: 'right' });
        y += 20;
      });

      y += 15;
    });

    addFooter(doc, 'Profit & Loss Statement');
    doc.end();
  });
};

const generateBalanceSheetPdf = async (company, payload) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: LEFT_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addHeader(doc, 'BALANCE SHEET', company);

    let y = 105;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('AS OF DATE', LEFT_MARGIN, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('FINANCIAL YEAR', 320, y);

    y += 13;
    doc.fontSize(9.5).font('Helvetica').fillColor(DARK);
    doc.text(payload.asOfDate ? fmtDate(payload.asOfDate) : 'Present', LEFT_MARGIN, y);
    doc.text(payload.financialYear?.label || '—', 320, y);

    y += 20;
    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(LINE).lineWidth(1).stroke();

    y += 12;
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 40).fill(ACCENT);
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
    doc.text('TOTAL ASSETS', LEFT_MARGIN + 20, y + 8, { width: 140, align: 'center' });
    doc.text('TOTAL LIABILITIES', LEFT_MARGIN + 180, y + 8, { width: 140, align: 'center' });
    doc.text('TOTAL EQUITY', LEFT_MARGIN + 340, y + 8, { width: 160, align: 'center' });

    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND);
    doc.text(fmt(payload.totals.assets), LEFT_MARGIN + 20, y + 20, { width: 140, align: 'center' });
    doc.text(fmt(payload.totals.liabilities), LEFT_MARGIN + 180, y + 20, { width: 140, align: 'center' });
    doc.text(fmt(payload.totals.equity), LEFT_MARGIN + 340, y + 20, { width: 160, align: 'center' });

    y += 55;

    const sections = [
      { name: 'ASSETS', data: payload.assets },
      { name: 'LIABILITIES', data: payload.liabilities },
      { name: 'EQUITY', data: payload.equity }
    ];

    sections.forEach((sec) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND).text(sec.name, LEFT_MARGIN, y);
      y += 15;

      doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 18).fill('#f3f4f6');
      doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
      doc.text('Code', LEFT_MARGIN + 10, y + 4);
      doc.text('Account Name', LEFT_MARGIN + 80, y + 4);
      doc.text('Balance', LEFT_MARGIN + 400, y + 4, { width: 100, align: 'right' });
      y += 20;

      if (!sec.data || sec.data.length === 0) {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(LIGHT).text('No records', LEFT_MARGIN + 10, y + 5);
        y += 20;
      } else {
        sec.data.forEach((acc, idx) => {
          if (y > 720) {
            doc.addPage();
            y = 50;
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
          doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill(rowBg);

          doc.fontSize(8.5).font('Helvetica').fillColor(DARK);
          doc.text(acc.code || '—', LEFT_MARGIN + 10, y + 5);
          doc.text(acc.name, LEFT_MARGIN + 80, y + 5, { width: 300, ellipsis: true });
          doc.text(fmt(acc.balance).replace('Rs. ', ''), LEFT_MARGIN + 400, y + 5, { width: 100, align: 'right' });
          y += 20;
        });
      }

      y += 15;
    });

    addFooter(doc, 'Balance Sheet');
    doc.end();
  });
};

const generateGstReportPdf = async (company, payload) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: LEFT_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addHeader(doc, 'GST PAYABLE SUMMARY', company);

    let y = 105;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(LIGHT).text('PERIOD', LEFT_MARGIN, y);

    y += 13;
    doc.fontSize(9.5).font('Helvetica').fillColor(DARK);
    const fromStr = payload.period.from ? fmtDate(payload.period.from) : 'Start';
    const toStr = payload.period.to ? fmtDate(payload.period.to) : 'End';
    doc.text(`${fromStr} to ${toStr}`, LEFT_MARGIN, y);

    y += 20;
    doc.moveTo(LEFT_MARGIN, y).lineTo(RIGHT_MARGIN, y).strokeColor(LINE).lineWidth(1).stroke();

    y += 12;
    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 40).fill(ACCENT);
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LIGHT);
    doc.text('OUTPUT TAX (LTD)', LEFT_MARGIN + 20, y + 8, { width: 140, align: 'center' });
    doc.text('INPUT TAX (LTD)', LEFT_MARGIN + 180, y + 8, { width: 140, align: 'center' });
    doc.text('NET GST PAYABLE', LEFT_MARGIN + 340, y + 8, { width: 160, align: 'center' });

    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND);
    doc.text(fmt(payload.summary.outputTax), LEFT_MARGIN + 20, y + 20, { width: 140, align: 'center' });
    doc.text(fmt(payload.summary.inputTax), LEFT_MARGIN + 180, y + 20, { width: 140, align: 'center' });
    doc.text(fmt(payload.summary.netPayable), LEFT_MARGIN + 340, y + 20, { width: 160, align: 'center' });

    y += 55;

    doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill('#f3f4f6');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BRAND);
    doc.text('Tax Rate', LEFT_MARGIN + 10, y + 5);
    doc.text('Category', LEFT_MARGIN + 100, y + 5);
    doc.text('Output Tax', LEFT_MARGIN + 220, y + 5, { width: 90, align: 'right' });
    doc.text('Input Tax', LEFT_MARGIN + 320, y + 5, { width: 90, align: 'right' });
    doc.text('Net Tax', LEFT_MARGIN + 420, y + 5, { width: 90, align: 'right' });
    y += 22;

    if (!payload.details || payload.details.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(LIGHT).text('No records found for the selected period.', LEFT_MARGIN + 10, y + 5);
    } else {
      payload.details.forEach((item, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
          doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 20).fill('#f3f4f6');
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BRAND);
          doc.text('Tax Rate', LEFT_MARGIN + 10, y + 5);
          doc.text('Category', LEFT_MARGIN + 100, y + 5);
          doc.text('Output Tax', LEFT_MARGIN + 220, y + 5, { width: 90, align: 'right' });
          doc.text('Input Tax', LEFT_MARGIN + 320, y + 5, { width: 90, align: 'right' });
          doc.text('Net Tax', LEFT_MARGIN + 420, y + 5, { width: 90, align: 'right' });
          y += 22;
        }

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(LEFT_MARGIN, y, RIGHT_MARGIN - LEFT_MARGIN, 22).fill(rowBg);

        doc.fontSize(8.5).font('Helvetica').fillColor(DARK);
        doc.text(item.taxName || `GST ${item.ratePercent}%`, LEFT_MARGIN + 10, y + 6);
        doc.text(item.gstType || 'GST', LEFT_MARGIN + 100, y + 6);
        doc.text(fmt(item.outputTax).replace('Rs. ', ''), LEFT_MARGIN + 220, y + 6, { width: 90, align: 'right' });
        doc.text(fmt(item.inputTax).replace('Rs. ', ''), LEFT_MARGIN + 320, y + 6, { width: 90, align: 'right' });
        doc.font('Helvetica-Bold').text(fmt(item.net).replace('Rs. ', ''), LEFT_MARGIN + 420, y + 6, { width: 90, align: 'right' });

        y += 22;
      });
    }

    addFooter(doc, 'GST Payable Report');
    doc.end();
  });
};

module.exports = {
  generateTrialBalancePdf,
  generateProfitLossPdf,
  generateBalanceSheetPdf,
  generateGstReportPdf
};
