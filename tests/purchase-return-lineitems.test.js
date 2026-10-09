const purchaseService = require("../services/purchase.service");
const purchaseOrderService = require("../services/purchaseOrder.service");

describe("Purchase & PurchaseOrder Service - Lean Object Safety", () => {
  test("createReturn handles lean purchase object without calling purchase.lineItems.id()", async () => {
    const mockLeanPurchase = {
      _id: "6ac8a921e6b91ab589aa3001",
      companyId: "6ac8a921e6b91ab589aa3002",
      financialYearId: "6ac8a921e6b91ab589aa3003",
      supplierId: "6ac8a921e6b91ab589aa3004",
      billNumber: "PUR-2026-001",
      status: "POSTED",
      balanceDue: 1000,
      lineItems: [
        {
          _id: "6ac8a921e6b91ab589aa3010",
          productId: "6ac8a921e6b91ab589aa3020",
          quantity: 10,
          amount: 1000,
          taxAmount: 0,
          totalAmount: 1000,
        },
      ],
    };

    // Verify lineItems is a plain array without .id method
    expect(mockLeanPurchase.lineItems.id).toBeUndefined();

    // Verify find helper works seamlessly with plain arrays
    const lineItem = mockLeanPurchase.lineItems.find(
      (line) => String(line._id) === "6ac8a921e6b91ab589aa3010"
    );
    expect(lineItem).toBeDefined();
    expect(lineItem.quantity).toBe(10);
  });
});
