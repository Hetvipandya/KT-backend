const https = require('https');
const ledgerService = require('../services/ledger.service');
const ledgerPdfService = require('../services/ledgerPdf.service');
const cloudinaryService = require('../services/cloudinary.service');

const getLedgerHistory = async (req, res, next) => {
  try {
    const data = await ledgerService.getLedgerHistory(req.params.accountId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getLedgerBalance = async (req, res, next) => {
  try {
    const data = await ledgerService.getLedgerBalance(req.params.accountId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getLedgerPdf = async (req, res, next) => {
  try {
    const data = await ledgerService.getLedgerHistory(req.params.accountId, req.query);
    const pdfBuffer = await ledgerPdfService.generateLedgerPdf(data);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ledger_${data.account.code || 'statement'}.pdf"`);

    try {
      const uploadResult = await cloudinaryService.uploadLedgerPdf(req.params.accountId, pdfBuffer);
      
      const hasRealCloudinaryUrl = uploadResult.secure_url && 
                                   uploadResult.secure_url.startsWith('https://res.cloudinary.com/') && 
                                   !uploadResult.secure_url.includes('mock-cloud');

      if (hasRealCloudinaryUrl) {
        https.get(uploadResult.secure_url, (pdfResponse) => {
          if (pdfResponse.statusCode === 200) {
            pdfResponse.pipe(res);
          } else {
            console.error(`Failed to fetch ledger PDF from Cloudinary (status ${pdfResponse.statusCode}), sending local buffer.`);
            res.send(pdfBuffer);
          }
        }).on('error', (err) => {
          console.error('Error fetching ledger PDF from Cloudinary, sending local buffer:', err);
          res.send(pdfBuffer);
        });
      } else {
        res.send(pdfBuffer);
      }
    } catch (uploadError) {
      console.error('Failed to upload ledger PDF to Cloudinary, sending local buffer:', uploadError);
      res.send(pdfBuffer);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getLedgerHistory, getLedgerBalance, getLedgerPdf };
