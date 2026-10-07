const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const EmployeeDocument = require("../models/EmployeeDocument");
const EmployeeHistory = require("../models/EmployeeHistory");
const Attendance = require("../models/Attendance");
const AdjustmentRequest = require("../models/AdjustmentRequest");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const EmployeePerformance = require("../models/EmployeePerformance");
const Project = require("../models/projectModel");
const TeamLeadActivity = require("../models/TeamLeadActivity");
const Task = require("../models/taskModel");
const Session = require("../models/Session");
const Salary = require("../models/Salary");
const SalaryStructure = require("../models/SalaryStructure");
const { cascadeDeleteUser } = require("../utils/userCascadeDelete");
const { deleteUser } = require("../controllers/userControllers");

mongoose.set("bufferCommands", false);

describe("User Cascade Deletion (Employee & Team Lead)", () => {
  beforeEach(() => {
    jest.spyOn(EmployeeDocument, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(EmployeeHistory, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Attendance, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(AdjustmentRequest, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Leave, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(LeaveBalance, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(EmployeePerformance, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(TeamLeadActivity, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Task, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(Session, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Salary, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(SalaryStructure, "deleteMany").mockResolvedValue({ deletedCount: 1 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("cascadeDeleteUser utility", () => {
    it("deletes employee from employee table when user is an employee", async () => {
      const userId = new mongoose.Types.ObjectId();
      const employeeId = new mongoose.Types.ObjectId();

      const mockUser = {
        _id: userId,
        name: "Test Employee User",
        email: "employee@kevalon.com",
        role: "employee",
      };

      const mockEmployee = {
        _id: employeeId,
        userID: userId,
        email: "employee@kevalon.com",
        firstName: "Test",
        lastName: "Employee",
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(Employee, "find").mockResolvedValue([mockEmployee]);
      const empDeleteSpy = jest.spyOn(Employee, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      const tmDeleteSpy = jest.spyOn(TeamMember, "deleteMany").mockResolvedValue({ deletedCount: 0 });
      const teamDeleteSpy = jest.spyOn(Team, "deleteMany").mockResolvedValue({ deletedCount: 0 });
      const teamUpdateSpy = jest.spyOn(Team, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      const projUpdateSpy = jest.spyOn(Project, "updateMany").mockResolvedValue({ modifiedCount: 0 });

      const result = await cascadeDeleteUser(mockUser);

      expect(result.success).toBe(true);
      expect(result.deletedUserId).toEqual(userId);
      expect(result.deletedEmployeeIds).toContain(employeeId);

      // Verify Employee is deleted from Employee table
      expect(empDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $in: [employeeId] },
        })
      );
    });

    it("deletes TeamMember and Team when user is a Team Lead", async () => {
      const userId = new mongoose.Types.ObjectId();
      const employeeId = new mongoose.Types.ObjectId();

      const mockTLUser = {
        _id: userId,
        name: "Test Team Lead",
        email: "tl@kevalon.com",
        role: "team lead",
      };

      const mockTLEmployee = {
        _id: employeeId,
        userID: userId,
        email: "tl@kevalon.com",
        firstName: "Test",
        lastName: "TL",
        isTeamLead: true,
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockTLUser);
      jest.spyOn(Employee, "find").mockResolvedValue([mockTLEmployee]);
      const empDeleteSpy = jest.spyOn(Employee, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      const tmDeleteSpy = jest.spyOn(TeamMember, "deleteMany").mockResolvedValue({ deletedCount: 2 });
      const teamDeleteSpy = jest.spyOn(Team, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      const teamUpdateSpy = jest.spyOn(Team, "updateMany").mockResolvedValue({ modifiedCount: 1 });
      const projUpdateSpy = jest.spyOn(Project, "updateMany").mockResolvedValue({ modifiedCount: 1 });

      const result = await cascadeDeleteUser(mockTLUser);

      expect(result.success).toBe(true);
      expect(result.deletedUserId).toEqual(userId);

      // Verify Employee is deleted from Employee table
      expect(empDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $in: [employeeId] },
        })
      );

      // Verify Team Lead is deleted from TeamMember table
      expect(tmDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.objectContaining({
            $in: expect.arrayContaining([userId]),
          }),
        })
      );

      // Verify Team led by this Team Lead is deleted
      expect(teamDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({
              teamLeadUser: expect.objectContaining({
                $in: expect.arrayContaining([userId]),
              }),
            }),
          ]),
        })
      );
    });
  });

  describe("deleteUser Controller Endpoint", () => {
    it("deletes user and cascades to Employee and TeamMember when valid userId is provided", async () => {
      const userId = new mongoose.Types.ObjectId();
      const employeeId = new mongoose.Types.ObjectId();

      const mockUser = {
        _id: userId,
        name: "TL User To Delete",
        email: "delete_tl@kevalon.com",
        role: "team lead",
      };

      const mockEmployee = {
        _id: employeeId,
        userID: userId,
        email: "delete_tl@kevalon.com",
        firstName: "TL",
        lastName: "User",
        isTeamLead: true,
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(Employee, "find").mockResolvedValue([mockEmployee]);
      const empDeleteSpy = jest.spyOn(Employee, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      const tmDeleteSpy = jest.spyOn(TeamMember, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      const teamDeleteSpy = jest.spyOn(Team, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      const teamUpdateSpy = jest.spyOn(Team, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      const projUpdateSpy = jest.spyOn(Project, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      const userDeleteSpy = jest.spyOn(User, "findByIdAndDelete").mockResolvedValue(mockUser);

      const req = {
        params: { id: userId.toString() },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User deleted successfully",
          deletedUserId: userId,
          deletedEmployeeIds: [employeeId],
        })
      );

      // User deleted
      expect(userDeleteSpy).toHaveBeenCalledWith(userId, { skipCascade: true });

      // Employee deleted
      expect(empDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $in: [employeeId] },
        })
      );

      // Team Lead deleted from TeamMember
      expect(tmDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.objectContaining({
            $in: expect.arrayContaining([userId]),
          }),
        })
      );
    });

    it("returns 404 when user is not found", async () => {
      const userId = new mongoose.Types.ObjectId();
      jest.spyOn(User, "findById").mockResolvedValue(null);
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      const req = {
        params: { id: userId.toString() },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found",
        })
      );
    });

    it("returns 400 when no userId is passed", async () => {
      const req = {
        params: {},
        body: {},
        query: {},
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User ID is required",
        })
      );
    });
  });

  describe("HTTP Routes (supertest)", () => {
    let app;
    const request = require("supertest");
    const express = require("express");
    const userRoutes = require("../routes/userRoutes");

    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use("/api/users", userRoutes);
    });

    it("DELETE /api/users/delete/:id deletes user and returns 200", async () => {
      const userId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: userId,
        name: "Route Test TL",
        email: "route_tl@kevalon.com",
        role: "team lead",
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(Employee, "find").mockResolvedValue([]);
      jest.spyOn(TeamMember, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(Team, "deleteMany").mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(Team, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      jest.spyOn(Project, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      jest.spyOn(User, "findByIdAndDelete").mockResolvedValue(mockUser);

      const response = await request(app).delete(`/api/users/delete/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedUserId).toBe(userId.toString());
    });

    it("DELETE /api/users/:id deletes user and returns 200", async () => {
      const userId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: userId,
        name: "Route Test Emp",
        email: "route_emp@kevalon.com",
        role: "employee",
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(Employee, "find").mockResolvedValue([]);
      jest.spyOn(TeamMember, "deleteMany").mockResolvedValue({ deletedCount: 0 });
      jest.spyOn(Team, "deleteMany").mockResolvedValue({ deletedCount: 0 });
      jest.spyOn(Team, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      jest.spyOn(Project, "updateMany").mockResolvedValue({ modifiedCount: 0 });
      jest.spyOn(User, "findByIdAndDelete").mockResolvedValue(mockUser);

      const response = await request(app).delete(`/api/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedUserId).toBe(userId.toString());
    });
  });
});

