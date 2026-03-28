import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replaced with project-provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAr-sbTxoPRwwbCcmIMUJU8_KoUA1zcfjk",
  authDomain: "audiostimulator-mhtech.firebaseapp.com",
  projectId: "audiostimulator-mhtech",
  storageBucket: "audiostimulator-mhtech.firebasestorage.app",
  messagingSenderId: "873726071761",
  appId: "1:873726071761:web:6ebc154fef6df8a47e06f0",
  measurementId: "G-BGTVFWR49H"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

// Export the initialized Firebase app in case other modules need it
export { app };
