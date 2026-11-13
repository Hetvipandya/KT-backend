const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const {
  READ_ROLES,
  WRITE_ROLES,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require('../middleware/financeAccess');
const { createJournalEntrySchema } = require('../validators/journalEntry.validators');
const journalEntryController = require('../controllers/journalEntry.controller');

const router = express.Router();

router.post('/', authenticate, validateRequest(createJournalEntrySchema), checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(WRITE_ROLES), journalEntryController.createJournalEntry);
router.get('/', authenticate, checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(READ_ROLES), journalEntryController.listJournalEntries);
router.get('/:id', authenticate, journalEntryController.getJournalEntry);
router.delete('/:id', authenticate, journalEntryController.reverseJournalEntry);

module.exports = router;
