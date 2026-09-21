'use strict';

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary only if the configuration variables are present
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
}

/**
 * Uploads an invoice PDF buffer to Cloudinary.
 * If Cloudinary is not configured or we are in a test environment, it returns a mock response.
 * 
 * @param {string} invoiceId - The ID of the invoice
 * @param {Buffer} pdfBuffer - The generated PDF buffer
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string }>}
 */
const uploadInvoicePdf = async (invoiceId, pdfBuffer) => {
  const isMock = !cloudName || !apiKey || !apiSecret || process.env.NODE_ENV === 'test';

  if (isMock) {
    return {
      secure_url: `https://res.cloudinary.com/mock-cloud/raw/upload/v123456789/mock-invoice-${invoiceId}.pdf`,
      public_id: `mock-invoices/mock-invoice-${invoiceId}`,
      resource_type: 'raw'
    };
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kt-crm/invoices',
        public_id: `invoice_${invoiceId}`,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type
        });
      }
    );
    stream.end(pdfBuffer);
  });
};

/**
 * Deletes an invoice PDF from Cloudinary using its public ID.
 * If Cloudinary is not configured or we are in a test environment, it does nothing.
 * 
 * @param {string} publicId - The Cloudinary public ID
 * @param {string} resourceType - The resource type of the asset (e.g. 'image', 'raw')
 * @returns {Promise<{ result: string }>}
 */
const deleteInvoicePdf = async (publicId, resourceType = 'image') => {
  const isMock = !cloudName || !apiKey || !apiSecret || process.env.NODE_ENV === 'test' || !publicId || publicId.startsWith('mock-');

  if (isMock) {
    return { result: 'ok' };
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType || 'image' },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
  });
};

/**
 * Uploads a ledger PDF buffer to Cloudinary.
 * If Cloudinary is not configured or we are in a test environment, it returns a mock response.
 * 
 * @param {string} accountId - The ID of the ledger account
 * @param {Buffer} pdfBuffer - The generated PDF buffer
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string }>}
 */
const uploadLedgerPdf = async (accountId, pdfBuffer) => {
  const isMock = !cloudName || !apiKey || !apiSecret || process.env.NODE_ENV === 'test';

  if (isMock) {
    return {
      secure_url: `https://res.cloudinary.com/mock-cloud/raw/upload/v123456789/mock-ledger-${accountId}.pdf`,
      public_id: `mock-ledgers/mock-ledger-${accountId}`,
      resource_type: 'raw'
    };
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kt-crm/ledger',
        public_id: `ledger_${accountId}_${Date.now()}`,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type
        });
      }
    );
    stream.end(pdfBuffer);
  });
};

/**
 * Uploads a report PDF buffer to Cloudinary.
 * If Cloudinary is not configured or we are in a test environment, it returns a mock response.
 * 
 * @param {string} reportType - The type of report (e.g. 'trial-balance', 'profit-loss', etc.)
 * @param {string} companyId - The ID of the company
 * @param {Buffer} pdfBuffer - The generated PDF buffer
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string }>}
 */
const uploadReportPdf = async (reportType, companyId, pdfBuffer) => {
  const isMock = !cloudName || !apiKey || !apiSecret || process.env.NODE_ENV === 'test';

  if (isMock) {
    return {
      secure_url: `https://res.cloudinary.com/mock-cloud/raw/upload/v123456789/mock-report-${reportType}-${companyId}.pdf`,
      public_id: `mock-reports/mock-report-${reportType}-${companyId}`,
      resource_type: 'raw'
    };
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kt-crm/reports',
        public_id: `report_${reportType}_${companyId}_${Date.now()}`,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type
        });
      }
    );
    stream.end(pdfBuffer);
  });
};

/**
 * Uploads a company logo buffer to Cloudinary.
 * If Cloudinary is not configured or we are in a test environment, it returns a mock response.
 * 
 * @param {string} companyId - The ID of the company
 * @param {Buffer} logoBuffer - The image logo buffer
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string }>}
 */
const uploadCompanyLogo = async (companyId, logoBuffer) => {
  const isMock = !cloudName || !apiKey || !apiSecret || process.env.NODE_ENV === 'test';

  if (isMock) {
    return {
      secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/v123456789/mock-logo-${companyId}.png`,
      public_id: `mock-logos/mock-logo-${companyId}`,
      resource_type: 'image'
    };
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kt-crm/logos',
        public_id: `logo_${companyId}_${Date.now()}`,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type
        });
      }
    );
    stream.end(logoBuffer);
  });
};

module.exports = {
  uploadInvoicePdf,
  deleteInvoicePdf,
  uploadLedgerPdf,
  uploadReportPdf,
  uploadCompanyLogo
};
