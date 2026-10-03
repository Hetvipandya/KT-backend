const express = require('express');
const controller = require('../controllers/debitNote.controller');
const {
  createDebitNoteSchema,
  debitNoteQuerySchema,
  validateBody,
  validateQuery
} = require('../validators/note.validators');

const router = express.Router();

// POST /api/debit-note  — create a new debit note (companyId + branchId required)
router.post('/', validateBody(createDebitNoteSchema), controller.create);

// GET  /api/debit-note  — list debit notes (companyId required, branchId optional)
router.get('/', validateQuery(debitNoteQuerySchema), controller.list);

module.exports = router;
