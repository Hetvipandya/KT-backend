const { registerSchema } = require('../validators/auth.validators');

describe('registration request validation', () => {
  test('accepts employee profile fields submitted by the registration form', () => {
    const result = registerSchema.safeParse({
      name: 'Test Employee',
      email: 'employee@example.com',
      password: 'Kevalon@2026',
      role: 'employee',
      phone: '+919876543210',
      phoneNumber: '+919876543210',
      dob: '1995-06-15',
      bloodGroup: 'O+',
      gender: 'Female',
      address: 'Ahmedabad',
      department: 'Engineering',
      designation: 'Developer',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      dob: '1995-06-15',
      bloodGroup: 'O+',
      gender: 'Female',
      address: 'Ahmedabad',
      department: 'Engineering',
      designation: 'Developer',
    });
  });

  test('continues rejecting fields outside the registration contract', () => {
    const result = registerSchema.safeParse({
      name: 'Test Employee',
      email: 'employee@example.com',
      password: 'Kevalon@2026',
      unexpectedField: true,
    });

    expect(result.success).toBe(false);
  });
});