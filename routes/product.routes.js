const express = require('express');
const {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct
} = require('../controllers/product.controller');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const {
  createProductSchema,
  updateProductSchema
} = require('../validators/product.validators');

const router = express.Router();

// Apply JWT authentication globally for all product routes
router.use(authenticate);

// 1. Create a new product/service
router.post(
  '/',
  validateRequest(createProductSchema),
  checkCompanyAccess,
  createProduct
);

// 2. List all products/services
router.get(
  '/',
  checkCompanyAccess,
  listProducts
);

// 3. Single product details
router.get(
  '/:id',
  checkCompanyAccess,
  getProductById
);

// 4. Update product/service details
router.put(
  '/:id',
  checkCompanyAccess,
  validateRequest(updateProductSchema),
  updateProduct
);

// 5. Soft-remove/deactivate product
router.delete(
  '/:id',
  checkCompanyAccess,
  deleteProduct
);

module.exports = router;
