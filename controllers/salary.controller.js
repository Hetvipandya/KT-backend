const s = require("../services/salary.service");
exports.create = async (r, res, n) => {
  try {
    res
      .status(201)
      .json({ success: true, data: await s.create(r.body, r.user._id) });
  } catch (e) {
    n(e);
  }
};
exports.list = async (r, res, n) => {
  try {
    res.json({
      success: true,
      data: {
        companyId: r.query.companyId,
        branchId: r.query.branchId,
        items: await s.list(r.query.companyId, r.query),
      },
    });
  } catch (e) {
    n(e);
  }
};
