const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getMessaging: getFirebaseMessaging } = require('firebase-admin/messaging');

let messagingInstance = null;
let firebaseApp = null;
let isInitialized = false;

const initializeFirebase = () => {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    try {
      messagingInstance = getFirebaseMessaging(firebaseApp);
    } catch (_) {}
    isInitialized = true;
    return firebaseApp;
  }

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_SERVICE_ACCOUNT_PATH
  } = process.env;

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
      firebaseApp = initializeApp({ credential: cert(serviceAccount) });
      messagingInstance = getFirebaseMessaging(firebaseApp);
      isInitialized = true;
      console.log('✅ [Firebase] Admin SDK initialized from service-account file');
      return firebaseApp;
    } catch (err) {
      console.warn('⚠️  [Firebase] Failed to load service-account file:', err.message);
    }
  }

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    try {
      let formattedKey = FIREBASE_PRIVATE_KEY.trim();
      if (formattedKey.endsWith(',')) formattedKey = formattedKey.slice(0, -1).trim();
      if (
        (formattedKey.startsWith('"') && formattedKey.endsWith('"')) ||
        (formattedKey.startsWith("'") && formattedKey.endsWith("'"))
      ) {
        formattedKey = formattedKey.slice(1, -1).trim();
      }
      formattedKey = formattedKey.replace(/\\n/g, '\n').replace(/\r/g, '');

      firebaseApp = initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID.trim(),
          clientEmail: FIREBASE_CLIENT_EMAIL.trim(),
          privateKey: formattedKey
        })
      });
      messagingInstance = getFirebaseMessaging(firebaseApp);
      isInitialized = true;
      console.log('✅ [Firebase] Admin SDK initialized for project:', FIREBASE_PROJECT_ID);
      return firebaseApp;
    } catch (err) {
      console.warn('⚠️  [Firebase] Initialization error:', err.message);
    }
  } else {
    console.warn(
      '⚠️  [Firebase] Credentials not configured. Push notifications will be disabled.'
    );
  }

  return null;
};

// Attempt initial setup
initializeFirebase();

const getMessaging = () => messagingInstance;

module.exports = {
  firebaseApp,
  initializeFirebase,
  getMessaging,
  isFirebaseInitialized: () => isInitialized && getApps().length > 0
};
