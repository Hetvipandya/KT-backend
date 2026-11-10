const { registerSchema } = require("../validators/auth.validators");

describe("registration request validation", () => {
  test("accepts registration form fields and normalizes common role casing", () => {
    const result = registerSchema.safeParse({
      fullName: "  Alex Employee ",
      workEmail: "  alex@example.com ",
      phoneNumber: "",
      role: "Team Lead",
      password: "Secure123",
      confirmPassword: "Secure123",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "Alex Employee",
      email: "alex@example.com",
      role: "team lead",
      confirmPassword: "Secure123",
    });
    expect(result.data.phoneNumber).toBeUndefined();
  });

  test("accepts canonical and mobile-compatible registration field names", () => {
    const result = registerSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      phone: "+14155550123",
      role: "employee",
      password: "Secure123",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "Alex",
      email: "alex@example.com",
      phone: "+14155550123",
      role: "employee",
    });
  });

  test("reports a password confirmation mismatch against the confirmation field", () => {
    const result = registerSchema.safeParse({
      fullName: "Alex",
      workEmail: "alex@example.com",
      role: "employee",
      password: "Secure123",
      confirmPassword: "Different123",
    });

    expect(result.success).toBe(false);
    expect(result.error.errors).toContainEqual(
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "passwords do not match",
      }),
    );
  });
});