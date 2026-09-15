const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

let firebaseApp = null;
let isInitialized = false;

const initializeFirebase = () => {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    isInitialized = true;
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "⚠️ [Firebase] Credentials missing in environment variables. Push notifications will be disabled until FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are configured."
    );
    return null;
  }

  try {
    // Format private key to handle literal '\n' characters in env string
    let formattedKey = privateKey.trim();
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
      formattedKey = formattedKey.slice(1, -1);
    }
    formattedKey = formattedKey.replace(/\\n/g, "\n");

    firebaseApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
    });

    isInitialized = true;
    console.log("🔥 [Firebase] Admin SDK initialized successfully for project:", projectId);
    return firebaseApp;
  } catch (error) {
    console.error("❌ [Firebase] Initialization error:", error.message);
    isInitialized = false;
    return null;
  }
};

// Attempt initial setup
initializeFirebase();

module.exports = {
  firebaseApp,
  initializeFirebase,
  getMessaging,
  isFirebaseInitialized: () => isInitialized && getApps().length > 0,
};
