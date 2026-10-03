const service = require('../services/purchaseOrder.service'); const send = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };
exports.create = send(async (req, res) => res.status(201).json({ success: true, data: await service.createPurchaseOrder(req.body, req.user._id) }));
exports.list = send(async (req, res) => { const { companyId, ...query } = req.query; res.json({ success: true, data: { companyId, ...(await service.listPurchaseOrders(companyId, query)) } }); });
exports.get = send(async (req, res) => res.json({ success: true, data: await service.getPurchaseOrderDetails(req.params.id) }));
exports.approve = send(async (req, res) => res.json({ success: true, data: await service.approvePurchaseOrder(await service.getPurchaseOrderDocument(req.params.id), req.user._id, req.body.reason) }));
exports.reject = send(async (req, res) => res.json({ success: true, data: await service.rejectPurchaseOrder(await service.getPurchaseOrderDocument(req.params.id), req.user._id, req.body.reason) }));
