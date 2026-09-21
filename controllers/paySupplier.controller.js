const service = require('../services/paySupplier.service');
exports.create = async (req, res, next) => { try { res.status(201).json({ success: true, data: await service.createSupplierPayment(req.body, req.user._id) }); } catch (error) { next(error); } };
