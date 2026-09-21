const https = require('https');
const service = require('../services/invoice.service');
const pdfService = require('../services/invoicePdf.service');
const send = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };
exports.create = send(async (req, res) => res.status(201).json({ success: true, data: await service.createInvoice(req.body, req.user._id) }));
exports.list = send(async (req, res) => {
  const { companyId, ...query } = req.query;
  const result = await service.listInvoices(companyId, query);
  res.json({ success: true, data: { companyId, ...result } });
});
exports.get = send(async (req, res) => {
  const invoice = await service.getInvoice(req.params.id);
  res.json({ success: true, data: service.shape(invoice, true) });
});
exports.update = send(async (req, res) => {
  const invoice = await service.getInvoiceDocument(req.params.id);
  res.json({ success: true, data: await service.updateInvoice(invoice, req.body, req.user._id) });
});
exports.cancel = send(async (req, res) => {
  const invoice = await service.getInvoiceDocument(req.params.id);
  res.json({ success: true, data: await service.cancelInvoice(invoice, req.user._id) });
});
exports.pdf = send(async (req, res) => {
  const invoice = await service.getInvoice(req.params.id);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber || 'invoice'}.pdf"`);

  const hasRealCloudinaryUrl = invoice.pdfUrl && 
                               invoice.pdfUrl.startsWith('https://res.cloudinary.com/') && 
                               !invoice.pdfUrl.includes('mock-cloud');

  if (hasRealCloudinaryUrl) {
    https.get(invoice.pdfUrl, (pdfResponse) => {
      if (pdfResponse.statusCode === 200) {
        pdfResponse.pipe(res);
      } else {
        console.error(`Failed to fetch PDF from Cloudinary (status ${pdfResponse.statusCode}), falling back to local generation.`);
        pdfService.generateInvoicePdf(invoice)
          .then(pdfBuffer => res.send(pdfBuffer))
          .catch(err => {
            if (!res.headersSent) {
              res.status(500).json({ success: false, message: 'Failed to generate PDF' });
            }
          });
      }
    }).on('error', (err) => {
      console.error('Error fetching PDF from Cloudinary, falling back:', err);
      pdfService.generateInvoicePdf(invoice)
        .then(pdfBuffer => res.send(pdfBuffer))
        .catch(error => {
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to generate PDF' });
          }
        });
    });
  } else {
    try {
      const pdfBuffer = await pdfService.generateInvoicePdf(invoice);
      res.send(pdfBuffer);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to generate PDF' });
      }
    }
  }
});
