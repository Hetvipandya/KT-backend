const { normalizeRegistrationRole } = require("../controllers/auth.controller");

describe("mobile Team Lead role normalization", () => {
  test.each(["teamlead", "team lead", "TeamLead", "Team Leader"])(
    "normalizes %s to the canonical Team Lead role",
    (role) => {
      expect(normalizeRegistrationRole(role)).toBe("team lead");
    },
  );

  test("preserves other supported roles", () => {
    expect(normalizeRegistrationRole("intern")).toBe("intern");
    expect(normalizeRegistrationRole("super_admin")).toBe("super admin");
  });
});
