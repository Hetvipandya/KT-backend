const express = require('express');
const { createCompany, getCompanyDetails, updateCompany, uploadLogo } = require('../controllers/company.controller');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const { createCompanySchema, updateCompanySchema } = require('../validators/company.validators');
const multer = require('multer');

const router = express.Router();
 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // limit 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Apply authentication to all routes in this router
router.use(authenticate);

/**
 * @openapi
 * /api/company:
 *   post:
 *     summary: Create a new company
 *     description: Creates a new company profile, assigns the creator as owner, and associates the user with this company.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - gstin
 *               - pan
 *             properties:
 *               name:
 *                 type: string
 *               gstin:
 *                 type: string
 *               pan:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Company created successfully
 *       400:
 *         description: Validation failed
 *       409:
 *         description: GSTIN or PAN already exists
 */
router.post('/', validateRequest(createCompanySchema), createCompany);

/**
 * @openapi
 * /api/company/{id}:
 *   get:
 *     summary: Get company details
 *     description: Fetches details for the specified company. Access restricted to creator or associated users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Access denied (Data isolation violation)
 *       404:
 *         description: Company not found
 */
router.get('/:id', checkCompanyAccess, getCompanyDetails);

/**
 * @openapi
 * /api/company/{id}:
 *   put:
 *     summary: Update company profile
 *     description: Updates company details. Access restricted to creator or associated users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Company updated successfully
 *       403:
 *         description: Access denied (Data isolation violation)
 *       404:
 *         description: Company not found
 *       409:
 *         description: GSTIN or PAN conflict during update
 */
router.put('/:id', checkCompanyAccess, validateRequest(updateCompanySchema), updateCompany);

// POST /api/company/:id/logo — Upload and save company logo to Cloudinary
router.post(
  '/:id/logo',
  checkCompanyAccess,
  upload.single('logo'),
  (err, req, res, next) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
        errorCode: 'FILE_UPLOAD_ERROR'
      });
    }
    next();
  },
  uploadLogo
);

module.exports = router;
