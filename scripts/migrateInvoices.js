const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI or MONGODB_URI is not defined in .env file.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('Database connected successfully.');

    // Find all invoices where customerName is missing or empty
    const invoices = await Invoice.find({
      $or: [
        { customerName: { $exists: false } },
        { customerName: null },
        { customerName: '' }
      ]
    });

    console.log(`Found ${invoices.length} invoices to update.`);

    let updatedCount = 0;
    for (const invoice of invoices) {
      const customer = await Customer.findById(invoice.customerId);
      if (customer) {
        invoice.customerName = customer.name || customer.customerName;
        // Turn off validation checks for other fields in case schema has updated rules
        await invoice.save({ validateBeforeSave: false });
        updatedCount++;
        console.log(`Updated Invoice ${invoice.invoiceNumber} with customerName: "${invoice.customerName}"`);
      } else {
        console.warn(`Customer not found for Invoice ${invoice.invoiceNumber} (ID: ${invoice._id})`);
      }
    }

    console.log(`Migration completed. ${updatedCount} invoices updated.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
    process.exit(0);
  }
}

run();
