import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJPQW6nfqQl-6l8Evezr3Zt24GzfWWTmM",
  authDomain: "medichain-tracker-2cc96.firebaseapp.com",
  projectId: "medichain-tracker-2cc96",
  storageBucket: "medichain-tracker-2cc96.firebasestorage.app",
  messagingSenderId: "979843131940",
  appId: "1:979843131940:web:638fb463135927fe03c6b1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);