const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const approvalController = require('../controllers/approval.controller');

router.post('/config', authenticate, approvalController.createOrUpdateConfig);
router.get('/pending', authenticate, approvalController.getPendingApprovals);
router.put('/:id/approve', authenticate, approvalController.approveTask);
router.put('/:id/reject', authenticate, approvalController.rejectTask);
router.get('/:id/history', authenticate, approvalController.getApprovalHistory);

module.exports = router;
