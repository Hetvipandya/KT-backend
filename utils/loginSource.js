const normalizeLoginSource = (value) => {
  const source = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["web", "browser"].includes(source)) return "web";
  if (["android", "android_app", "app_android"].includes(source)) return "android_app";
  if (["ios", "ios_app", "app_ios"].includes(source)) return "ios_app";
  return null;
};

const getLoginSource = ({ clientPlatform, deviceId, userAgent } = {}) => {
  const explicitSource = normalizeLoginSource(clientPlatform);
  if (explicitSource) return explicitSource;

  const agent = String(userAgent || "").toLowerCase();
  if (/iphone|ipad|ipod/.test(agent) && /cfnetwork|darwin|mobile/.test(agent)) return "ios_app";
  if (/android/.test(agent) && /okhttp|dalvik|flutter|dart|reactnative|react native|cronet/.test(agent)) {
    return "android_app";
  }
  if (deviceId) return /iphone|ipad|ipod/.test(agent) ? "ios_app" : "android_app";
  if (agent) return "web";
  return "unknown";
};

module.exports = { getLoginSource };
