const service = require('../services/purchase.service'); const send = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };
exports.create = send(async (req, res) => res.status(201).json({ success: true, data: await service.createPurchase(req.body, req.user._id) }));
exports.list = send(async (req, res) => { const { companyId, ...query } = req.query; res.json({ success: true, data: { companyId, ...(await service.listPurchases(companyId, query)) } }); });
exports.get = send(async (req, res) => res.json({ success: true, data: service.shape(await service.getPurchaseDocument(req.params.id), true) }));
exports.update = send(async (req, res) => res.json({ success: true, data: await service.updatePurchase(await service.getPurchaseDocument(req.params.id), req.body, req.user._id) }));
exports.returnPurchase = send(async (req, res) => res.status(201).json({ success: true, data: await service.createReturn(await service.getPurchaseDocument(req.params.id), req.body, req.user._id) }));
