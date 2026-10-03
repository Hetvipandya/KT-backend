const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const { createSupplierSchema, updateSupplierSchema } = require('../validators/supplier.validators');
const controller = require('../controllers/supplier.controller');

const router = express.Router();

router.use(authenticate);
router.post('/', validateRequest(createSupplierSchema), checkCompanyAccess, controller.createSupplier);
router.get('/', checkCompanyAccess, controller.listSuppliers);
router.get('/:id/ledger', checkCompanyAccess, controller.getSupplierLedger);
router.get('/:id', checkCompanyAccess, controller.getSupplier);
router.put('/:id', validateRequest(updateSupplierSchema), checkCompanyAccess, controller.updateSupplier);
router.delete('/:id', checkCompanyAccess, controller.deleteSupplier);

module.exports = router;
