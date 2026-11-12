const ChartOfAccount = require('../models/ChartOfAccount');
const coaService = require('./coa.service');

const ACCOUNT_CONFIG = {
  Expense: {
    parentCode: '5200',
    parentName: 'Indirect Expenses',
    fallbackGroupName: 'Auto-mapped Expenses',
    balanceType: 'Dr',
  },
  Income: {
    parentCode: '4100',
    parentName: 'Direct Income',
    fallbackGroupName: 'Auto-mapped Income',
    balanceType: 'Cr',
  },
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findMappedAccount = async (companyId, mappingKey) => {
  const account = await ChartOfAccount.findOne({
    companyId,
    autoMapKey: mappingKey,
    isGroup: false,
  });
  if (account && account.isActive === false) {
    const error = new Error(`The mapped COA account "${account.name}" is inactive. Reactivate it before posting.`);
    error.statusCode = 409;
    error.errorCode = 'MAPPED_ACCOUNT_INACTIVE';
    throw error;
  }
  return account;
};

const createWithGeneratedCode = async (companyId, type, details, findExisting) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await findExisting();
    if (existing) return existing;
    const code = await coaService.generateNextCode(companyId, type);
    try {
      return await ChartOfAccount.create({
        ...details,
        companyId,
        branchId: null,
        code,
        type,
        isActive: true,
        openingBalance: 0,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const mapped = await findExisting();
      if (mapped) return mapped;
      if (attempt === 4) throw error;
    }
  }
  throw new Error('Unable to allocate a unique COA account code.');
};

const ensureParentGroup = async (companyId, type) => {
  const config = ACCOUNT_CONFIG[type];
  if (!config) throw new Error(`Unsupported automatic COA account type: ${type}`);

  const standardParent = await ChartOfAccount.findOne({
    companyId,
    branchId: null,
    code: config.parentCode,
    type,
    isGroup: true,
    isActive: true,
  });
  if (standardParent) return standardParent;

  let root = await ChartOfAccount.findOne({
    companyId,
    branchId: null,
    type,
    isGroup: true,
    parentId: null,
    isActive: true,
  });
  if (!root) {
    root = await createWithGeneratedCode(
      companyId,
      type,
      {
        name: type === 'Expense' ? 'Expenses' : 'Income',
        isGroup: true,
        parentId: null,
        openingBalanceType: config.balanceType,
        isSystemAccount: false,
      },
      () => ChartOfAccount.findOne({
        companyId,
        branchId: null,
        type,
        isGroup: true,
        parentId: null,
        isActive: true,
      })
    );
  }

  return createWithGeneratedCode(
    companyId,
    type,
    {
      name: config.fallbackGroupName,
      isGroup: true,
      parentId: root._id,
      openingBalanceType: config.balanceType,
      isSystemAccount: false,
    },
    () => ChartOfAccount.findOne({
      companyId,
      branchId: null,
      type,
      isGroup: true,
      parentId: root._id,
      name: new RegExp(`^${escapeRegex(config.fallbackGroupName)}$`, 'i'),
      isActive: true,
    })
  );
};

const ensureMappedLedger = async ({ companyId, type, name, mappingKey }) => {
  const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!normalizedName) {
    const error = new Error(`${type} account name is required for automatic COA mapping.`);
    error.statusCode = 400;
    error.errorCode = 'COA_MAPPING_NAME_REQUIRED';
    throw error;
  }

  const accountKey = mappingKey || `${type.toLowerCase()}:${normalizedName.toLowerCase()}`;
  const mappedAccount = await findMappedAccount(companyId, accountKey);
  if (mappedAccount) return mappedAccount;

  const config = ACCOUNT_CONFIG[type];
  if (!config) throw new Error(`Unsupported automatic COA account type: ${type}`);
  const parent = await ensureParentGroup(companyId, type);
  const nameQuery = {
    companyId,
    branchId: null,
    type,
    isGroup: false,
    parentId: parent._id,
    name: new RegExp(`^${escapeRegex(normalizedName)}$`, 'i'),
  };
  const existingByName = await ChartOfAccount.findOne(nameQuery);
  if (existingByName) {
    if (existingByName.isActive === false) {
      const error = new Error(`The matching COA account "${existingByName.name}" is inactive. Reactivate it before posting.`);
      error.statusCode = 409;
      error.errorCode = 'MAPPED_ACCOUNT_INACTIVE';
      throw error;
    }
    if (!existingByName.autoMapKey) {
      existingByName.autoMapKey = accountKey;
      try {
        await existingByName.save();
      } catch (error) {
        if (error.code !== 11000) throw error;
        const mapped = await findMappedAccount(companyId, accountKey);
        if (mapped) return mapped;
        throw error;
      }
    }
    return existingByName;
  }

  return createWithGeneratedCode(
    companyId,
    type,
    {
      name: normalizedName,
      isGroup: false,
      parentId: parent._id,
      openingBalanceType: config.balanceType,
      isSystemAccount: false,
      autoMapKey: accountKey,
    },
    async () => (await findMappedAccount(companyId, accountKey)) ||
      ChartOfAccount.findOne({ ...nameQuery, isActive: true })
  );
};

const ensureExpenseLedger = (companyId, category) => ensureMappedLedger({
  companyId,
  type: 'Expense',
  name: category,
  mappingKey: `expense:${String(category || '').trim().replace(/\s+/g, ' ').toLowerCase()}`,
});

const ensureIncomeLedger = (companyId, name, mappingKey) => ensureMappedLedger({
  companyId,
  type: 'Income',
  name,
  mappingKey: mappingKey || `income:${String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()}`,
});

module.exports = {
  ensureExpenseLedger,
  ensureIncomeLedger,
};
