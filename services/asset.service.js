const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const ChartOfAccount = require('../models/ChartOfAccount');
const FinancialYear = require('../models/FinancialYear');
const coaService = require('./coa.service');
const journalService = require('./journalEntry.service');

const serviceError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

// Helper to resolve/create dynamic COA accounts
const getOrCreateAccount = async ({ companyId, name, type, parentCode, defaultCode, parentName, userId }) => {
  // Try to find existing account with the exact name or code for this company
  let account = await ChartOfAccount.findOne({ companyId, name, isGroup: false });
  if (account) return account._id;

  // Find parent group
  const parent = await ChartOfAccount.findOne({ companyId, code: parentCode, isGroup: true });
  const parentId = parent ? parent._id : null;

  // Generate next code
  const code = await coaService.generateNextCode(companyId, type);

  account = await ChartOfAccount.create({
    companyId,
    name,
    type,
    isGroup: false,
    code,
    parentId,
    isActive: true,
    openingBalance: 0,
    openingBalanceType: type === 'Asset' || type === 'Expense' ? 'Dr' : 'Cr',
    createdBy: userId,
    updatedBy: userId
  });

  return account._id;
};

const createAsset = async (data, userId) => {
  const purchaseDate = new Date(data.purchaseDate);

  // Validate financial year
  if (!mongoose.isValidObjectId(data.financialYearId)) {
    throw serviceError('Financial year not found', 404, 'FINANCIAL_YEAR_NOT_FOUND');
  }
  const fy = await FinancialYear.findById(data.financialYearId);
  if (!fy || fy.companyId.toString() !== data.companyId.toString()) {
    throw serviceError('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  }
  if (fy.isLocked) {
    throw serviceError('Cannot create asset in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  }
  if (purchaseDate < fy.startDate || purchaseDate > fy.endDate) {
    throw serviceError('purchaseDate must fall within the selected financial year', 400, 'PURCHASE_DATE_OUTSIDE_FINANCIAL_YEAR');
  }

  // Check unique assetCode per company
  const existing = await Asset.findOne({ companyId: data.companyId, assetCode: data.assetCode });
  if (existing) {
    throw serviceError('Asset code already exists for this company', 409, 'DUPLICATE_ASSET_CODE');
  }

  // Resolve COA accounts (create if not provided)
  const coaAssetAccountId = data.coaAssetAccountId || await getOrCreateAccount({
    companyId: data.companyId,
    name: `Asset - ${data.assetName}`,
    type: 'Asset',
    parentCode: '1100', // Fixed Assets
    parentName: 'Fixed Assets',
    userId
  });

  const coaDepreciationExpenseAccountId = data.coaDepreciationExpenseAccountId || await getOrCreateAccount({
    companyId: data.companyId,
    name: 'Depreciation Expense',
    type: 'Expense',
    parentCode: '5200', // Indirect Expenses
    parentName: 'Indirect Expenses',
    userId
  });

  const coaAccumulatedDepreciationAccountId = data.coaAccumulatedDepreciationAccountId || await getOrCreateAccount({
    companyId: data.companyId,
    name: `Accumulated Depreciation - ${data.assetName}`,
    type: 'Asset',
    parentCode: '1100', // Fixed Assets
    parentName: 'Fixed Assets',
    userId
  });

  const asset = await Asset.create({
    ...data,
    purchaseDate,
    coaAssetAccountId,
    coaDepreciationExpenseAccountId,
    coaAccumulatedDepreciationAccountId,
    bookValue: data.purchaseCost,
    status: 'ACTIVE',
    createdBy: userId,
    updatedBy: userId
  });

  return asset;
};

const getAssetDetails = async (id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return Asset.findById(id)
    .populate('coaAssetAccountId', 'name code')
    .populate('coaDepreciationExpenseAccountId', 'name code')
    .populate('coaAccumulatedDepreciationAccountId', 'name code')
    .populate('disposalDetails.coaGainLossAccountId', 'name code')
    .lean();
};

const listAssets = async (companyId, query = {}) => {
  const filter = { companyId };
  if (query.branchId) filter.branchId = query.branchId;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { assetName: new RegExp(query.search, 'i') },
      { assetCode: new RegExp(query.search, 'i') }
    ];
  }
  return Asset.find(filter).sort({ createdAt: -1 }).lean();
};

const postDepreciation = async (assetId, data, userId) => {
  const depreciationDate = new Date(data.depreciationDate);

  if (!mongoose.isValidObjectId(assetId)) {
    throw serviceError('Asset not found', 404, 'ASSET_NOT_FOUND');
  }
  const asset = await Asset.findById(assetId);
  if (!asset || asset.companyId.toString() !== data.companyId.toString()) {
    throw serviceError('Asset not found', 404, 'ASSET_NOT_FOUND');
  }

  if (asset.status !== 'ACTIVE') {
    throw serviceError('Depreciation can only be posted for active assets', 400, 'ASSET_NOT_ACTIVE');
  }

  // Validate financial year
  if (!mongoose.isValidObjectId(data.financialYearId)) {
    throw serviceError('Financial year not found', 404, 'FINANCIAL_YEAR_NOT_FOUND');
  }
  const fy = await FinancialYear.findById(data.financialYearId);
  if (!fy || fy.companyId.toString() !== data.companyId.toString()) {
    throw serviceError('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  }
  if (fy.isLocked) {
    throw serviceError('Cannot post depreciation in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  }
  if (depreciationDate < fy.startDate || depreciationDate > fy.endDate) {
    throw serviceError('depreciationDate must fall within the selected financial year', 400, 'DEPRECIATION_DATE_OUTSIDE_FINANCIAL_YEAR');
  }

  const maxDepreciation = asset.bookValue - asset.salvageValue;
  if (data.depreciationAmount - maxDepreciation > 0.0001) {
    throw serviceError('Depreciation amount exceeds maximum allowable depreciation', 400, 'DEPRECIATION_EXCEEDS_BOOK_VALUE');
  }

  // Create balanced journal entry
  // Debit Depreciation Expense, Credit Accumulated Depreciation
  const entry = await journalService.createJournalEntry({
    companyId: data.companyId,
    financialYearId: data.financialYearId,
    entryDate: depreciationDate,
    reference: `DEP-${asset.assetCode}`,
    narration: `Depreciation posting for asset ${asset.assetName} (${asset.assetCode})`,
    lines: [
      {
        accountId: asset.coaDepreciationExpenseAccountId,
        debit: data.depreciationAmount,
        credit: 0,
        remarks: 'Depreciation expense'
      },
      {
        accountId: asset.coaAccumulatedDepreciationAccountId,
        debit: 0,
        credit: data.depreciationAmount,
        remarks: 'Accumulated depreciation'
      }
    ]
  }, userId);

  // Update bookValue and status
  asset.bookValue = Math.max(asset.salvageValue, asset.bookValue - data.depreciationAmount);
  if (asset.bookValue <= asset.salvageValue + 0.0001) {
    asset.status = 'FULLY_DEPRECIATED';
  }
  asset.updatedBy = userId;
  await asset.save();

  return {
    assetId: asset._id.toString(),
    bookValue: asset.bookValue,
    status: asset.status,
    journalEntryId: entry._id.toString()
  };
};

const disposeAsset = async (assetId, data, userId) => {
  const disposalDate = new Date(data.disposalDate);

  if (!mongoose.isValidObjectId(assetId)) {
    throw serviceError('Asset not found', 404, 'ASSET_NOT_FOUND');
  }
  const asset = await Asset.findById(assetId);
  if (!asset || asset.companyId.toString() !== data.companyId.toString()) {
    throw serviceError('Asset not found', 404, 'ASSET_NOT_FOUND');
  }

  if (asset.status === 'DISPOSED') {
    throw serviceError('Asset has already been disposed', 400, 'ASSET_ALREADY_DISPOSED');
  }

  // Validate financial year
  if (!mongoose.isValidObjectId(data.financialYearId)) {
    throw serviceError('Financial year not found', 404, 'FINANCIAL_YEAR_NOT_FOUND');
  }
  const fy = await FinancialYear.findById(data.financialYearId);
  if (!fy || fy.companyId.toString() !== data.companyId.toString()) {
    throw serviceError('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  }
  if (fy.isLocked) {
    throw serviceError('Cannot dispose asset in a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  }
  if (disposalDate < fy.startDate || disposalDate > fy.endDate) {
    throw serviceError('disposalDate must fall within the selected financial year', 400, 'DISPOSAL_DATE_OUTSIDE_FINANCIAL_YEAR');
  }

  const saleProceeds = data.saleProceeds || 0;
  const gainLossAmount = saleProceeds - asset.bookValue;

  // Resolve Gain/Loss COA Account
  const coaGainLossAccountId = data.coaGainLossAccountId || await getOrCreateAccount({
    companyId: data.companyId,
    name: 'Gain/Loss on Asset Disposal',
    type: 'Expense',
    parentCode: '5200', // Indirect Expenses
    parentName: 'Indirect Expenses',
    userId
  });

  // Resolve Cash/Bank account to debit proceeds
  const cashCoa = await ChartOfAccount.findOne({ companyId: data.companyId, code: '1210', isGroup: false });
  if (saleProceeds > 0 && !cashCoa) {
    throw serviceError('Standard Cash account is unavailable for sale proceeds', 500, 'CASH_ACCOUNT_UNAVAILABLE');
  }

  const accumDepreciation = asset.purchaseCost - asset.bookValue;

  // Create balanced journal entry
  const lines = [
    // 1. Credit original cost of asset
    {
      accountId: asset.coaAssetAccountId,
      debit: 0,
      credit: asset.purchaseCost,
      remarks: 'Remove asset cost'
    }
  ];

  // 2. Debit accumulated depreciation
  if (accumDepreciation > 0.0001) {
    lines.push({
      accountId: asset.coaAccumulatedDepreciationAccountId,
      debit: accumDepreciation,
      credit: 0,
      remarks: 'Reverse accumulated depreciation'
    });
  }

  // 3. Debit cash for sale proceeds
  if (saleProceeds > 0.0001) {
    lines.push({
      accountId: cashCoa._id,
      debit: saleProceeds,
      credit: 0,
      remarks: 'Sale proceeds received'
    });
  }

  // 4. Debit/Credit gain/loss
  if (gainLossAmount > 0.0001) {
    // Gain: Credit Gain/Loss account
    lines.push({
      accountId: coaGainLossAccountId,
      debit: 0,
      credit: gainLossAmount,
      remarks: 'Gain on asset sale'
    });
  } else if (gainLossAmount < -0.0001) {
    // Loss: Debit Gain/Loss account
    lines.push({
      accountId: coaGainLossAccountId,
      debit: Math.abs(gainLossAmount),
      credit: 0,
      remarks: 'Loss on asset disposal'
    });
  }

  const entry = await journalService.createJournalEntry({
    companyId: data.companyId,
    financialYearId: data.financialYearId,
    entryDate: disposalDate,
    reference: `DISP-${asset.assetCode}`,
    narration: `Asset disposal: ${asset.assetName} (${asset.assetCode}) - ${data.disposalType}`,
    lines
  }, userId);

  // Update asset disposal info and status
  asset.status = 'DISPOSED';
  asset.bookValue = 0;
  asset.disposalDetails = {
    disposalDate,
    disposalType: data.disposalType,
    saleProceeds,
    coaGainLossAccountId,
    gainLossAmount,
    journalEntryId: entry._id
  };
  asset.updatedBy = userId;
  await asset.save();

  return {
    assetId: asset._id.toString(),
    status: asset.status,
    gainLossAmount,
    journalEntryId: entry._id.toString()
  };
};

module.exports = {
  createAsset,
  getAssetDetails,
  listAssets,
  postDepreciation,
  disposeAsset
};
