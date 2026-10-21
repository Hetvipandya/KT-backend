const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const authController = require("../controllers/auth.controller");
const userControllers = require("../controllers/userControllers");

describe("employee lifecycle login restrictions", () => {
  let app;

  beforeEach(() => {
    jest.restoreAllMocks();
    app = express();
    app.use(express.json());
    app.post("/api/auth/login", authController.login);
    app.post("/api/users/login", userControllers.loginUser);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ["/api/auth/login", "Resigned", "resignation"],
    ["/api/users/login", "Terminated", "exit"],
  ])("blocks %s for employee lifecycle status %s", async (path, status, action) => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      email: "employee@example.com",
      role: "employee",
      isApproved: true,
      isActive: true,
    };
    const employee = {
      employeeStatus: status,
      currentAction: action,
      status: status.toUpperCase(),
    };

    jest.spyOn(User, "findOne").mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(user),
    }));
    jest.spyOn(Employee, "findOne").mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(employee),
    }));

    const res = await request(app)
      .post(path)
      .send({ email: user.email, password: "Password123!" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "Your account is not eligible to log in due to resignation or exit",
    );
  });
});
