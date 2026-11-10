const { PassThrough } = require('stream');
const { renderPayslipHtml, renderPayslipPdf } = require('../services/payslipRenderService');

describe('salary payment voucher rendering', () => {
  test('shows available employee and salary data without empty fields or signatures', () => {
    const html = renderPayslipHtml(
      {
        month: 10,
        year: 2026,
        basicSalary: 30000,
        hra: 10000,
        grossSalary: 40000,
        pfDeduction: 1800,
        totalDeduction: 1800,
        netSalary: 38200,
        status: 'paid',
        paymentMode: 'BANK_TRANSFER',
      },
      {
        name: 'Asha Patel',
        employeeCode: 'EMP-104',
        department: 'Engineering',
      },
    );

    expect(html).toContain('EMPLOYEE SALARY PAYMENT VOUCHER');
    expect(html).toContain('Asha Patel');
    expect(html).toContain('EMP-104');
    expect(html).toContain('Engineering');
    expect(html).toContain('Basic Salary');
    expect(html).toContain('HRA');
    expect(html).toContain('PF');
    expect(html).toContain('Payment Mode');
    expect(html).not.toContain('Designation');
    expect(html).not.toContain('Employee Email');
    expect(html).not.toContain('Employee Signature');
    expect(html).not.toContain('Authorized Signatory');
  });

  test('omits empty payment and optional deduction sections', () => {
    const html = renderPayslipHtml(
      {
        month: 10,
        year: 2026,
        basicSalary: 25000,
        grossSalary: 25000,
        netSalary: 25000,
      },
      { name: 'Asha Patel' },
    );

    expect(html).toContain('TOTAL SALARY (A)');
    expect(html).not.toContain('D. PAYMENT DETAILS');
    expect(html).not.toContain('B. DEDUCTION DETAILS');
    expect(html).not.toContain('C. EXTRA / ADDITIONAL PAYMENT');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('N/A');
  });

  test('generates a PDF voucher successfully', async () => {
    const response = new PassThrough();
    response.setHeader = jest.fn();
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    const completed = new Promise((resolve, reject) => {
      response.on('end', resolve);
      response.on('error', reject);
    });

    renderPayslipPdf(response, {
      month: 10,
      year: 2026,
      basicSalary: 25000,
      grossSalary: 25000,
      netSalary: 25000,
    }, { name: 'Asha Patel' });
    await completed;

    expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF');
  });
});
