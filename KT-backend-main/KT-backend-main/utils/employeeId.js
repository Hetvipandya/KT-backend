const generateEmployeeID = async (Employee) => {
  const employees = await Employee.find({
    employeeID: { $regex: /^EMP\d+$/ },
  })
    .select("employeeID")
    .lean();

  const highestNumber = employees.reduce((highest, employee) => {
    const number = Number(String(employee.employeeID).replace(/^EMP/, ""));
    return Number.isInteger(number) ? Math.max(highest, number) : highest;
  }, 0);

  let nextNumber = highestNumber + 1;
  let employeeID = `EMP${String(nextNumber).padStart(4, "0")}`;

  while (await Employee.exists({ employeeID })) {
    nextNumber += 1;
    employeeID = `EMP${String(nextNumber).padStart(4, "0")}`;
  }

  return employeeID;
};

module.exports = generateEmployeeID;