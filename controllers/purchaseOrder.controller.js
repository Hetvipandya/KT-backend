const service = require('../services/purchaseOrder.service'); const send = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };
exports.create = send(async (req, res) => res.status(201).json({ success: true, data: await service.createPurchaseOrder(req.body, req.user._id) }));
exports.list = send(async (req, res) => {
  const { companyId, _id, id, ...query } = req.query;
  const purchaseOrderId = _id || id;
  if (purchaseOrderId) {
    return res.json({ success: true, data: await service.getPurchaseOrderDocument(purchaseOrderId) });
  }
  if (!companyId) {
    return res.status(400).json({ success: false, message: 'companyId is required when purchase order id is not provided', errorCode: 'INVALID_QUERY' });
  }
  return res.json({ success: true, data: { companyId, ...(await service.listPurchaseOrders(companyId, query)) } });
});
exports.get = send(async (req, res) => res.json({ success: true, data: await service.getPurchaseOrderDetails(req.params.id) }));
exports.update = send(async (req, res) => res.json({ success: true, data: await service.updatePurchaseOrder(req.purchaseOrder, req.body, req.user._id) }));
exports.remove = send(async (req, res) => res.json({ success: true, data: await service.deletePurchaseOrder(req.purchaseOrder, req.user._id) }));
exports.approve = send(async (req, res) => res.json({ success: true, data: await service.approvePurchaseOrder(await service.getPurchaseOrderDocument(req.params.id), req.user._id, req.body.reason) }));
exports.reject = send(async (req, res) => res.json({ success: true, data: await service.rejectPurchaseOrder(await service.getPurchaseOrderDocument(req.params.id), req.user._id, req.body.reason) }));
