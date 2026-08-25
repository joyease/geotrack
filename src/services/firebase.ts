import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyAETkn9tIEVifMr2_r6oAmW8Sg11eMs_Is",
  authDomain: "geotrack-8e9b4.firebaseapp.com",
  projectId: "geotrack-8e9b4",
  storageBucket: "geotrack-8e9b4.firebasestorage.app",
  messagingSenderId: "133122521568",
  appId: "1:133122521568:web:536e3fd092a052f3995385"
};

// Initialize Firebase (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
