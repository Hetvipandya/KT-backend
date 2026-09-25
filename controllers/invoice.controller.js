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

exports.downloadPrintableInvoice = send(async (req, res) => {
  const targetId = req.params.id || req.query.id || req.query.invoiceId;
  if (!targetId || !require('mongoose').Types.ObjectId.isValid(targetId)) {
    return res.status(400).send('<h3>Invalid or missing Invoice ID</h3>');
  }

  const Invoice = require('../models/Invoice');
  const Company = require('../models/Company');
  const Customer = require('../models/Customer');
  const invoiceRenderService = require('../services/invoiceRenderService');

  const invoice = await Invoice.findById(targetId).populate('customerId').lean();
  if (!invoice) {
    return res.status(404).send('<h3>Invoice not found</h3>');
  }

  const [companyDoc, customerDoc] = await Promise.all([
    Company.findById(invoice.companyId).lean(),
    Customer.findById(invoice.customerId?._id || invoice.customerId).lean()
  ]);

  let companyData = companyDoc || {
    name: "KEVALON TECHNOLOGY",
    companyName: "KEVALON TECHNOLOGY",
    address: "913, Solaris Business Hub, Near Parshwanath Jain Temple BRTS, Ahmedabad, Gujarat - 380061",
    phone: "9725247990",
    email: "sales@kevalontechnology.in",
    gstin: "24BQSPH0154B1Z9",
    pan: "BQSPH0154"
  };

  if (companyData.name && companyData.name.toLowerCase().includes('tapzy')) {
    companyData.name = 'KEVALON TECHNOLOGY';
    companyData.companyName = 'KEVALON TECHNOLOGY';
    companyData.address = '913, Solaris Business Hub, Near Parshwanath Jain Temple BRTS, Ahmedabad, Gujarat - 380061';
    companyData.email = 'sales@kevalontechnology.in';
    companyData.phone = '9725247990';
  }

  const customerData = customerDoc || (invoice.customerId && typeof invoice.customerId === 'object' ? invoice.customerId : {
    name: invoice.customerName || "Customer"
  });

  const html = invoiceRenderService.renderInvoiceHtml(invoice, companyData, customerData);

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

