jest.mock('../models/Invoice', () => ({}));
jest.mock('../models/Customer', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Tax', () => ({
  countDocuments: jest.fn(),
}));
jest.mock('../models/FinancialYear', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/ChartOfAccount', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Product', () => ({
  find: jest.fn(),
}));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
}));
jest.mock('../services/auditLog.service', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/invoicePdf.service', () => ({
  generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('invoice')),
}));
jest.mock('../services/cloudinary.service', () => ({
  uploadInvoicePdf: jest.fn().mockResolvedValue({
    secure_url: 'https://example.test/invoice.pdf',
    public_id: 'invoice-pdf',
    resource_type: 'raw',
  }),
  deleteInvoicePdf: jest.fn().mockResolvedValue(undefined),
}));

const Customer = require('../models/Customer');
const FinancialYear = require('../models/FinancialYear');
const ChartOfAccount = require('../models/ChartOfAccount');
const journalService = require('../services/journalEntry.service');
const invoiceService = require('../services/invoice.service');
const { createInvoiceSchema } = require('../validators/invoice.validators');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const YEAR_ID = '6ac8a921e6b91ab589aa3003';
const CUSTOMER_ID = '6ac8a921e6b91ab589aa3004';
const INVOICE_ID = '6ac8a921e6b91ab589aa3005';
const USER_ID = '6ac8a921e6b91ab589aa3006';

describe('Sales invoice update accounting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('accepts the invoice payload produced by the sales invoice form', () => {
    const result = createInvoiceSchema.safeParse({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      customerId: CUSTOMER_ID,
      invoiceDate: '2026-04-10',
      dueDate: null,
      reference: 'SO-42',
      lineItems: [{
        productId: null,
        description: 'Consulting',
        quantity: 2,
        rate: 100,
        discount: 0,
        taxableAmount: 200,
        taxRateId: null,
        taxAmount: 36,
        totalAmount: 236,
      }],
      subTotal: 200,
      discountTotal: 0,
      taxTotal: 36,
      grandTotal: 236,
      roundOff: 0,
      notes: '',
    });

    expect(result.success).toBe(true);
  });

  test('reverses the old journal and posts a balanced replacement for an unpaid invoice', async () => {
    FinancialYear.findById.mockResolvedValue({
      companyId: COMPANY_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    const customer = { _id: CUSTOMER_ID, name: 'Acme', coaAccountId: 'customer-coa' };
    Customer.findOne.mockResolvedValue(customer);
    ChartOfAccount.findOne
      .mockResolvedValueOnce({ _id: 'customer-coa' })
      .mockResolvedValueOnce({ _id: 'sales-coa' });
    journalService.reverseJournalEntry.mockResolvedValue({
      reversal: { _id: 'reversal-entry' },
    });
    journalService.createJournalEntry.mockResolvedValue({ _id: 'replacement-entry' });

    const invoice = {
      _id: INVOICE_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      customerId: CUSTOMER_ID,
      customerName: 'Acme',
      invoiceNumber: 'INV-2026-27-0001',
      invoiceDate: new Date('2026-04-10'),
      dueDate: null,
      status: 'POSTED',
      amountReceived: 0,
      balanceDue: 100,
      appliedPayments: [],
      lineItems: [{
        productId: null,
        description: 'Consulting',
        quantity: 1,
        rate: 100,
        discount: 0,
        taxableAmount: 100,
        taxRateId: null,
        taxAmount: 0,
        totalAmount: 100,
      }],
      subTotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      roundOff: 0,
      grandTotal: 100,
      journalEntryId: 'original-entry',
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        const { save, toObject, ...fields } = this;
        return { ...fields };
      },
    };

    await expect(invoiceService.updateInvoice(invoice, {
      invoiceDate: '2026-04-11',
      dueDate: null,
      reference: 'SO-42',
      lineItems: [{
        productId: null,
        description: 'Consulting',
        quantity: 2,
        rate: 100,
        discount: 0,
        taxableAmount: 200,
        taxRateId: null,
        taxAmount: 0,
        totalAmount: 200,
      }],
      subTotal: 200,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 200,
      roundOff: 0,
      notes: '',
    }, USER_ID)).resolves.toMatchObject({
      id: INVOICE_ID,
      grandTotal: 200,
      balanceDue: 200,
    });

    expect(journalService.reverseJournalEntry).toHaveBeenCalledWith('original-entry', USER_ID);
    expect(journalService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'INV-2026-27-0001',
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: 'customer-coa', debit: 200, credit: 0 }),
          expect.objectContaining({ accountId: 'sales-coa', debit: 0, credit: 200 }),
        ]),
      }),
      USER_ID
    );
    const lines = journalService.createJournalEntry.mock.calls[0][0].lines;
    expect(lines.reduce((sum, line) => sum + line.debit, 0))
      .toBeCloseTo(lines.reduce((sum, line) => sum + line.credit, 0), 2);
    expect(invoice.journalEntryId).toBe('replacement-entry');
    expect(invoice.reversalJournalEntryId).toBe('reversal-entry');
  });
});
