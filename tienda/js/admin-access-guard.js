"use strict";

import { app, auth } from "./store-firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js";

const functions = getFunctions(app, "us-central1");
const checkAdmin = httpsCallable(functions, "listStoreCategories");

const panel = document.getElementById("admin-panel");
const login = document.getElementById("login-panel");
const message = document.getElementById("message");

let revision = 0;

onAuthStateChanged(auth, async user => {
  const current = ++revision;

  panel.hidden = true;

  if (!user) {
    login.hidden = false;
    message.textContent = "";
    return;
  }

  login.hidden = true;
  message.textContent = "Verificando acceso exclusivo a SKANO STORE...";

  try {
    // Esta funcion exige permisos de administrador en el servidor.
    await checkAdmin();

    if (current !== revision ||
        auth.currentUser?.uid !== user.uid) return;

    panel.hidden = false;
    message.textContent = "Acceso administrativo autorizado.";

    document.getElementById("refresh")?.click();

  } catch (error) {
    if (current !== revision) return;

    panel.hidden = true;

    const code = String(error.code || "");

    message.textContent =
      code.includes("permission-denied") ||
      code.includes("unauthenticated")
        ? "Esta cuenta no tiene acceso administrativo."
        : "No se pudo verificar el acceso: " +
          (error.message || "Error de conexion");
  }
});