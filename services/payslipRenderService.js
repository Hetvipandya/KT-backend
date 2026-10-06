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
  const empCode = employeeData.employeeCode || employeeData.uniqueID || employeeData.employeeID || "EMP-" + (payslip.userId ? payslip.userId.toString().substring(18) : "001");
  const designation = employeeData.designation || employeeData.role || "Software Engineer";
  const department = employeeData.department || "Engineering";
  const joiningDate = employeeData.joiningDate || employeeData.dateOfJoining ? new Date(employeeData.joiningDate || employeeData.dateOfJoining).toLocaleDateString("en-IN") : "N/A";
  const pan = employeeData.pan || employeeData.panNumber || "N/A";

  const basic = payslip.basicSalary || 0;
  const hra = payslip.hra || 0;
  const conveyance = payslip.conveyanceAllowance || 0;
  const medical = payslip.medicalAllowance || 0;
  const special = payslip.specialAllowance || payslip.allowance || 0;
  const da = payslip.dearnessAllowance || 0;
  const otherAllowance = payslip.otherAllowances || 0;
  const fixedBonus = payslip.fixedBonus || 0;
  const extraBonus = payslip.extraBonus || 0;
  
  // Formula 1: Gross Salary
  const gross = payslip.grossSalary || (basic + hra + conveyance + medical + special + da + otherAllowance + fixedBonus + extraBonus);

  // Formula 9: Basic for PF
  const basicForPf = payslip.basicForPf || (basic + da);

  const lopDeduction = payslip.lopDeduction || 0;
  
  // Formula 2: PF Employee 12%
  const pf = payslip.pfDeduction || Math.round(basicForPf * 0.12);
  
  // Formula 4: ESI Employee 0.75%
  const esic = payslip.esicDeduction || Math.round(gross * 0.0075);
  
  // Formula 5: PT As per State Rules
  const pt = payslip.professionalTax || (gross > 12000 ? 200 : 0);
  
  const tds = payslip.tdsAmount || payslip.tds || 0;
  const fixedDeduction = payslip.fixedDeduction || 0;
  const extraDeduction = payslip.extraDeduction || 0;
  const otherDeduction = payslip.otherDeductions || 0;
  
  // Formula 6: Total Deductions
  const totalDeduction = payslip.totalDeduction || (lopDeduction + pf + esic + pt + tds + fixedDeduction + extraDeduction + otherDeduction);

  // Formula 7: Net Salary
  const netSalary = payslip.netSalary || Math.max(0, gross - totalDeduction);
  const netSalaryWords = numberToWords(netSalary);

  // Employer Contributions
  const empContrib = payslip.employerContributions || {};
  const employerPf = empContrib.pf || Math.round(basicForPf * 0.12);
  const employerEsic = empContrib.esic || Math.round(gross * 0.0325);
  const gratuity = empContrib.gratuity || 0;

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
      gap: 12px 30px;
      background: #f8fafc;
      padding: 18px 20px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 25px;
    }
    .info-item { font-size: 13px; display: flex; justify-content: space-between; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-val { color: #0f172a; font-weight: 600; }

    .tables-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }

    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
    }
    .breakdown-table th {
      background: #1e293b;
      color: #ffffff;
      font-size: 12px;
      text-transform: uppercase;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
    }
    .breakdown-table td {
      padding: 8px 12px;
      font-size: 12.5px;
      border-bottom: 1px solid #e2e8f0;
    }
    .text-right { text-align: right !important; }
    .amount-col { font-weight: 600; color: #0f172a; }
    
    .total-row td {
      background: #f1f5f9;
      font-weight: 700 !important;
      font-size: 13px !important;
      border-top: 2px solid #cbd5e1;
      border-bottom: none;
    }

    .statutory-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 15px 20px;
      margin-bottom: 25px;
      font-size: 12.5px;
    }
    .statutory-title { font-weight: 700; color: #1e3a8a; margin-bottom: 8px; text-transform: uppercase; font-size: 12px; }
    .statutory-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }

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

    .signatures-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
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
      <strong style="color: #1f2937;">HR Payroll Formula Salary Slip</strong>
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
      <div class="info-item"><span class="info-label">Total / Working Days:</span><span class="info-val">${payslip.totalDays || 30} Days / ${payslip.workingDays || payslip.totalDays || 30} Days</span></div>
      <div class="info-item"><span class="info-label">Present / Days Payable:</span><span class="info-val">${payslip.presentDays || 30} Present (${payslip.daysPayable || payslip.presentDays || 30} Payable)</span></div>
    </div>

    <div class="tables-container">
      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Earnings (Rule 1)</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Basic Salary</td><td class="text-right amount-col">${formatCurrency(basic)}</td></tr>
          <tr><td>House Rent Allowance (HRA)</td><td class="text-right amount-col">${formatCurrency(hra)}</td></tr>
          ${conveyance > 0 ? `<tr><td>Conveyance Allowance</td><td class="text-right amount-col">${formatCurrency(conveyance)}</td></tr>` : ''}
          ${medical > 0 ? `<tr><td>Medical Allowance</td><td class="text-right amount-col">${formatCurrency(medical)}</td></tr>` : ''}
          ${special > 0 ? `<tr><td>Special Allowance</td><td class="text-right amount-col">${formatCurrency(special)}</td></tr>` : ''}
          ${da > 0 ? `<tr><td>Dearness Allowance (DA)</td><td class="text-right amount-col">${formatCurrency(da)}</td></tr>` : ''}
          ${otherAllowance > 0 ? `<tr><td>Other Allowances</td><td class="text-right amount-col">${formatCurrency(otherAllowance)}</td></tr>` : ''}
          ${fixedBonus > 0 ? `<tr><td>Fixed Bonus</td><td class="text-right amount-col">${formatCurrency(fixedBonus)}</td></tr>` : ''}
          ${extraBonus > 0 ? `<tr><td>Extra Bonus</td><td class="text-right amount-col">${formatCurrency(extraBonus)}</td></tr>` : ''}
          <tr class="total-row">
            <td>Gross Earnings (A)</td>
            <td class="text-right amount-col">${formatCurrency(gross)}</td>
          </tr>
        </tbody>
      </table>

      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Deductions (Rule 6)</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lopDeduction > 0 ? `<tr><td>LOP / Absent Deduction</td><td class="text-right amount-col">${formatCurrency(lopDeduction)}</td></tr>` : ''}
          <tr><td>PF Employee (12% of Basic+DA)</td><td class="text-right amount-col">${formatCurrency(pf)}</td></tr>
          <tr><td>ESI Employee (0.75% of Gross)</td><td class="text-right amount-col">${formatCurrency(esic)}</td></tr>
          <tr><td>Professional Tax (PT)</td><td class="text-right amount-col">${formatCurrency(pt)}</td></tr>
          ${tds > 0 ? `<tr><td>TDS / Income Tax</td><td class="text-right amount-col">${formatCurrency(tds)}</td></tr>` : ''}
          ${fixedDeduction > 0 ? `<tr><td>Fixed Deductions</td><td class="text-right amount-col">${formatCurrency(fixedDeduction)}</td></tr>` : ''}
          ${extraDeduction > 0 ? `<tr><td>Extra Deductions</td><td class="text-right amount-col">${formatCurrency(extraDeduction)}</td></tr>` : ''}
          ${otherDeduction > 0 ? `<tr><td>Other Deductions</td><td class="text-right amount-col">${formatCurrency(otherDeduction)}</td></tr>` : ''}
          <tr class="total-row">
            <td>Total Deductions (B)</td>
            <td class="text-right amount-col">${formatCurrency(totalDeduction)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="statutory-box">
      <div class="statutory-title">Employer Statutory & Gratuity Info (Rules 3 & 10)</div>
      <div class="statutory-grid">
        <div><strong>Basic for PF (Basic+DA):</strong> ${formatCurrency(basicForPf)}</div>
        <div><strong>Employer PF (12%):</strong> ${formatCurrency(employerPf)}</div>
        <div><strong>Employer ESI (3.25%):</strong> ${formatCurrency(employerEsic)}</div>
        ${gratuity > 0 ? `<div><strong>Gratuity Provision:</strong> ${formatCurrency(gratuity)}</div>` : ''}
      </div>
    </div>

    <div class="net-salary-banner">
      <div>
        <div class="net-salary-label">NET SALARY PAYABLE (Gross - Total Deductions)</div>
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
      This is a computer-generated salary slip formatted according to statutory HR Payroll Formulas.
    </div>
  </div>

</body>
</html>`;
};

// =====================================================
// FULLY FORMATTED PDF GENERATOR WITH HR PAYROLL FORMULAS
// =====================================================
const renderPayslipPdf = (res, payslip, employeeData = {}, companyData = {}) => {
  const doc = new PDFDocument({ margin: 35, size: "A4" });

  const monthName = monthNames[(payslip.month || 1) - 1] || "Month";
  const yearStr = payslip.year || new Date().getFullYear();
  const empCode = employeeData.employeeCode || employeeData.uniqueID || employeeData.employeeID || "EMP-001";
  const filename = `Payslip_${monthName}_${yearStr}_${empCode}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  doc.pipe(res);

  const companyName = (companyData.name || companyData.companyName || "KEVALON TECHNOLOGY").toUpperCase();
  const companyAddress = companyData.address || "Solaris Business Hub, Ahmedabad, Gujarat, India";
  const companyEmail = companyData.email || "hr@kevalontechnology.in";
  const companyPhone = companyData.phone || "+91 78620 24638";

  const empName = employeeData.name || (employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName || ''}`.trim() : "Employee");
  const designation = employeeData.designation || employeeData.role || "Software Engineer";
  const department = employeeData.department || "Engineering";
  const joiningDate = employeeData.joiningDate || employeeData.dateOfJoining ? new Date(employeeData.joiningDate || employeeData.dateOfJoining).toLocaleDateString("en-IN") : "N/A";
  const pan = employeeData.pan || employeeData.panNumber || "N/A";

  const basic = payslip.basicSalary || 0;
  const hra = payslip.hra || 0;
  const conveyance = payslip.conveyanceAllowance || 0;
  const medical = payslip.medicalAllowance || 0;
  const special = payslip.specialAllowance || payslip.allowance || 0;
  const da = payslip.dearnessAllowance || 0;
  const otherAllowance = payslip.otherAllowances || 0;
  const fixedBonus = payslip.fixedBonus || 0;
  const extraBonus = payslip.extraBonus || 0;

  // Formula 1: Gross Salary
  const gross = payslip.grossSalary || (basic + hra + conveyance + medical + special + da + otherAllowance + fixedBonus + extraBonus);

  // Formula 9: Basic for PF
  const basicForPf = payslip.basicForPf || (basic + da);

  const lopDeduction = payslip.lopDeduction || 0;
  
  // Formula 2: PF Employee 12%
  const pf = payslip.pfDeduction || Math.round(basicForPf * 0.12);
  
  // Formula 4: ESI Employee 0.75%
  const esic = payslip.esicDeduction || Math.round(gross * 0.0075);
  
  // Formula 5: Professional Tax (PT)
  const pt = payslip.professionalTax || (gross > 12000 ? 200 : 0);
  
  const tds = payslip.tdsAmount || payslip.tds || 0;
  const fixedDeduction = payslip.fixedDeduction || 0;
  const extraDeduction = payslip.extraDeduction || 0;
  const otherDeduction = payslip.otherDeductions || 0;

  // Formula 6: Total Deductions
  const totalDeduction = payslip.totalDeduction || (lopDeduction + pf + esic + pt + tds + fixedDeduction + extraDeduction + otherDeduction);

  // Formula 7: Net Salary
  const netSalary = payslip.netSalary || Math.max(0, gross - totalDeduction);
  const netSalaryWords = numberToWords(netSalary);

  // Employer Contributions (Formula 3 & 10)
  const empContrib = payslip.employerContributions || {};
  const employerPf = empContrib.pf || Math.round(basicForPf * 0.12);
  const employerEsic = empContrib.esic || Math.round(gross * 0.0325);
  const gratuity = empContrib.gratuity || 0;

  // Palette
  const primaryColor = "#1e3a8a"; // Navy Blue
  const grayTextColor = "#475569";
  const darkTextColor = "#0f172a";
  const lightBgColor = "#f8fafc";
  const borderGray = "#cbd5e1";

  const leftX = 35;
  const width = 525;

  // 1. Header
  doc.fontSize(18).fillColor(primaryColor).font("Helvetica-Bold").text(companyName, leftX, 35);
  doc.fontSize(9).fillColor(grayTextColor).font("Helvetica").text(`${companyAddress}`, leftX, 57);
  doc.text(`Email: ${companyEmail} | Phone: ${companyPhone}`, leftX, 69);

  // Right Badge
  doc.fontSize(16).fillColor(primaryColor).font("Helvetica-Bold").text("PAYSLIP", leftX, 35, { align: "right", width: width });
  doc.fontSize(10).fillColor(grayTextColor).font("Helvetica-Bold").text(`${monthName.toUpperCase()} ${yearStr}`, leftX, 55, { align: "right", width: width });

  const statusStr = (payslip.status || "PAID").toUpperCase();
  doc.rect(leftX + width - 70, 72, 70, 16).fillAndStroke("#dbeafe", "#bfdbfe");
  doc.fontSize(8).fillColor("#1e40af").font("Helvetica-Bold").text(statusStr, leftX + width - 70, 76, { align: "center", width: 70 });

  // Accent Line
  doc.moveTo(leftX, 98).lineTo(leftX + width, 98).lineWidth(2).strokeColor(primaryColor).stroke();

  // 2. Employee Info Box
  let currentY = 108;
  const infoBoxHeight = 72;
  doc.rect(leftX, currentY, width, infoBoxHeight).fillAndStroke(lightBgColor, borderGray);

  const col1Left = leftX + 12;
  const col1ValLeft = col1Left + 90;
  const col2Left = leftX + 270;
  const col2ValLeft = col2Left + 105;

  let rowY = currentY + 10;
  doc.fontSize(8.5);

  doc.fillColor(grayTextColor).font("Helvetica").text("Employee Name:", col1Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(empName, col1ValLeft, rowY);
  doc.fillColor(grayTextColor).font("Helvetica").text("Joining Date:", col2Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(joiningDate, col2ValLeft, rowY);

  rowY += 15;
  doc.fillColor(grayTextColor).font("Helvetica").text("Employee Code:", col1Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(empCode, col1ValLeft, rowY);
  doc.fillColor(grayTextColor).font("Helvetica").text("PAN Number:", col2Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(pan, col2ValLeft, rowY);

  rowY += 15;
  doc.fillColor(grayTextColor).font("Helvetica").text("Designation:", col1Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(designation, col1ValLeft, rowY);
  doc.fillColor(grayTextColor).font("Helvetica").text("Total / Present Days:", col2Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(`${payslip.totalDays || 30} Days / ${payslip.presentDays || 30} Days`, col2ValLeft, rowY);

  rowY += 15;
  doc.fillColor(grayTextColor).font("Helvetica").text("Department:", col1Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(department, col1ValLeft, rowY);
  doc.fillColor(grayTextColor).font("Helvetica").text("Days Payable / LOP:", col2Left, rowY);
  doc.fillColor(darkTextColor).font("Helvetica-Bold").text(`${payslip.daysPayable || payslip.presentDays || 30} Days (${payslip.lopDays || 0} LOP)`, col2ValLeft, rowY);

  // 3. Tables Container
  currentY = currentY + infoBoxHeight + 15;
  const tableWidth = 255;
  const rightTableLeft = leftX + 270;

  doc.rect(leftX, currentY, tableWidth, 20).fill("#1e293b");
  doc.rect(rightTableLeft, currentY, tableWidth, 20).fill("#1e293b");

  doc.fontSize(9).fillColor("#ffffff").font("Helvetica-Bold");
  doc.text("EARNINGS (Rule 1)", leftX + 10, currentY + 5);
  doc.text("AMOUNT", leftX + 10, currentY + 5, { align: "right", width: tableWidth - 20 });

  doc.text("DEDUCTIONS (Rule 6)", rightTableLeft + 10, currentY + 5);
  doc.text("AMOUNT", rightTableLeft + 10, currentY + 5, { align: "right", width: tableWidth - 20 });

  const earningsList = [
    { label: "Basic Salary", val: basic },
    { label: "House Rent Allowance (HRA)", val: hra },
    ...(conveyance > 0 ? [{ label: "Conveyance Allowance", val: conveyance }] : []),
    ...(medical > 0 ? [{ label: "Medical Allowance", val: medical }] : []),
    ...(special > 0 ? [{ label: "Special Allowance", val: special }] : []),
    ...(da > 0 ? [{ label: "Dearness Allowance (DA)", val: da }] : []),
    ...(otherAllowance > 0 ? [{ label: "Other Allowances", val: otherAllowance }] : []),
    ...(fixedBonus > 0 ? [{ label: "Fixed Bonus", val: fixedBonus }] : []),
    ...(extraBonus > 0 ? [{ label: "Extra Bonus", val: extraBonus }] : []),
  ];

  const deductionsList = [
    ...(lopDeduction > 0 ? [{ label: "LOP / Absent Deduction", val: lopDeduction }] : []),
    { label: "PF Employee (12% of Basic+DA)", val: pf },
    { label: "ESI Employee (0.75% of Gross)", val: esic },
    { label: "Professional Tax (PT)", val: pt },
    ...(tds > 0 ? [{ label: "TDS / Income Tax", val: tds }] : []),
    ...(fixedDeduction > 0 ? [{ label: "Fixed Deductions", val: fixedDeduction }] : []),
    ...(extraDeduction > 0 ? [{ label: "Extra Deductions", val: extraDeduction }] : []),
    ...(otherDeduction > 0 ? [{ label: "Other Deductions", val: otherDeduction }] : []),
  ];

  const maxRows = Math.max(earningsList.length, deductionsList.length, 5);
  let itemY = currentY + 20;
  const rowHeight = 18;

  for (let i = 0; i < maxRows; i++) {
    const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";

    doc.rect(leftX, itemY, tableWidth, rowHeight).fillAndStroke(bg, "#e2e8f0");
    doc.rect(rightTableLeft, itemY, tableWidth, rowHeight).fillAndStroke(bg, "#e2e8f0");

    doc.fontSize(8.5).font("Helvetica").fillColor(darkTextColor);

    if (i < earningsList.length) {
      doc.text(earningsList[i].label, leftX + 10, itemY + 4, { width: 150 });
      doc.font("Helvetica-Bold").text(formatCurrency(earningsList[i].val), leftX + 10, itemY + 4, { align: "right", width: tableWidth - 20 });
    }

    if (i < deductionsList.length) {
      doc.font("Helvetica").text(deductionsList[i].label, rightTableLeft + 10, itemY + 4, { width: 150 });
      doc.font("Helvetica-Bold").text(formatCurrency(deductionsList[i].val), rightTableLeft + 10, itemY + 4, { align: "right", width: tableWidth - 20 });
    }

    itemY += rowHeight;
  }

  // Totals Row
  doc.rect(leftX, itemY, tableWidth, 22).fillAndStroke("#f1f5f9", borderGray);
  doc.rect(rightTableLeft, itemY, tableWidth, 22).fillAndStroke("#f1f5f9", borderGray);

  doc.fontSize(9).font("Helvetica-Bold").fillColor(primaryColor);
  doc.text("Gross Earnings (A)", leftX + 10, itemY + 6);
  doc.text(formatCurrency(gross), leftX + 10, itemY + 6, { align: "right", width: tableWidth - 20 });

  doc.text("Total Deductions (B)", rightTableLeft + 10, itemY + 6);
  doc.text(formatCurrency(totalDeduction), rightTableLeft + 10, itemY + 6, { align: "right", width: tableWidth - 20 });

  // 4. Statutory & Employer Info Box
  itemY += 28;
  doc.rect(leftX, itemY, width, 36).fillAndStroke(lightBgColor, borderGray);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(primaryColor).text("STATUTORY & EMPLOYER CONTRIBUTIONS (Rules 3, 9, 10)", leftX + 10, itemY + 5);
  doc.fontSize(8).font("Helvetica").fillColor(darkTextColor);
  doc.text(`Basic for PF (Basic+DA): ${formatCurrency(basicForPf)} | Employer PF (12%): ${formatCurrency(employerPf)} | Employer ESI (3.25%): ${formatCurrency(employerEsic)}${gratuity > 0 ? ` | Gratuity: ${formatCurrency(gratuity)}` : ''}`, leftX + 10, itemY + 18);

  // 5. Net Salary Banner
  currentY = itemY + 44;
  doc.rect(leftX, currentY, width, 45).fillAndStroke("#eff6ff", "#bfdbfe");

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#1e40af").text("NET SALARY PAYABLE (Gross - Total Deductions)", leftX + 15, currentY + 8);
  doc.fontSize(8.5).font("Helvetica-Oblique").fillColor(grayTextColor).text(`Amount in words: ${netSalaryWords}`, leftX + 15, currentY + 24);

  doc.fontSize(16).font("Helvetica-Bold").fillColor(primaryColor).text(formatCurrency(netSalary), leftX, currentY + 12, { align: "right", width: width - 15 });

  // 6. Signatures
  currentY = currentY + 60;
  const sigWidth = 200;

  doc.moveTo(leftX + 10, currentY).lineTo(leftX + 10 + sigWidth, currentY).dash(3, { space: 3 }).strokeColor("#94a3b8").stroke();
  doc.undash();
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(grayTextColor).text("EMPLOYEE SIGNATURE", leftX + 10, currentY + 6, { align: "center", width: sigWidth });

  const rightSigX = leftX + width - sigWidth - 10;
  doc.moveTo(rightSigX, currentY).lineTo(rightSigX + sigWidth, currentY).dash(3, { space: 3 }).strokeColor("#94a3b8").stroke();
  doc.undash();
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(grayTextColor).text(`AUTHORIZED SIGNATORY (${companyName})`, rightSigX, currentY + 6, { align: "center", width: sigWidth });

  // Footer Note
  doc.fontSize(8).font("Helvetica").fillColor("#94a3b8").text(
    "This is a computer-generated salary slip formatted according to statutory HR Payroll Formulas.",
    leftX,
    currentY + 40,
    { align: "center", width: width }
  );

  doc.end();
};

module.exports = {
  renderPayslipHtml,
  renderPayslipPdf,
  numberToWords,
  formatCurrency
};
