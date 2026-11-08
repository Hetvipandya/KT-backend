const express = require('express');
const router = express.Router();

const ktEmployeeController = require('../controllers/employeeController');
const finEmployeeController = require('../controllers/employee.controller');
const upload = require('../middleware/uploadMiddleware');
const authenticate = require('../middleware/authenticate');
const access = require('../middleware/companyAccess');
const validate = require('../middleware/validateRequest');
const {
  createEmployeeSchema,
  updateEmployeeSchema,  
  employeeQuerySchema, 
  validateQuery
} = require('../validators/employee.validators');

const employeeDocuments = upload.fields([
  { name: "aadharCard", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
  { name: "resume", maxCount: 1 },
  { name: "offerLetter", maxCount: 1 },
  { name: "joiningLetter", maxCount: 1 },
  { name: "certificates", maxCount: 10 },
]);

// ================= KT HRMS EMPLOYEE ENDPOINTS =================
router.put('/assign-tl/:id', ktEmployeeController.assignTeamLead);
router.put('/remove-tl/:id', ktEmployeeController.removeTeamLead);
router.post('/add', employeeDocuments, ktEmployeeController.addEmployee);
router.get('/list', ktEmployeeController.getEmployeeList);
router.get('/history', ktEmployeeController.getAllEmployeeHistory);
router.get('/documents', ktEmployeeController.getAllEmployeeDocuments);
router.get('/documents/:employeeId', ktEmployeeController.getEmployeeDocuments);
router.get('/profile/:id', ktEmployeeController.getEmployeeProfile);
router.put('/lifecycle/:id', ktEmployeeController.updateEmployeeLifecycle);
router.put('/update/:id', ktEmployeeController.updateEmployee);
router.put('/edit/:id', employeeDocuments, ktEmployeeController.editEmployee);
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const requireAdminOrHr = [
  protect,
  authorizeRoles('admin', 'hr', 'super admin')
];

// ================= DEACTIVATION & REACTIVATION ENDPOINTS =================
router.post('/:id/deactivate', requireAdminOrHr, ktEmployeeController.deactivateEmployee);
router.put('/:id/deactivate', requireAdminOrHr, ktEmployeeController.deactivateEmployee);
router.patch('/:id/deactivate', requireAdminOrHr, ktEmployeeController.deactivateEmployee);
router.put('/deactivate/:id', requireAdminOrHr, ktEmployeeController.deactivateEmployee);

router.post('/:id/reactivate', requireAdminOrHr, ktEmployeeController.reactivateEmployee);
router.put('/:id/reactivate', requireAdminOrHr, ktEmployeeController.reactivateEmployee);
router.patch('/:id/reactivate', requireAdminOrHr, ktEmployeeController.reactivateEmployee);
router.put('/reactivate/:id', requireAdminOrHr, ktEmployeeController.reactivateEmployee);

// Soft-delete routes (backward compatible with legacy delete calls)
router.delete('/delete/:id', requireAdminOrHr, ktEmployeeController.deleteEmployee);
router.delete('/remove/:id', requireAdminOrHr, ktEmployeeController.removeEmployee);
router.delete('/hard-delete/:id', protect, authorizeRoles('super admin'), ktEmployeeController.hardDeleteEmployee);
router.delete('/:id', requireAdminOrHr, ktEmployeeController.deleteEmployee);


// ================= FINANCE EMPLOYEE ENDPOINTS =================
router.post('/', authenticate, validate(createEmployeeSchema), access, finEmployeeController.create);
router.get('/', authenticate, validateQuery(employeeQuerySchema), access, finEmployeeController.list);

// General ID fallback routes
router.get('/:id', authenticate, access, async (req, res, next) => {
  try {
    return await finEmployeeController.get(req, res, next);
  } catch (err) {
    return ktEmployeeController.getEmployeeProfile(req, res, next);
  }
});

router.put('/:id', authenticate, (req, res, next) => {
  if (req.header('x-company-id') || req.query?.companyId || req.body?.companyId) {
    return validate(updateEmployeeSchema)(req, res, () => {
      return access(req, res, () => {
        return finEmployeeController.update(req, res, next);
      });
    });
  }
  return ktEmployeeController.updateEmployee(req, res, next);
});

module.exports = router;
