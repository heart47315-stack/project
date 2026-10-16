import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdnBW6MX0Ca873SaKMsRDSR2Qu52TSrwM",
  authDomain: "medsafe-ai-219de.firebaseapp.com",
  projectId: "medsafe-ai-219de",
  storageBucket: "medsafe-ai-219de.firebasestorage.app",
  messagingSenderId: "1005028701465",
  appId: "1:1005028701465:web:c988eec3a162d388bc8188",
  measurementId: "G-BJ56GFQF1M"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc };