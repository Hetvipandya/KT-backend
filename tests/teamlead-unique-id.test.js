const assert = require("assert");
const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const { generateTeamLeadID, ensureTeamLeadUniqueID } = require("../utils/teamLeadId");
const { getMyTeam, createOrUpdateTeam } = require("../controllers/teamLeadController");

describe("Team Leader Unique ID Generation & Storage Tests", () => {
  let userStore = [];
  let employeeStore = [];
  let teamStore = [];

  beforeEach(() => {
    userStore = [];
    employeeStore = [];
    teamStore = [];

    const createQueryChain = (data) => {
      const promise = Promise.resolve(data);
      promise.select = () => createQueryChain(data);
      promise.populate = () => createQueryChain(data);
      promise.lean = () => createQueryChain(data);
      return promise;
    };

    // Mock User queries
    jest.spyOn(User, "find").mockImplementation((query) => {
      let filtered = [...userStore];
      if (query?.role?.$in) {
        const roles = query.role.$in.map((r) => String(r).toLowerCase());
        filtered = filtered.filter((u) => u.role && roles.includes(String(u.role).toLowerCase()));
      }
      return createQueryChain(filtered);
    });

    jest.spyOn(User, "findById").mockImplementation((id) => {
      const u = userStore.find((x) => String(x._id) === String(id));
      if (!u) return Promise.resolve(null);
      u.save = jest.fn().mockImplementation(() => Promise.resolve(u));
      return Promise.resolve(u);
    });

    jest.spyOn(User, "exists").mockImplementation(({ uniqueID }) => {
      const exists = userStore.some((u) => u.uniqueID === uniqueID);
      return Promise.resolve(exists ? { _id: "exists" } : null);
    });

    jest.spyOn(User, "findByIdAndUpdate").mockImplementation((id, update) => {
      const u = userStore.find((x) => String(x._id) === String(id));
      if (u) Object.assign(u, update);
      return Promise.resolve(u);
    });

    // Mock Employee queries
    jest.spyOn(Employee, "find").mockImplementation((query) => {
      let filtered = [...employeeStore];
      if (query?.isTeamLead) {
        filtered = filtered.filter((e) => e.isTeamLead);
      }
      return createQueryChain(filtered);
    });

    jest.spyOn(Employee, "findById").mockImplementation((id) => {
      const e = employeeStore.find((x) => String(x._id) === String(id));
      if (!e) return Promise.resolve(null);
      e.save = jest.fn().mockImplementation(() => Promise.resolve(e));
      return Promise.resolve(e);
    });

    jest.spyOn(Employee, "exists").mockImplementation((query) => {
      const exists = employeeStore.some((e) => {
        if (query?.employeeID) return e.employeeID === query.employeeID;
        if (query?.employeeCode) return e.employeeCode === query.employeeCode;
        if (query?.$or) {
          return query.$or.some(
            (c) => (c.employeeID && e.employeeID === c.employeeID) || (c.employeeCode && e.employeeCode === c.employeeCode)
          );
        }
        return false;
      });
      return Promise.resolve(exists ? { _id: "exists" } : null);
    });

    jest.spyOn(Employee, "findByIdAndUpdate").mockImplementation((id, update) => {
      const e = employeeStore.find((x) => String(x._id) === String(id));
      if (e) Object.assign(e, update);
      return Promise.resolve(e);
    });

    // Mock Team queries
    jest.spyOn(Team, "find").mockImplementation(() => {
      return createQueryChain([...teamStore]);
    });

    jest.spyOn(Team, "findOne").mockImplementation((query) => {
      const t = teamStore.find((x) => {
        const leadUser = x.teamLeadUser?._id || x.teamLeadUser;
        const leadEmp = x.teamLeadEmployee?._id || x.teamLeadEmployee;

        if (query?.$or) {
          return query.$or.some((cond) => {
            if (cond.teamLeadUser && String(leadUser) === String(cond.teamLeadUser)) return true;
            if (cond.teamLeadEmployee && String(leadEmp) === String(cond.teamLeadEmployee)) return true;
            return false;
          });
        }
        return false;
      });
      return Promise.resolve(t || null);
    });

    jest.spyOn(Team, "findById").mockImplementation((id) => {
      const t = teamStore.find((x) => String(x._id) === String(id));
      if (!t) return Promise.resolve(null);
      return {
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => Promise.resolve(t),
            }),
            populate: () => Promise.resolve(t),
          }),
          populate: () => Promise.resolve(t),
        }),
      };
    });

    jest.spyOn(Team, "create").mockImplementation((data) => {
      const t = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...data,
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };
      teamStore.push(t);
      return Promise.resolve(t);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("1. generateTeamLeadID produces sequential TL IDs (TL0001, TL0002)", async () => {
    const id1 = await generateTeamLeadID();
    assert.strictEqual(id1, "TL0001", "First TL ID should be TL0001");

    userStore.push({ _id: "u1", role: "team lead", uniqueID: "TL0001" });
    const id2 = await generateTeamLeadID();
    assert.strictEqual(id2, "TL0002", "Second TL ID should be TL0002");
  });

  test("2. ensureTeamLeadUniqueID stores unique ID on User, Employee, and Team", async () => {
    const user = { _id: "u1", name: "TL One", role: "team lead", save: jest.fn() };
    const emp = { _id: "e1", firstName: "TL", lastName: "One", isTeamLead: true, save: jest.fn() };
    const team = { _id: "t1", name: "TL Team", save: jest.fn() };

    userStore.push(user);
    employeeStore.push(emp);
    teamStore.push(team);

    const generatedId = await ensureTeamLeadUniqueID({ user, employee: emp, team });

    assert.strictEqual(generatedId, "TL0001", "Should generate TL0001");
    assert.strictEqual(user.uniqueID, "TL0001", "User uniqueID should be stored");
    assert.strictEqual(emp.employeeID, "TL0001", "Employee employeeID should be stored");
    assert.strictEqual(team.teamLeadId, "TL0001", "Team teamLeadId should be stored");
  });

  test("3. ensureTeamLeadUniqueID respects and preserves existing TL ID", async () => {
    const user = { _id: "u2", name: "TL Two", role: "team lead", uniqueID: "TL0099", save: jest.fn() };
    const emp = { _id: "e2", firstName: "TL", lastName: "Two", isTeamLead: true, save: jest.fn() };

    userStore.push(user);
    employeeStore.push(emp);

    const id = await ensureTeamLeadUniqueID({ user, employee: emp });

    assert.strictEqual(id, "TL0099", "Should preserve existing TL0099");
    assert.strictEqual(user.uniqueID, "TL0099");
    assert.strictEqual(emp.employeeID, "TL0099");
  });

  test("4. getMyTeam generates and formats Team Lead unique ID in API response", async () => {
    const user = { _id: "u3", name: "TL Three", role: "team lead", email: "tl3@test.com", save: jest.fn() };
    const emp = { _id: "e3", firstName: "TL", lastName: "Three", isTeamLead: true, email: "tl3@test.com", save: jest.fn() };
    const team = { _id: "t3", name: "TL Three Team", teamLeadUser: user, teamLeadEmployee: emp, employees: [], interns: [] };

    userStore.push(user);
    employeeStore.push(emp);
    teamStore.push(team);

    const req = { user: { _id: "u3" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getMyTeam(req, res);

    assert.strictEqual(res.status.mock.calls[0][0], 200);
    const responseData = res.json.mock.calls[0][0];

    assert.strictEqual(responseData.success, true);
    assert(responseData.data.length >= 1);
    const tlData = responseData.data[0].teamLead;
    assert.strictEqual(tlData.uniqueID, "TL0001", "Response teamLead.uniqueID should be TL0001");
    assert.strictEqual(tlData.teamLeadId, "TL0001", "Response teamLead.teamLeadId should be TL0001");
  });
});
