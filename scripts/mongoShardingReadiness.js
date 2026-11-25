require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');

const candidateModels = [
  require('../models/AccountTransfer'),
  require('../models/Alert'),
  require('../models/ApprovalConfig'),
  require('../models/ApprovalTask'),
  require('../models/Asset'),
  require('../models/BankAccount'),
  require('../models/BankReconciliation'),
  require('../models/ChartOfAccount'),
  require('../models/CreditNote'),
  require('../models/DebitNote'),
  require('../models/FinancialYear'),
  require('../models/GSTReturn'),
  require('../models/Income'),
  require('../models/Invoice'),
  require('../models/JournalEntry'),
  require('../models/Lending'),
  require('../models/Loan'),
  require('../models/Payment'),
  require('../models/Product'),
  require('../models/Purchase'),
  require('../models/PurchaseOrder'),
  require('../models/PurchaseReturn'),
  require('../models/Reminder'),
  require('../models/ReminderConfig'),
  require('../models/Salary'),
  require('../models/Supplier'),
  require('../models/SupplierPayment'),
  require('../models/Tax'),
];

const checkData = process.argv.includes('--check-data');
const maxTimeMS = Number(process.env.SHARDING_AUDIT_MAX_TIME_MS || 30000);

const hasCompanyIdPrefix = (key) => {
  const firstKey = Object.entries(key || {})[0];
  return firstKey && firstKey[0] === 'companyId' && firstKey[1] === 1;
};

const schemaBlockers = (model) => {
  const blockers = [];
  const companyIdPath = model.schema.path('companyId');

  if (!companyIdPath || companyIdPath.isRequired !== true) {
    blockers.push('companyId is not required by the schema');
  }

  const indexes = model.schema.indexes();
  if (!indexes.some(([key]) => hasCompanyIdPrefix(key))) {
    blockers.push('schema has no companyId-leading index');
  }

  for (const [key, options] of indexes) {
    if (options.unique && !hasCompanyIdPrefix(key)) {
      blockers.push(`unique index ${Object.keys(key).join('_')} does not start with companyId`);
    }
  }

  return blockers;
};

const inspectStoredData = async (model, database) => {
  const collectionName = model.collection.collectionName;
  const collectionExists = await database.listCollections(
    { name: collectionName },
    { nameOnly: true },
  ).hasNext();

  if (!collectionExists) {
    return { blockers: ['collection does not exist yet'] };
  }

  const collection = database.collection(collectionName);
  const indexes = await collection.indexes();
  const blockers = [];

  if (!indexes.some((index) => hasCompanyIdPrefix(index.key))) {
    blockers.push('database has no companyId-leading index');
  }

  for (const index of indexes) {
    if (index.unique && index.name !== '_id_' && !hasCompanyIdPrefix(index.key)) {
      blockers.push(`unique database index ${index.name} does not start with companyId`);
    }
  }

  const companyIdTypes = await collection.aggregate(
    [
      {
        $group: {
          _id: { $type: '$companyId' },
          documents: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ],
    { maxTimeMS, allowDiskUse: false },
  ).toArray();

  const invalidTypes = companyIdTypes.filter((entry) => entry._id !== 'objectId');
  if (invalidTypes.length > 0) {
    blockers.push(
      `companyId is missing, null, or not an ObjectId in ${invalidTypes
        .map((entry) => `${entry._id}=${entry.documents}`)
        .join(', ')}`,
    );
  }

  return { blockers, companyIdTypes };
};

const run = async () => {
  if (checkData) {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error('Set MONGODB_URI or MONGO_URI before running with --check-data');
    }
    if (!Number.isSafeInteger(maxTimeMS) || maxTimeMS < 1) {
      throw new Error('SHARDING_AUDIT_MAX_TIME_MS must be a positive integer');
    }

    await mongoose.connect(uri, {
      maxPoolSize: 2,
      minPoolSize: 0,
      maxConnecting: 1,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.msg !== 'isdbgrid') {
      throw new Error('--check-data requires a MongoDB mongos connection (Atlas sharded cluster)');
    }

    console.log(`Read-only data check connected to database: ${mongoose.connection.name}`);
    console.log(`Per-collection scan timeout: ${maxTimeMS}ms`);
  } else {
    console.log('Schema-only check; no database connection or data scan was performed.');
    console.log('Run with --check-data during a low-traffic window to inspect stored data and indexes.');
  }

  let blockedCount = 0;
  const database = checkData ? mongoose.connection.db : null;

  for (const model of candidateModels) {
    const blockers = schemaBlockers(model);
    let companyIdTypes = [];

    if (checkData && blockers.length === 0) {
      const stored = await inspectStoredData(model, database);
      blockers.push(...stored.blockers);
      companyIdTypes = stored.companyIdTypes || [];
    }

    if (blockers.length > 0) {
      blockedCount += 1;
      console.log(`[BLOCKED] ${model.collection.collectionName}: ${blockers.join('; ')}`);
      continue;
    }

    console.log(`[READY${checkData ? ' - DATA CHECKED' : ' - SCHEMA ONLY'}] ${model.collection.collectionName}`);
    if (checkData) {
      console.log(`  companyId types: ${companyIdTypes.map((entry) => `${entry._id}=${entry.documents}`).join(', ') || 'empty collection'}`);
      console.log(`  db.adminCommand({ shardCollection: "${mongoose.connection.name}.${model.collection.collectionName}", key: { companyId: 1 } })`);
    }
  }

  if (blockedCount > 0) {
    console.log(`${blockedCount} collection(s) need schema, index, or data remediation before sharding.`);
    process.exitCode = 1;
  } else if (checkData) {
    console.log('All checked collections passed. No sharding commands were executed.');
  }
};

run()
  .catch((error) => {
    console.error(`Sharding readiness check failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
