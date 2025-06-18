
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
      crucialEnvVarsMissing = true; // Treat as if vars were missing if init fails
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
        crucialEnvVarsMissing = true; // If getAuth fails, something is wrong
    }
  } else {
    // This case should ideally not be reached if initializeApp/getApp logic is sound
    // and no error was thrown by them, but as a safeguard:
    console.error("Firebase app instance is undefined after initialization/retrieval attempt.");
    crucialEnvVarsMissing = true;
  }
}

if (crucialEnvVarsMissing && !auth) {
  console.error("Firebase initialization was skipped or failed due to missing crucial environment variables or other errors. Auth features will not work.");
}


export { app, auth /*, db */ };
