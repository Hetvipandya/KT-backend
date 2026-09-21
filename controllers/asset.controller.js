const service = require('../services/asset.service');

const create = async (req, res, next) => {
  try {
    const asset = await service.createAsset(req.body, req.user._id);
    return res.status(201).json({
      success: true,
      data: asset
    });
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const asset = await service.getAssetDetails(req.params.id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
        errorCode: 'ASSET_NOT_FOUND'
      });
    }
    // Verify company isolation check
    if (asset.companyId.toString() !== req.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this company\'s data',
        errorCode: 'FORBIDDEN'
      });
    }

    return res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const companyId = req.query.companyId || req.company._id.toString();
    const assets = await service.listAssets(companyId, req.query);
    return res.status(200).json({
      success: true,
      data: assets
    });
  } catch (error) {
    next(error);
  }
};

const postDepreciation = async (req, res, next) => {
  try {
    const result = await service.postDepreciation(req.params.id, req.body, req.user._id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const dispose = async (req, res, next) => {
  try {
    const result = await service.disposeAsset(req.params.id, req.body, req.user._id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  get,
  list,
  postDepreciation,
  dispose
};
