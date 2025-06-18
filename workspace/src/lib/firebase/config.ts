
// TODO: Add your Firebase project configuration here
// See: https://firebase.google.com/docs/web/setup#available-libraries

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore"; 

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

let crucialEnvVarsMissing = false;

if (!apiKey) {
  console.error("Firebase Config Error: NEXT_PUBLIC_FIREBASE_API_KEY is missing. Check your .env.local file and restart the server.");
  crucialEnvVarsMissing = true;
}
if (!authDomain) {
  console.error("Firebase Config Error: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing. Check your .env.local file and restart the server.");
  crucialEnvVarsMissing = true;
}
if (!projectId) {
  console.error("Firebase Config Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing. Check your .env.local file and restart the server.");
  crucialEnvVarsMissing = true;
}

// Optional vars, don't mark as crucial if missing but good to warn
if (!storageBucket) {
  console.warn("Firebase Config Warning: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing. This might be needed for Firebase Storage features.");
}
if (!messagingSenderId) {
  console.warn("Firebase Config Warning: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing. This might be needed for Firebase Cloud Messaging.");
}
if (!appId) {
  console.warn("Firebase Config Warning: NEXT_PUBLIC_FIREBASE_APP_ID is missing. This might be needed for certain Firebase integrations or analytics.");
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
      console.log("Firebase app initialized successfully (New Instance). Project ID:", projectId);
    } catch (error) {
      console.error("Firebase initialization error:", error);
      console.error("This usually means your Firebase config values in .env.local might be present but incorrect, or the project itself has issues.");
      crucialEnvVarsMissing = true; 
    }
  } else {
    app = getApp(); // Get default app if already initialized
    console.log("Existing Firebase app retrieved. Project ID:", app.options.projectId);
  }

  if (app) {
    try {
      authInstance = getAuth(app);
      console.log("Firebase Auth instance retrieved/initialized successfully.");
    } catch (error) {
        console.error("Firebase getAuth() error:", error);
        crucialEnvVarsMissing = true; 
    }
    try {
      dbInstance = getFirestore(app); 
      console.log("Firebase Firestore instance retrieved/initialized successfully.");
    } catch (error) {
        console.error("Firebase getFirestore() error:", error);
        crucialEnvVarsMissing = true; 
    }
  } else if (!crucialEnvVarsMissing) { 
    // This case should ideally not be reached if crucialEnvVarsMissing was false
    console.error("Firebase app instance is undefined after initialization/retrieval attempt, despite no crucial vars reported missing initially. This is unexpected.");
    crucialEnvVarsMissing = true;
  }
}

if (crucialEnvVarsMissing) {
  const errorMessage = "CRITICAL Firebase Setup Issue: Firebase is not configured correctly, either due to missing/incorrect environment variables (check .env.local and ensure it's loaded by restarting server) or issues initializing Firebase services (see console for specifics). Authentication and Firestore features WILL NOT WORK.";
  console.error(errorMessage);
  // In a real app, you might want to display a more user-friendly message or lock down features
  // if (typeof window !== 'undefined' && (!authInstance || !dbInstance)) {
  //   alert("Firebase is not properly configured. Some features may not work.");
  // }
} else {
   console.log("Firebase config check complete. Auth and Firestore services should be available if enabled in your Firebase project console.");
}


export { app, authInstance as auth, dbInstance as db, GoogleAuthProvider };
