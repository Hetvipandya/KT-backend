const Role =
  require("../models/Role");

const seedDefaultRoles =
  async () => {
    try {
      const defaultRoles =
        [
          "Super Admin",
          "HR Manager",
          "Team Lead",
          "Employee",
          "Intern",
          "Accountant",
        ];

      for (
        const roleName of defaultRoles
      ) {
        const exists =
          await Role.findOne({
            roleName,
          });

        if (!exists) {
          await Role.create({
            roleName,
            isDefault:
              true,
          });

          console.log(
            `${roleName} added`
          );
        }
      }
    } catch (error) {
      console.log(
        "Role seed error",
        error
      );
    }
  };

module.exports =
  seedDefaultRoles;