const expenseService = require('../services/expense.service');

exports.create = async (req, res, next) => {
  try {
    res.status(201).json({
      success: true,
      data: await expenseService.create(req.body, req.user._id),
    });
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        companyId: req.query.companyId,
        branchId: req.query.branchId,
        items: await expenseService.list(req.query.companyId, req.query),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const expense = await expenseService.get(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    return res.json({ success: true, data: expense });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const expense = await expenseService.update(req.params.id, req.body, req.user._id);
    return res.json({ success: true, data: expense });
  } catch (error) {
    return next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await expenseService.remove(
      req.params.id,
      req.company._id,
      req.branchId,
      req.user._id,
    );
    return res.json({
      success: true,
      message: 'Expense deleted and its journal entry reversed.',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
