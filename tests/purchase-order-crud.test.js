jest.mock('../models/PurchaseOrder', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/Purchase', () => ({
  exists: jest.fn(),
}));
jest.mock('../models/Supplier', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/FinancialYear', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/Tax', () => ({
  countDocuments: jest.fn(),
}));

const PurchaseOrder = require('../models/PurchaseOrder');
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const FinancialYear = require('../models/FinancialYear');
const purchaseOrderService = require('../services/purchaseOrder.service');

const PO_ID = '6ac8a921e6b91ab589aa3001';
const COMPANY_ID = '6ac8a921e6b91ab589aa3002';
const YEAR_ID = '6ac8a921e6b91ab589aa3003';
const SUPPLIER_ID = '6ac8a921e6b91ab589aa3004';
const USER_ID = '6ac8a921e6b91ab589aa3005';

const createPurchaseOrder = () => ({
  _id: PO_ID,
  companyId: COMPANY_ID,
  branchId: null,
  status: 'APPROVED',
  isDeleted: false,
  save: jest.fn().mockResolvedValue(undefined),
});

const createUpdateData = () => ({
  financialYearId: YEAR_ID,
  supplierId: SUPPLIER_ID,
  poDate: '2026-04-01',
  expectedDeliveryDate: null,
  reference: 'Quote 42',
  lineItems: [{
    productId: '6ac8a921e6b91ab589aa3006',
    description: 'Office supplies',
    quantity: 1,
    rate: 60000,
    amount: 60000,
    taxRateId: null,
  }],
  subTotal: 60000,
  taxAmount: 0,
  totalAmount: 60000,
});

const createDetailsQuery = () => {
  const query = {
    populate: jest.fn(),
    lean: jest.fn().mockResolvedValue({
      _id: PO_ID,
      companyId: COMPANY_ID,
      branchId: null,
      financialYearId: { _id: YEAR_ID, yearLabel: '2026-27', isLocked: false },
      supplierId: { _id: SUPPLIER_ID, name: 'Office Supplier' },
      poNumber: 'PO-2026-27-0001',
      poDate: new Date('2026-04-01'),
      status: 'PENDING_APPROVAL',
      approvalRequired: true,
      autoApproved: false,
      lineItems: [],
      subTotal: 60000,
      taxAmount: 0,
      totalAmount: 60000,
    }),
  };
  query.populate.mockReturnValue(query);
  return query;
};

describe('Purchase order CRUD safeguards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('refuses to edit an order linked to a purchase bill', async () => {
    Purchase.exists.mockResolvedValue({ _id: '6ac8a921e6b91ab589aa3010' });
    const order = createPurchaseOrder();

    await expect(purchaseOrderService.updatePurchaseOrder(order, createUpdateData(), USER_ID))
      .rejects.toMatchObject({ errorCode: 'PURCHASE_ORDER_LINKED_TO_PURCHASE_BILL', statusCode: 409 });

    expect(order.save).not.toHaveBeenCalled();
  });

  test('requires renewed approval after an edit raises the order above the approval threshold', async () => {
    Purchase.exists.mockResolvedValue(null);
    FinancialYear.findById.mockResolvedValue({
      _id: YEAR_ID,
      companyId: COMPANY_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    Supplier.findOne.mockResolvedValue({ _id: SUPPLIER_ID, isActive: true });
    PurchaseOrder.findById.mockReturnValue(createDetailsQuery());
    const order = {
      ...createPurchaseOrder(),
      approvedBy: '6ac8a921e6b91ab589aa3007',
      approvedAt: new Date('2026-04-02'),
    };

    await purchaseOrderService.updatePurchaseOrder(order, createUpdateData(), USER_ID);

    expect(order.status).toBe('PENDING_APPROVAL');
    expect(order.approvalRequired).toBe(true);
    expect(order.autoApproved).toBe(false);
    expect(order.approvedBy).toBeNull();
    expect(order.approvedAt).toBeNull();
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  test('soft-deletes an unlinked order and refuses deletion after a bill is linked', async () => {
    const order = createPurchaseOrder();
    Purchase.exists.mockResolvedValue(null);

    await expect(purchaseOrderService.deletePurchaseOrder(order, USER_ID))
      .resolves.toMatchObject({ id: PO_ID, isDeleted: true });
    expect(order.isDeleted).toBe(true);
    expect(order.deletedBy).toBe(USER_ID);
    expect(order.save).toHaveBeenCalledTimes(1);

    Purchase.exists.mockResolvedValue({ _id: '6ac8a921e6b91ab589aa3010' });
    const linkedOrder = createPurchaseOrder();
    await expect(purchaseOrderService.deletePurchaseOrder(linkedOrder, USER_ID))
      .rejects.toMatchObject({ errorCode: 'PURCHASE_ORDER_LINKED_TO_PURCHASE_BILL', statusCode: 409 });
    expect(linkedOrder.save).not.toHaveBeenCalled();
  });
});
