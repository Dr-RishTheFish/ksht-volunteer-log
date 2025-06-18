
// TODO: Add your Firebase project configuration here
// See: https://firebase.google.com/docs/web/setup#available-libraries

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore"; 

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

let app: FirebaseApp | undefined = undefined;
let authInstance: Auth | undefined = undefined;
let dbInstance: Firestore | undefined = undefined;

if (!crucialEnvVarsMissing) {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully.");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      crucialEnvVarsMissing = true; 
    }
  } else {
    app = getApp();
    console.log("Existing Firebase app retrieved.");
  }

  if (app) {
    try {
      authInstance = getAuth(app);
      console.log("Firebase Auth instance retrieved successfully.");
    } catch (error) {
        console.error("Firebase getAuth() error:", error);
        crucialEnvVarsMissing = true; 
    }
    try {
      dbInstance = getFirestore(app); 
      console.log("Firebase Firestore instance retrieved successfully.");
    } catch (error) {
        console.error("Firebase getFirestore() error:", error);
        crucialEnvVarsMissing = true; 
    }
  } else if (!crucialEnvVarsMissing) { 
    console.error("Firebase app instance is undefined after initialization/retrieval attempt, despite no crucial vars reported missing initially.");
    crucialEnvVarsMissing = true;
  }
}

if (crucialEnvVarsMissing) {
  const errorMessage = "Firebase is not configured correctly due to missing crucial environment variables or initialization errors (check console for specifics). Authentication and Firestore features will not work. Please ensure your .env.local file is correctly set up with ALL required NEXT_PUBLIC_ variables and you have restarted your development server.";
  console.error(errorMessage);
  if (typeof window !== 'undefined' && (!authInstance || !dbInstance)) {
    // Optionally, display an error to the user in the UI, though console is primary for dev
  }
} else {
   console.log("Firebase config loaded. Auth and Firestore should be available.");
}


export { app, authInstance as auth, dbInstance as db };

    