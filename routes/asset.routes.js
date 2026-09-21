const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const { createAssetSchema, postDepreciationSchema, disposeAssetSchema } = require('../validators/asset.validators');
const controller = require('../controllers/asset.controller');

const router = express.Router();

// All routes require authentication and company access validation
router.use(authenticate, checkCompanyAccess);

router.post('/', validateRequest(createAssetSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/:id/depreciation', validateRequest(postDepreciationSchema), controller.postDepreciation);
router.post('/:id/dispose', validateRequest(disposeAssetSchema), controller.dispose);

module.exports = router;
