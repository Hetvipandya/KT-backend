const express = require('express');
const controller = require('../controllers/creditNote.controller');
const {
  createCreditNoteSchema,
  creditNoteQuerySchema,
  validateBody,
  validateQuery
} = require('../validators/note.validators');

const router = express.Router();

// POST /api/credit-note  — create a new credit note (companyId + branchId required)
router.post('/', validateBody(createCreditNoteSchema), controller.create);

// GET  /api/credit-note  — list credit notes (companyId required, branchId optional)
router.get('/', validateQuery(creditNoteQuerySchema), controller.list);

module.exports = router;
