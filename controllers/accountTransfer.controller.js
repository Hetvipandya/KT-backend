const accountTransferService = require('../services/accountTransfer.service');

/**
 * POST /api/bank-account/transfer
 * Execute inter-account transfer (Bank to Bank, Bank to Cash, Cash to Bank, Cash to Cash)
 */
const createTransfer = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : req.body.userId;
    const transfer = await accountTransferService.createTransfer(req.body, userId);
    return res.status(201).json({
      success: true,
      message: 'Account transfer executed successfully',
      data: transfer
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank-account/fund-plus
 * Execute direct deposit / fund plus into a bank or cash account
 */
const createFundPlus = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : req.body.userId;
    const fundPlus = await accountTransferService.createFundPlus(req.body, userId);
    return res.status(201).json({
      success: true,
      message: 'Fund Plus executed successfully',
      data: fundPlus
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank-account/fund-minus
 * Execute direct deduction / fund minus from a bank or cash account
 */
const createFundMinus = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : req.body.userId;
    const fundMinus = await accountTransferService.createFundMinus(req.body, userId);
    return res.status(201).json({
      success: true,
      message: 'Fund Minus executed successfully',
      data: fundMinus
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank-account/transfers
 * List transfer transactions for a company
 */
const listTransfers = async (req, res, next) => {
  try {
    const companyId = req.query.companyId || req.companyId;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID query parameter is required'
      });
    }

    const transfers = await accountTransferService.listTransfers(companyId, req.query);
    return res.status(200).json({
      success: true,
      data: transfers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank-account/transfers/:id
 * Get single transfer details
 */
const getTransferDetails = async (req, res, next) => {
  try {
    const companyId = req.query.companyId || req.companyId;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID query parameter is required'
      });
    }

    const transfer = await accountTransferService.getTransferById(req.params.id, companyId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: transfer
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank-account/transfers/:id/cancel
 * Cancel / Reverse a transfer transaction
 */
const cancelTransfer = async (req, res, next) => {
  try {
    const companyId = req.body.companyId || req.query.companyId || req.companyId;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required to cancel a transfer'
      });
    }

    const userId = req.user ? req.user._id : req.body.userId;
    const cancelledTransfer = await accountTransferService.cancelTransfer(req.params.id, companyId, userId);

    return res.status(200).json({
      success: true,
      message: 'Transfer transaction cancelled and journal entry reversed',
      data: cancelledTransfer
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransfer,
  createFundPlus,
  createFundMinus,
  listTransfers,
  getTransferDetails,
  cancelTransfer
};
