const Product = require('../models/Product');
const productService = require('../services/product.service');

/**
 * Helper to serialize a product document for response envelopes
 */
const serializeProduct = (product) => {
  const item = typeof product.toObject === 'function' ? product.toObject() : product;
  return {
    id: item._id,
    companyId: item.companyId,
    name: item.name,
    code: item.code || null,
    description: item.description || '',
    type: item.type,
    saleRate: item.saleRate,
    purchaseRate: item.purchaseRate,
    taxRateId: item.taxRateId || null,
    gstRate: item.gstRate,
    hsnSacCode: item.hsnSacCode || '',
    isStockItem: item.isStockItem,
    unitOfMeasure: item.unitOfMeasure,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
};

/**
 * POST /api/product
 * Create a new product/service
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      companyId,
      name,
      code,
      description,
      type,
      saleRate,
      purchaseRate,
      taxRateId,
      gstRate,
      hsnSacCode,
      isStockItem,
      unitOfMeasure
    } = req.body;

    // Resolve taxRateId and gstRate
    let resolvedTaxRateId = taxRateId || null;
    let resolvedGstRate = gstRate || 0;

    if (resolvedTaxRateId) {
      await productService.validateTaxRate(resolvedTaxRateId, companyId);
      const Tax = require('../models/Tax');
      const tax = await Tax.findOne({ _id: resolvedTaxRateId, companyId, isActive: true });
      if (tax) {
        resolvedGstRate = tax.ratePercent;
      }
    } else if (resolvedGstRate) {
      const Tax = require('../models/Tax');
      const tax = await Tax.findOne({ companyId, ratePercent: resolvedGstRate, isActive: true });
      if (tax) {
        resolvedTaxRateId = tax._id;
      }
    }

    // Validate code uniqueness if provided
    if (code) {
      await productService.validateProductCodeUniqueness(companyId, code);
    }

    const finalType = type || 'PRODUCT';
    const finalIsStockItem = finalType === 'SERVICE' ? false : (isStockItem !== undefined ? isStockItem : true);

    const branchId = req.branchId || (req.body && req.body.branchId) || (req.user && req.user.branchId) || null;

    const product = await Product.create({
      companyId,
      branchId,
      name,
      code: code || null,
      description: description || '',
      type: finalType,
      saleRate: saleRate || 0,
      purchaseRate: purchaseRate || 0,
      taxRateId: resolvedTaxRateId,
      gstRate: resolvedGstRate,
      hsnSacCode: hsnSacCode || '',
      isStockItem: finalIsStockItem,
      unitOfMeasure: unitOfMeasure || 'NOS',
      isActive: true,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const { notify } = require('../utils/sendNotification');
    notify({
      userId: req.user?._id,
      companyId,
      type: 'PRODUCT_CREATED',
      title: 'New Product Created',
      message: `Product "${product.name}" (${product.code || 'No Code'}) was added successfully.`,
      meta: { productId: product._id.toString() }
    });

    return res.status(201).json({
      success: true,
      data: serializeProduct(product)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/product
 * List all products for a company with filters & search
 */
const listProducts = async (req, res, next) => {
  try {
    const { companyId, search, type, isActive, includeInactive, page, limit } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID query parameter is required',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    const filter = { companyId };
    if (req.branchId) filter.branchId = req.branchId;

    if (type) {
      filter.type = type;
    }

    // Handle isActive filters
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    // Handle search query
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex }
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skipNum = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        companyId,
        items: items.map(serializeProduct),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/product/:id
 * Retrieve details of a single product
 */
const getProductById = async (req, res, next) => {
  try {
    // req.product is loaded & cached by companyAccess middleware
    return res.status(200).json({
      success: true,
      data: serializeProduct(req.product)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/product/:id
 * Update product/service details
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = req.product; // cached by middleware
    const updates = req.body;

    if ('companyId' in updates) {
      return res.status(400).json({
        success: false,
        message: 'companyId cannot be modified after creation',
        errorCode: 'IMMUTABLE_FIELD'
      });
    }

    // Resolve taxRateId and gstRate on update
    let resolvedTaxRateId = updates.taxRateId !== undefined ? (updates.taxRateId || null) : (product.taxRateId ? product.taxRateId.toString() : null);
    let resolvedGstRate = updates.gstRate !== undefined ? updates.gstRate : product.gstRate;

    if (updates.taxRateId !== undefined && updates.taxRateId !== (product.taxRateId ? product.taxRateId.toString() : null)) {
      if (updates.taxRateId) {
        await productService.validateTaxRate(updates.taxRateId, product.companyId);
        const Tax = require('../models/Tax');
        const tax = await Tax.findOne({ _id: updates.taxRateId, companyId: product.companyId, isActive: true });
        if (tax) {
          resolvedGstRate = tax.ratePercent;
        }
      } else {
        resolvedGstRate = 0;
      }
      product.taxRateId = updates.taxRateId || null;
      product.gstRate = resolvedGstRate;
    } else if (updates.gstRate !== undefined && updates.gstRate !== product.gstRate) {
      if (updates.gstRate) {
        const Tax = require('../models/Tax');
        const tax = await Tax.findOne({ companyId: product.companyId, ratePercent: updates.gstRate, isActive: true });
        if (tax) {
          resolvedTaxRateId = tax._id;
        } else {
          resolvedTaxRateId = null;
        }
      } else {
        resolvedTaxRateId = null;
      }
      product.taxRateId = resolvedTaxRateId;
      product.gstRate = updates.gstRate;
    }

    // Validate product code uniqueness if it has changed
    if (updates.code !== undefined && updates.code !== product.code) {
      await productService.validateProductCodeUniqueness(product.companyId, updates.code, product._id);
      product.code = updates.code || null;
    }

    // Update fields
    if (updates.name !== undefined) product.name = updates.name;
    if (updates.description !== undefined) product.description = updates.description;
    
    if (updates.type !== undefined) {
      product.type = updates.type;
      if (updates.type === 'SERVICE') {
        product.isStockItem = false;
      }
    }
    
    if (updates.saleRate !== undefined) product.saleRate = updates.saleRate;
    if (updates.purchaseRate !== undefined) product.purchaseRate = updates.purchaseRate;
    if (updates.hsnSacCode !== undefined) product.hsnSacCode = updates.hsnSacCode;
    
    if (updates.isStockItem !== undefined) {
      const finalType = updates.type !== undefined ? updates.type : product.type;
      product.isStockItem = finalType === 'SERVICE' ? false : updates.isStockItem;
    }
    
    if (updates.unitOfMeasure !== undefined) product.unitOfMeasure = updates.unitOfMeasure;
    if (updates.isActive !== undefined) product.isActive = updates.isActive;

    product.updatedBy = req.user._id;

    const saved = await product.save();

    return res.status(200).json({
      success: true,
      data: {
        id: saved._id,
        name: saved.name,
        gstRate: saved.gstRate,
        isActive: saved.isActive,
        updatedAt: saved.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/product/:id
 * Soft delete / deactivate product
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = req.product; // cached by middleware

    product.isActive = false;
    product.updatedBy = req.user._id;
    await product.save();

    return res.status(200).json({
      success: true,
      data: {
        id: product._id,
        isActive: product.isActive,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct
};
