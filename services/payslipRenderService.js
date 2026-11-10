const PDFDocument = require("pdfkit");

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return "Rs. " + amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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
    const nArray = ("000000000" + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArray) return "";
    let str = "";
    str += nArray[1] != 0 ? (a[Number(nArray[1])] || b[nArray[1][0]] + " " + a[nArray[1][1]]) + "Crore " : "";
    str += nArray[2] != 0 ? (a[Number(nArray[2])] || b[nArray[2][0]] + " " + a[nArray[2][1]]) + "Lakh " : "";
    str += nArray[3] != 0 ? (a[Number(nArray[3])] || b[nArray[3][0]] + " " + a[nArray[3][1]]) + "Thousand " : "";
    str += nArray[4] != 0 ? (a[Number(nArray[4])] || b[nArray[4][0]] + " " + a[nArray[4][1]]) + "Hundred " : "";
    str += nArray[5] != 0 ? (str != "" ? "and " : "") + (a[Number(nArray[5])] || b[nArray[5][0]] + " " + a[nArray[5][1]]) : "";
    return str;
  };

  const words = inWords(Math.floor(num));
  return words ? words.trim() + " Rupees Only" : "Zero Rupees Only";
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const firstValue = (...values) => values.find(hasValue);

const displayValue = (value) => {
  if (!value || typeof value !== "object") return value;
  return firstValue(
    value.designationName,
    value.departmentName,
    value.name,
    value.title,
    value.displayName
  );
};

const positiveAmount = (value) =>
  hasValue(value) && Number.isFinite(Number(value)) && Number(value) > 0;

const formatDate = (value) => {
  if (!hasValue(value)) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const buildPayslipData = (payslip, employeeData, companyData) => {
  const monthName = monthNames[Number(payslip.month) - 1] || "";
  const year = hasValue(payslip.year) ? String(payslip.year) : "";
  const companyName = firstValue(companyData.name, companyData.companyName, "KEVALON TECHNOLOGY");
  const employeeName = firstValue(
    employeeData.name,
    [employeeData.firstName, employeeData.lastName].filter(hasValue).join(" ")
  );
  const employeeCode = firstValue(
    employeeData.employeeCode,
    employeeData.uniqueID,
    employeeData.employeeID
  );

  const earnings = [
    { label: "Basic Salary", value: payslip.basicSalary },
    { label: "HRA", value: payslip.hra },
    { label: "Conveyance Allowance", value: payslip.conveyanceAllowance },
    { label: "Medical Allowance", value: payslip.medicalAllowance },
    { label: "Special Allowance", value: firstValue(payslip.specialAllowance, payslip.allowance) },
    { label: "Dearness Allowance", value: payslip.dearnessAllowance },
    { label: "Other Allowance", value: payslip.otherAllowances }
  ].filter((item) => positiveAmount(item.value));

  if (earnings.length === 0 && positiveAmount(firstValue(payslip.monthlySalary, payslip.fixedSalary, payslip.grossSalary))) {
    earnings.push({
      label: "Salary",
      value: firstValue(payslip.monthlySalary, payslip.fixedSalary, payslip.grossSalary)
    });
  }

  const extras = [
    { label: "Extra Allowance", value: payslip.extraAllowance },
    { label: "Overtime", value: payslip.overtime },
    { label: "Bonus", value: firstValue(payslip.fixedBonus, payslip.extraBonus, payslip.bonus) },
    { label: "Incentive", value: payslip.incentive },
    { label: "Arrears", value: payslip.arrears }
  ].filter((item) => positiveAmount(item.value));
  if (extras.length === 0 && positiveAmount(payslip.extraEarnings)) {
    extras.push({ label: "Other Extra", value: payslip.extraEarnings });
  }

  const totalSalary = earnings.reduce((sum, item) => sum + Number(item.value), 0);
  const totalExtra = extras.reduce((sum, item) => sum + Number(item.value), 0);

  const unpaidLeaveDeduction = firstValue(payslip.unpaidLeaveDeduction, payslip.lopDeduction);
  const pf = payslip.pfDeduction;
  const esic = payslip.esicDeduction;
  const professionalTax = payslip.professionalTax;
  const tds = firstValue(payslip.tdsAmount, payslip.tds);
  const deductions = [
    {
      label: positiveAmount(unpaidLeaveDeduction) && positiveAmount(payslip.unpaidLeaveDays)
        ? `Leave Deduction (${payslip.unpaidLeaveDays} Days)`
        : "Leave Deduction",
      value: unpaidLeaveDeduction
    },
    { label: "Late / Absence Deduction", value: payslip.unauthorizedAbsenceDeduction },
    { label: "Advance Adjustment", value: payslip.advanceDeduction },
    { label: "PF / ESI / TDS", value: null },
    { label: "PF", value: pf },
    { label: "ESIC", value: esic },
    { label: "Professional Tax", value: professionalTax },
    { label: "TDS / Income Tax", value: tds },
    { label: "Other Deduction", value: payslip.otherDeductions },
    { label: "Fixed Deduction", value: payslip.fixedDeduction },
    { label: "Extra Deduction", value: payslip.extraDeduction },
    { label: "Approved Penalty", value: payslip.legallyApprovedPenalties || payslip.appliedPenalty }
  ].filter((item) => positiveAmount(item.value));

  const customDeductions = Array.isArray(payslip.customDeductionsList)
    ? payslip.customDeductionsList
    : Array.isArray(payslip.employeeDeductions)
      ? payslip.employeeDeductions
      : [];
  customDeductions.forEach((deduction) => {
    if (positiveAmount(deduction.amount)) {
      deductions.push({
        label: firstValue(deduction.name, deduction.code, deduction.deductionMasterId?.name, "Employee Deduction"),
        value: deduction.amount
      });
    }
  });

  const totalDeduction = positiveAmount(payslip.totalDeduction)
    ? Number(payslip.totalDeduction)
    : deductions.reduce((sum, item) => sum + Number(item.value), 0);
  const netSalary = positiveAmount(payslip.netSalary)
    ? Number(payslip.netSalary)
    : Math.max(0, totalSalary + totalExtra - totalDeduction);

  const infoFields = [
    ["Employee Name", employeeName],
    ["Employee ID", employeeCode],
    ["Department", displayValue(employeeData.department)],
    ["Designation", displayValue(employeeData.designation || employeeData.role)],
    ["Month & Year", [monthName, year].filter(Boolean).join(" ")],
    ["Voucher No.", firstValue(payslip.voucherNumber, payslip.payslipNumber, payslip.slipNumber)],
    ["Date", formatDate(payslip.paidAt || payslip.createdAt)],
    ["Email", employeeData.email],
    ["Status", payslip.status]
  ].filter(([, value]) => hasValue(value));

  const paymentFields = [
    ["Payment Mode", payslip.paymentMode],
    ["Bank Name", firstValue(payslip.bankName, employeeData.bankName)],
    ["Payment Reference / UTR", firstValue(payslip.utrNumber, payslip.transactionReference, payslip.paymentReference)],
    ["Payment Date", formatDate(payslip.paidAt)],
    ["Remarks", payslip.remarks]
  ].filter(([, value]) => hasValue(value));

  return {
    companyName,
    monthName,
    year,
    employeeName,
    employeeCode,
    infoFields,
    paymentFields,
    earnings,
    deductions,
    extras,
    totalSalary,
    totalDeduction,
    totalExtra,
    netSalary
  };
};

const renderPayslipHtml = (payslip, employeeData = {}, companyData = {}) => {
  const data = buildPayslipData(payslip, employeeData, companyData);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
  const rows = (items, totalLabel, totalValue) => {
    const itemRows = items.map((item) =>
      `<tr><td>${escapeHtml(item.label)}</td><td class="amount">${escapeHtml(formatCurrency(item.value))}</td></tr>`
    ).join("");
    const totalRow = positiveAmount(totalValue)
      ? `<tr class="total"><td>${escapeHtml(totalLabel)}</td><td class="amount">${escapeHtml(formatCurrency(totalValue))}</td></tr>`
      : "";
    return `${itemRows}${totalRow}`;
  };
  const info = data.infoFields
    .map(([label, value]) => `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  const paymentInfo = data.paymentFields.length
    ? `<section class="payment"><h2>D. PAYMENT DETAILS</h2><div class="info-grid">${data.paymentFields.map(([label, value]) => `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div></section>`
    : "";
  const panels = [
    { className: "salary", title: "A. SALARY DETAILS", items: data.earnings, totalLabel: "TOTAL SALARY (A)", total: data.totalSalary },
    { className: "deduction", title: "B. DEDUCTION DETAILS", items: data.deductions, totalLabel: "TOTAL DEDUCTION (B)", total: data.totalDeduction },
    { className: "extra", title: "C. EXTRA / ADDITIONAL PAYMENT", items: data.extras, totalLabel: "TOTAL EXTRA (C)", total: data.totalExtra }
  ].filter((panel) => panel.items.length > 0 || positiveAmount(panel.total));
  const panelsHtml = panels.map((panel) =>
    `<div class="panel ${panel.className}"><h2>${panel.title}</h2><table><thead><tr><th>PARTICULARS</th><th>AMOUNT (₹)</th></tr></thead><tbody>${rows(panel.items, panel.totalLabel, panel.total)}</tbody></table></div>`
  ).join("");
  const title = ["Employee Salary Payment Voucher", data.monthName, data.year, data.employeeName]
    .filter(hasValue).map(escapeHtml).join(" - ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4 landscape; margin: 9mm; }
    body { margin: 0; padding: 18px; color: #17364d; background: #eaf0f6; font: 12px/1.4 Arial, Helvetica, sans-serif; }
    .voucher { max-width: 1080px; margin: auto; padding: 14px; border: 1px solid #8daabd; background: #fff; }
    .header { display: grid; grid-template-columns: 180px 1fr 180px; align-items: center; gap: 12px; }
    .brand { color: #075985; font-size: 19px; font-weight: 800; letter-spacing: .04em; }
    .brand small { display: block; color: #58788d; font-size: 9px; letter-spacing: .12em; }
    .title { padding: 9px; color: #fff; background: linear-gradient(110deg, #064c73, #0d709e); text-align: center; font-size: 18px; font-weight: 800; }
    .company { color: #075985; font-size: 13px; font-weight: 700; text-align: right; }
    .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 22px; margin: 12px 0; padding: 7px 10px; border: 1px solid #bfd4e3; background: #f0f7fc; }
    .field { display: flex; justify-content: space-between; gap: 12px; min-width: 0; padding: 4px 2px; border-bottom: 1px solid #d5e4ed; }
    .field span { color: #4a6578; }
    .field strong { color: #17364d; text-align: right; overflow-wrap: anywhere; }
    .tables { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
    .panel { overflow: hidden; border: 1px solid #9db8c9; }
    .panel h2 { margin: 0; padding: 7px 8px; color: #fff; font-size: 10px; letter-spacing: .04em; }
    .salary h2 { background: #075985; } .deduction h2 { background: #bd3154; } .extra h2 { background: #138557; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 5px 6px; background: #e8f0f6; color: #28465c; font-size: 9px; text-align: left; }
    td { padding: 5px 6px; border-top: 1px solid #dce7ee; font-size: 10px; }
    td.amount { text-align: right; white-space: nowrap; font-weight: 700; }
    .total td { background: #eff7fb; font-weight: 800; }
    .deduction .total td { background: #fff0f3; } .extra .total td { background: #effbf5; }
    .net { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 10px 14px; border: 1px solid #79a8c6; background: linear-gradient(100deg, #064c73, #eaf6ff 58%); }
    .net strong { color: #fff; font-size: 13px; } .net .amount { color: #073f62; font-size: 21px; font-weight: 900; }
    .payment { margin-top: 10px; border: 1px solid #c8d6e5; } .payment h2 { margin: 0; padding: 7px 9px; color: #273f88; background: #eef0ff; font-size: 10px; }
    .payment .info-grid { margin: 0; border: 0; }
    .digital-note { padding-top: 8px; color: #63798a; font-size: 9px; text-align: center; }
    @media (max-width: 700px) { body { padding: 7px; } .voucher { padding: 8px; } .header { grid-template-columns: 1fr; gap: 6px; } .company { text-align: left; } .tables { grid-template-columns: 1fr; } .info-grid { grid-template-columns: 1fr; } }
    @media print { body { padding: 0; background: white; } .voucher { max-width: none; padding: 0; border: 0; } .panel, .info-grid, .payment, .net { break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="voucher">
    <header class="header">
      <div class="brand">KEVALON<small>TECHNOLOGY</small></div>
      <div class="title">EMPLOYEE SALARY PAYMENT VOUCHER</div>
      <div class="company">${escapeHtml(data.companyName)}</div>
    </header>
    ${info ? `<section class="info-grid">${info}</section>` : ""}
    ${panelsHtml ? `<section class="tables">${panelsHtml}</section>` : ""}
    ${positiveAmount(data.netSalary) ? `<section class="net"><strong>NET PAYABLE AMOUNT</strong><span class="amount">${escapeHtml(formatCurrency(data.netSalary))}</span></section>` : ""}
    ${paymentInfo}
    <footer class="digital-note">This is a digitally generated salary slip. No signature is required.</footer>
  </main>
</body>
</html>`;
};

const renderPayslipPdf = (res, payslip, employeeData = {}, companyData = {}) => {
  const data = buildPayslipData(payslip, employeeData, companyData);
  const doc = new PDFDocument({ margin: 32, size: "A4", layout: "landscape" });
  const monthName = data.monthName || "Payslip";
  const filename = `Payslip_${monthName}_${data.year || ""}_${data.employeeCode || "Employee"}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  doc.pipe(res);

  const left = 32;
  const pageWidth = 778;
  const navy = "#075985";
  const border = "#b8cbd8";
  const printableText = (value) => String(value ?? "").replace(/[^\x20-\x7E]/g, " ");

  doc.rect(left, 28, 120, 35).fill("#e8f4fb");
  doc.fontSize(17).fillColor(navy).font("Helvetica-Bold").text("KEVALON", left + 9, 33);
  doc.fontSize(7).fillColor("#56758a").font("Helvetica").text("TECHNOLOGY", left + 10, 52);
  doc.rect(left + 130, 28, 430, 35).fill(navy);
  doc.fontSize(16).fillColor("#ffffff").font("Helvetica-Bold").text("EMPLOYEE SALARY PAYMENT VOUCHER", left + 140, 38, {
    width: 410,
    align: "center"
  });
  doc.fontSize(11).fillColor(navy).font("Helvetica-Bold").text(printableText(data.companyName), left + 575, 40, {
    width: 200,
    align: "right"
  });

  let y = 72;
  if (data.infoFields.length) {
    const fieldRows = Math.ceil(data.infoFields.length / 2);
    const boxHeight = fieldRows * 18 + 10;
    doc.rect(left, y, pageWidth, boxHeight).fillAndStroke("#f1f8fd", border);
    data.infoFields.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = left + 10 + column * 380;
      const fieldY = y + 7 + row * 18;
      doc.fontSize(8).fillColor("#496579").font("Helvetica").text(`${printableText(label)}:`, x, fieldY, { width: 100 });
      doc.fontSize(8).fillColor("#17364d").font("Helvetica-Bold").text(printableText(value), x + 105, fieldY, { width: 260 });
    });
    y += boxHeight + 10;
  }

  const gap = 9;
  const panels = [
    { title: "A. SALARY DETAILS", color: navy, items: data.earnings, totalLabel: "TOTAL SALARY (A)", total: data.totalSalary },
    { title: "B. DEDUCTION DETAILS", color: "#bd3154", items: data.deductions, totalLabel: "TOTAL DEDUCTION (B)", total: data.totalDeduction },
    { title: "C. EXTRA / ADDITIONAL PAYMENT", color: "#138557", items: data.extras, totalLabel: "TOTAL EXTRA (C)", total: data.totalExtra }
  ].filter((panel) => panel.items.length > 0 || positiveAmount(panel.total));
  const panelWidth = panels.length > 0 ? (pageWidth - gap * (panels.length - 1)) / panels.length : pageWidth;
  const rowHeight = 19;
  const drawPanel = (x, title, titleColor, items, totalLabel, totalValue) => {
    const titleHeight = 22;
    const bodyHeight = Math.max(24, items.length * rowHeight + (positiveAmount(totalValue) ? rowHeight : 0));
    doc.rect(x, y, panelWidth, titleHeight).fill(titleColor);
    doc.fontSize(9).fillColor("#ffffff").font("Helvetica-Bold").text(title, x + 7, y + 7, { width: panelWidth - 14 });
    doc.rect(x, y + titleHeight, panelWidth, bodyHeight).fillAndStroke("#ffffff", border);
    items.forEach((item, index) => {
      const rowY = y + titleHeight + index * rowHeight;
      if (index % 2 === 1) doc.rect(x + 1, rowY, panelWidth - 2, rowHeight).fill("#f5f9fc");
      doc.moveTo(x, rowY + rowHeight).lineTo(x + panelWidth, rowY + rowHeight).lineWidth(0.5).strokeColor("#dce7ee").stroke();
      doc.fontSize(7.5).fillColor("#17364d").font("Helvetica").text(printableText(item.label), x + 6, rowY + 5, {
        width: panelWidth - 64,
        height: rowHeight - 4,
        ellipsis: true
      });
      doc.fontSize(7.5).fillColor("#17364d").font("Helvetica-Bold").text(formatCurrency(item.value), x + panelWidth - 58, rowY + 5, {
        width: 52,
        align: "right"
      });
    });
    if (positiveAmount(totalValue)) {
      const totalY = y + titleHeight + items.length * rowHeight;
      doc.rect(x + 1, totalY, panelWidth - 2, rowHeight - 1).fill("#eaf3f8");
      doc.fontSize(7.5).fillColor(navy).font("Helvetica-Bold").text(totalLabel, x + 6, totalY + 5, { width: panelWidth - 64 });
      doc.fontSize(7.5).fillColor(navy).font("Helvetica-Bold").text(formatCurrency(totalValue), x + panelWidth - 58, totalY + 5, {
        width: 52,
        align: "right"
      });
    }
    return titleHeight + bodyHeight;
  };

  const heights = panels.map((panel, index) =>
    drawPanel(
      left + index * (panelWidth + gap),
      panel.title,
      panel.color,
      panel.items,
      panel.totalLabel,
      panel.total
    )
  );
  if (heights.length) y += Math.max(...heights) + 10;

  if (positiveAmount(data.netSalary)) {
    doc.rect(left, y, pageWidth, 48).fillAndStroke("#e8f4fb", "#78a8c7");
    doc.rect(left, y, 220, 48).fill(navy);
    doc.fontSize(12).fillColor("#ffffff").font("Helvetica-Bold").text("NET PAYABLE AMOUNT", left + 14, y + 17, { width: 195 });
    doc.fontSize(19).fillColor(navy).font("Helvetica-Bold").text(formatCurrency(data.netSalary), left + 235, y + 13, {
      width: pageWidth - 250,
      align: "right"
    });
    doc.fontSize(8).fillColor("#496579").font("Helvetica").text(`Amount in words: ${numberToWords(data.netSalary)}`, left + 235, y + 34, {
      width: pageWidth - 250
    });
    y += 58;
  }

  if (data.paymentFields.length) {
    const paymentHeight = Math.ceil(data.paymentFields.length / 2) * 18 + 24;
    doc.rect(left, y, pageWidth, 18).fill("#eef0ff");
    doc.fontSize(9).fillColor("#273f88").font("Helvetica-Bold").text("D. PAYMENT DETAILS", left + 8, y + 5);
    doc.rect(left, y + 18, pageWidth, paymentHeight - 18).fillAndStroke("#ffffff", border);
    data.paymentFields.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = left + 10 + column * 380;
      const fieldY = y + 25 + row * 18;
      doc.fontSize(8).fillColor("#496579").font("Helvetica").text(`${printableText(label)}:`, x, fieldY, { width: 130 });
      doc.fontSize(8).fillColor("#17364d").font("Helvetica-Bold").text(printableText(value), x + 135, fieldY, { width: 230 });
    });
    y += paymentHeight + 8;
  }

  doc.fontSize(8).fillColor("#607789").font("Helvetica").text(
    "This is a digitally generated salary slip. No signature is required.",
    left,
    Math.min(y, 555),
    { align: "center", width: pageWidth }
  );
  doc.end();
};

module.exports = {
  renderPayslipHtml,
  renderPayslipPdf,
  numberToWords,
  formatCurrency
};
