const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const { shape } = require("../services/purchase.service");

describe("purchase line item product names", () => {
  test("references Product for line item population", () => {
    const productIdPath = Purchase.schema
      .path("lineItems")
      .schema.path("productId");

    expect(productIdPath.options.ref).toBe("Product");
    expect(Product.modelName).toBe(productIdPath.options.ref);
  });

  test("returns the product name and catalog details for populated line items", () => {
    const productId = "64f000000000000000000001";
    const purchase = {
      _id: "64f000000000000000000002",
      lineItems: [
        {
          productId: {
            _id: productId,
            name: "Printed ID Card",
            code: "NFC-001",
            hsnSacCode: "39204900",
            unitOfMeasure: "PCS",
          },
          description: "Without Printed",
          quantity: 25,
          rate: 25,
          amount: 625,
        },
      ],
    };

    const result = shape(purchase, true);

    expect(result.lineItems[0]).toEqual(
      expect.objectContaining({
        productId,
        productName: "Printed ID Card",
        productCode: "NFC-001",
        hsnCode: "39204900",
        unit: "PCS",
        product: {
          id: productId,
          name: "Printed ID Card",
          code: "NFC-001",
          hsn: "39204900",
        },
      }),
    );
  });
});
