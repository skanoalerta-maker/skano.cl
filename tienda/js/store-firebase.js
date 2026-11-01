import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js";

const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyDu0gzTJeeDROBCgRpPhErVCrb-EM6MZK4",
  authDomain: "skano-store.firebaseapp.com",
  projectId: "skano-store",
  storageBucket: "skano-store.firebasestorage.app",
  messagingSenderId: "172925290102",
  appId: "1:172925290102:web:022aca52ace5d94ed28157",
  measurementId: "G-BPWNDJ87Z4"
});

const app = initializeApp(firebaseConfig, "skano-store-admin");

export { app };

export const auth = getAuth(app);

const functions = getFunctions(app, "us-central1");

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
};

export const storeFunctions = Object.freeze({
  create: httpsCallable(functions, "createStoreProductDraft"),
  list: httpsCallable(functions, "listStoreProductDrafts"),
  update: httpsCallable(functions, "updateStoreProductDraft"),
  verify: httpsCallable(functions, "verifyStoreProduct"),
  publish: httpsCallable(functions, "publishStoreProduct")
});
