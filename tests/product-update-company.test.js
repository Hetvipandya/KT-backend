const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { updateProduct } = require("../controllers/product.controller");

describe("product company ID update validation", () => {
  const companyId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  let app;
  let product;

  beforeEach(() => {
    product = {
      _id: productId,
      companyId,
      taxRateId: null,
      gstRate: 0,
      isActive: true,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    app = express();
    app.use(express.json());
    app.put("/products/:id", (req, res, next) => {
      req.product = product;
      req.user = { _id: new mongoose.Types.ObjectId() };
      next();
    }, updateProduct);
  });

  test("allows the existing company ID to be included in update requests", async () => {
    const response = await request(app)
      .put(`/products/${productId}`)
      .send({ companyId: companyId.toString() });

    expect(response.status).toBe(200);
    expect(product.save).toHaveBeenCalledTimes(1);
  });

  test("rejects changing the product company ID", async () => {
    const response = await request(app)
      .put(`/products/${productId}`)
      .send({ companyId: new mongoose.Types.ObjectId().toString() });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe("IMMUTABLE_FIELD");
    expect(product.save).not.toHaveBeenCalled();
  });
});
