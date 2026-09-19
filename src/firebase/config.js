// Firebase Configuration & Service Initializer
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Default Demo Firebase Config (User can replace with their own Firebase credentials in VITE_FIREBASE_* env or runtime setting)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "DEMO_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "aptis-master.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aptis-master",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "aptis-master.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

let db = null;
let isCloudConnected = false;

try {
  if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== "DEMO_API_KEY") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isCloudConnected = true;
    console.log("⚡ Firebase Cloud DB Connected!");
  } else {
    console.log("ℹ️ Cloud API Key not set. Running on local DB Mode (IndexedDB / LocalStorage). All data will stay safely on your computer!");
  }
} catch (e) {
  console.warn("Firebase initialization skipped:", e.message);
}

export { db, isCloudConnected };
