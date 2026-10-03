const PDFDocument = require("pdfkit");

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return "₹ " + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const amount = Math.floor(num);
  const words = inWords(amount);
  return words ? words.trim() + " Rupees Only" : "Zero Rupees Only";
};

const renderPayslipHtml = (payslip, employeeData = {}, companyData = {}) => {
  const monthName = monthNames[(payslip.month || 1) - 1] || "Month";
  const yearStr = payslip.year || new Date().getFullYear();
  const companyName = companyData.name || companyData.companyName || "KEVALON TECHNOLOGY";
  const companyAddress = companyData.address || "Solaris Business Hub, Ahmedabad, Gujarat, India";
  const companyPhone = companyData.phone || "+91 78620 24638";
  const companyEmail = companyData.email || "hr@kevalontechnology.in";

  const empName = employeeData.name || (employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName || ''}`.trim() : "Employee");
  const empCode = employeeData.employeeCode || employeeData.employeeID || "EMP-" + (payslip.userId ? payslip.userId.toString().substring(18) : "001");
  const designation = employeeData.designation || employeeData.role || "Software Engineer";
  const department = employeeData.department || "Engineering";
  const joiningDate = employeeData.joiningDate || employeeData.dateOfJoining ? new Date(employeeData.joiningDate || employeeData.dateOfJoining).toLocaleDateString("en-IN") : "N/A";
  const pan = employeeData.pan || employeeData.panNumber || "N/A";

  const basic = payslip.basicSalary || 0;
  const hra = payslip.hra || 0;
  const allowance = payslip.allowance || 0;
  const fixedBonus = payslip.fixedBonus || 0;
  const extraBonus = payslip.extraBonus || 0;
  const gross = payslip.grossSalary || (basic + hra + allowance + fixedBonus + extraBonus);

  const fixedDeduction = payslip.fixedDeduction || 0;
  const extraDeduction = payslip.extraDeduction || 0;
  const tdsAmount = payslip.tdsAmount || 0;
  const totalDeduction = payslip.totalDeduction || (fixedDeduction + extraDeduction + tdsAmount);

  const netSalary = payslip.netSalary || (gross - totalDeduction);
  const netSalaryWords = numberToWords(netSalary);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${empName} - ${monthName} ${yearStr}</title>
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

    .payslip-card {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb;
    }

    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .company-title { font-size: 24px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
    .company-sub { font-size: 13px; color: #4b5563; margin-top: 4px; line-height: 1.4; }
    .payslip-badge { text-align: right; }
    .payslip-badge h2 { font-size: 18px; color: #1e3a8a; text-transform: uppercase; }
    .payslip-badge p { font-size: 13px; color: #6b7280; font-weight: 600; margin-top: 2px; }

    .divider { height: 2px; background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%); margin-bottom: 25px; border-radius: 2px; }

    .emp-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px 30px;
      background: #f8fafc;
      padding: 18px 20px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 25px;
    }
    .info-item { font-size: 13px; display: flex; justify-content: space-between; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-val { color: #0f172a; font-weight: 600; }

    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      border: 1px solid #cbd5e1;
    }
    .breakdown-table th {
      background: #1e293b;
      color: #ffffff;
      font-size: 13px;
      text-transform: uppercase;
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
    }
    .breakdown-table td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid #e2e8f0;
    }
    .text-right { text-align: right !important; }
    .amount-col { font-weight: 600; color: #0f172a; }
    
    .total-row td {
      background: #f1f5f9;
      font-weight: 700 !important;
      font-size: 14px !important;
      border-top: 2px solid #cbd5e1;
      border-bottom: none;
    }

    .net-salary-banner {
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      padding: 16px 20px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    .net-salary-label { font-size: 14px; font-weight: 600; color: #1e40af; }
    .net-salary-val { font-size: 22px; font-weight: 800; color: #1e3a8a; }
    .words-val { font-size: 12px; color: #475569; margin-top: 4px; font-style: italic; }

    .signatures-table { width: 100%; border-collapse: collapse; margin-top: 50px; }
    .sig-box { text-align: center; width: 45%; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-bottom: 8px; }
    .sig-label { font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; }

    .footer-note { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px; }

    @media print {
      body { background: #ffffff; padding: 0; }
      .action-bar { display: none !important; }
      .payslip-card { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>

  <div class="action-bar">
    <div>
      <strong style="color: #1f2937;">Salary Slip Document</strong>
      <span style="color: #6b7280; font-size: 13px; margin-left: 10px;">Ready for Print & Save as PDF</span>
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ Print / Save PDF
    </button>
  </div>

  <div class="payslip-card">
    <table class="header-table">
      <tr>
        <td>
          <div class="company-title">${companyName}</div>
          <div class="company-sub">${companyAddress}<br>Email: ${companyEmail} | Phone: ${companyPhone}</div>
        </td>
        <td class="payslip-badge">
          <h2>PAYSLIP</h2>
          <p>${monthName.toUpperCase()} ${yearStr}</p>
        </td>
      </tr>
    </table>

    <div class="divider"></div>

    <div class="emp-info-grid">
      <div class="info-item"><span class="info-label">Employee Name:</span><span class="info-val">${empName}</span></div>
      <div class="info-item"><span class="info-label">Employee Code:</span><span class="info-val">${empCode}</span></div>
      <div class="info-item"><span class="info-label">Designation:</span><span class="info-val">${designation}</span></div>
      <div class="info-item"><span class="info-label">Department:</span><span class="info-val">${department}</span></div>
      <div class="info-item"><span class="info-label">Joining Date:</span><span class="info-val">${joiningDate}</span></div>
      <div class="info-item"><span class="info-label">PAN Number:</span><span class="info-val">${pan}</span></div>
    </div>

    <table class="breakdown-table">
      <thead>
        <tr>
          <th style="width: 50%;">Earnings</th>
          <th class="text-right" style="width: 50%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Basic Salary</td><td class="text-right amount-col">${formatCurrency(basic)}</td></tr>
        <tr><td>House Rent Allowance (HRA)</td><td class="text-right amount-col">${formatCurrency(hra)}</td></tr>
        <tr><td>Special Allowance</td><td class="text-right amount-col">${formatCurrency(allowance)}</td></tr>
        ${fixedBonus > 0 ? `<tr><td>Fixed Bonus / Incentive</td><td class="text-right amount-col">${formatCurrency(fixedBonus)}</td></tr>` : ''}
        ${extraBonus > 0 ? `<tr><td>Extra Bonus / Performance</td><td class="text-right amount-col">${formatCurrency(extraBonus)}</td></tr>` : ''}
        <tr class="total-row">
          <td>Gross Earnings (A)</td>
          <td class="text-right amount-col">${formatCurrency(gross)}</td>
        </tr>
      </tbody>
    </table>

    <table class="breakdown-table">
      <thead>
        <tr>
          <th style="width: 50%;">Deductions</th>
          <th class="text-right" style="width: 50%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Fixed Deductions</td><td class="text-right amount-col">${formatCurrency(fixedDeduction)}</td></tr>
        ${extraDeduction > 0 ? `<tr><td>Extra Deductions</td><td class="text-right amount-col">${formatCurrency(extraDeduction)}</td></tr>` : ''}
        <tr><td>TDS / Income Tax (${payslip.tdsPercentage || 0}%)</td><td class="text-right amount-col">${formatCurrency(tdsAmount)}</td></tr>
        <tr class="total-row">
          <td>Total Deductions (B)</td>
          <td class="text-right amount-col">${formatCurrency(totalDeduction)}</td>
        </tr>
      </tbody>
    </table>

    <div class="net-salary-banner">
      <div>
        <div class="net-salary-label">NET SALARY PAYABLE (A - B)</div>
        <div class="words-val">Amount in words: ${netSalaryWords}</div>
      </div>
      <div class="net-salary-val">${formatCurrency(netSalary)}</div>
    </div>

    <table class="signatures-table">
      <tr>
        <td class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Employee Signature</div>
        </td>
        <td style="width: 10%;"></td>
        <td class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Authorized Signatory (${companyName})</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      This is a computer-generated salary slip and does not require a physical seal if signed digitally.
    </div>
  </div>

</body>
</html>`;
};

const renderPayslipPdf = (res, payslip, employeeData = {}, companyData = {}) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  const filename = `Payslip_${payslip.month}_${payslip.year}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  doc.pipe(res);

  const companyName = companyData.name || companyData.companyName || "KEVALON TECHNOLOGY";
  const empName = employeeData.name || (employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName || ''}`.trim() : "Employee");
  const monthName = monthNames[(payslip.month || 1) - 1] || "Month";

  doc.fontSize(18).fillColor("#1e3a8a").text(companyName.toUpperCase(), { align: "left" });
  doc.fontSize(10).fillColor("#4b5563").text("Solaris Business Hub, Ahmedabad, Gujarat", { align: "left" });
  doc.moveDown();

  doc.fontSize(14).fillColor("#1e293b").text(`PAYSLIP FOR ${monthName.toUpperCase()} ${payslip.year}`, { align: "center" });
  doc.moveDown();

  doc.fontSize(11).fillColor("#0f172a");
  doc.text(`Employee Name: ${empName}`);
  doc.text(`Net Salary Payable: INR ${payslip.netSalary || 0}`);
  doc.text(`Gross Earnings: INR ${payslip.grossSalary || 0}`);
  doc.text(`Total Deductions: INR ${payslip.totalDeduction || 0}`);

  doc.end();
};

module.exports = {
  renderPayslipHtml,
  renderPayslipPdf,
  numberToWords,
  formatCurrency
};
