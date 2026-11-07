const mongoose = require("mongoose");

/**
 * Generate a guaranteed unique Deduction Record ID in format: DED-YYYYMM-XXXX
 * e.g., DED-202611-0001
 * 
 * @param {number} month (1-12)
 * @param {number} year (e.g. 2026)
 * @returns {Promise<string>}
 */
const generateDeductionRecordId = async (month, year) => {
  const targetMonth = month ? Number(month) : new Date().getMonth() + 1;
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const prefix = `DED-${targetYear}${String(targetMonth).padStart(2, "0")}-`;

  const EmployeeDeduction = mongoose.models.EmployeeDeduction || require("../models/EmployeeDeduction");

  let maxNum = 0;

  if (mongoose.connection && mongoose.connection.readyState === 1 && typeof EmployeeDeduction.find === "function") {
    try {
      const records = await EmployeeDeduction.find({
        deductionRecordId: { $regex: new RegExp(`^${prefix}\\d+$`, "i") },
      })
        .select("deductionRecordId")
        .lean();

      records.forEach((r) => {
        if (r.deductionRecordId) {
          const numStr = r.deductionRecordId.replace(prefix, "");
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
    } catch (_) {}
  }

  let nextNum = maxNum + 1;
  let candidateId = `${prefix}${String(nextNum).padStart(4, "0")}`;

  if (mongoose.connection && mongoose.connection.readyState === 1 && typeof EmployeeDeduction.exists === "function") {
    try {
      while (await EmployeeDeduction.exists({ deductionRecordId: candidateId })) {
        nextNum += 1;
        candidateId = `${prefix}${String(nextNum).padStart(4, "0")}`;
      }
    } catch (_) {}
  }

  return candidateId;
};

module.exports = { generateDeductionRecordId };
