
// TODO: Add your Firebase project configuration here
// See: https://firebase.google.com/docs/web/setup#available-libraries

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Will be needed later

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

let crucialEnvVarsMissing = false;

if (!apiKey) {
  console.error("Firebase Error: NEXT_PUBLIC_FIREBASE_API_KEY is missing in your .env.local file. Please add it and restart your development server.");
  crucialEnvVarsMissing = true;
}
if (!authDomain) {
  console.error("Firebase Error: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing in your .env.local file. Please add it and restart your development server.");
  crucialEnvVarsMissing = true;
}
if (!projectId) {
  console.error("Firebase Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in your .env.local file. Please add it and restart your development server.");
  crucialEnvVarsMissing = true;
}
// Optional vars, don't mark as crucial if missing
if (!storageBucket) {
  console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing. This might be needed for Firebase Storage features.");
}
if (!messagingSenderId) {
  console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing. This might be needed for Firebase Cloud Messaging.");
}
if (!appId) {
  console.warn("Firebase Warning: NEXT_PUBLIC_FIREBASE_APP_ID is missing. This might be needed for certain Firebase integrations or analytics.");
}


const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
// let db; // Will be needed later

if (!crucialEnvVarsMissing) {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // If initialization fails, treat as if crucial vars were missing for subsequent logic
      crucialEnvVarsMissing = true; 
    }
  } else {
    app = getApp();
  }

  if (app) {
    try {
      auth = getAuth(app);
      // db = getFirestore(app); // Will be needed later
    } catch (error) {
        console.error("Firebase getAuth() error:", error);
        // If getAuth fails, this is a critical issue
        crucialEnvVarsMissing = true; 
    }
  } else if (!crucialEnvVarsMissing) { 
    // This case implies getApps().length was > 0, but getApp() failed, or initializeApp failed silently
    // and didn't set crucialEnvVarsMissing.
    console.error("Firebase app instance is undefined after initialization/retrieval attempt, despite no crucial vars reported missing initially.");
    crucialEnvVarsMissing = true;
  }
}

if (crucialEnvVarsMissing && typeof window !== 'undefined') {
  // This message is more prominent for client-side issues
  const errorMessage = "Firebase is not configured correctly due to missing crucial environment variables (check console for specifics). Authentication and other Firebase features will not work. Please ensure your .env.local file is correctly set up and you have restarted your development server.";
  console.error(errorMessage);
  // Optionally, you could throw an error here or display a message to the user,
  // but for now, console errors are the primary feedback.
} else if (crucialEnvVarsMissing) {
    console.error("Firebase initialization was skipped or failed due to missing crucial environment variables or other errors (check server console for specifics). Auth features will not work.");
}


export { app, auth /*, db */ };
