const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('./config/env');
const Leave = require('./models/Leave');

async function checkLeaves() {
  await mongoose.connect(env.MONGODB_URI);
  const leaves = await Leave.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('Total leaves fetched:', leaves.length);
  leaves.forEach(l => {
    console.log(l._id, l.employeeId, l.startDate, '->', l.endDate, 'totalDays:', l.totalDays, 'status:', l.status);
  });
  await mongoose.disconnect();
}
checkLeaves().catch(console.error);
