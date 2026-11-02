"use strict";

import { auth } from "./store-firebase.js";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const root = document.getElementById("content");
let currentUser = null;

function isAccountRoute() {
  return location.hash === "#/cuenta" ||
    location.hash.startsWith("#/cuenta/") ||
    location.hash === "#/auth" ||
    location.hash.startsWith("#/auth/");
}

function el(tag, attributes = {}, content = "") {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  node.textContent = content;
  return node;
}

function field(label, name, type, extra = "") {
  return `<label style="display:block;margin:14px 0">
    ${label}
    <input name="${name}" type="${type}" ${extra}
      style="display:block;width:100%;padding:13px;margin-top:7px;
      border:1px solid #cad6e7;border-radius:8px">
  </label>`;
}

function status(message) {
  const area = document.getElementById("real-auth-status");
  if (area) area.textContent = message;
}

function renderAccount() {
  if (!isAccountRoute() || !root) return;

  const parts = location.hash.split("/");
  const mode = parts[2] || "login";

  const head = `<div class="heading">
    <span class="eyebrow">CUENTA SKANO STORE</span>
    <h1>${currentUser ? "Mi cuenta" : "Bienvenido a SKANO STORE"}</h1>
    <p>Acceso seguro con Firebase Authentication.</p>
  </div>`;

  let body;

  if (currentUser) {
    body = `
      <section class="panel" style="max-width:560px;margin:25px auto">
        <h2>Sesión iniciada</h2>
        <p>Tu cuenta está activa y puedes navegar por la tienda.</p>
        <a id="skano-go-store" class="button"
           href="#/"
           style="display:block;text-align:center;
           padding:15px;margin:20px 0;text-decoration:none">
          Ir a SKANO STORE
        </a>
        <p id="real-user-email"></p>
        <h3>Cambiar contraseña</h3>
        <form id="real-change-password">
          ${field("Nueva contraseña", "password", "password",
            'required minlength="8" autocomplete="new-password"')}
          ${field("Confirmar contraseña", "confirm", "password",
            'required minlength="8" autocomplete="new-password"')}
          <button class="button">Actualizar contraseña</button>
        </form>
        <button type="button" id="real-logout">Cerrar sesión</button>
        <p>Los pedidos reales estarán disponibles al conectar el checkout.</p>
      </section>`;
  } else if (mode === "registro") {
    body = `
      <section class="panel" style="max-width:560px;margin:25px auto">
        <h2>Crear cuenta</h2>
        <form id="real-register">
          ${field("Correo electrónico", "email", "email",
            'required autocomplete="email"')}
          ${field("Contraseña", "password", "password",
            'required minlength="8" autocomplete="new-password"')}
          ${field("Confirmar contraseña", "confirm", "password",
            'required minlength="8" autocomplete="new-password"')}
          <button class="button">Registrarme en SKANO STORE</button>
        </form>
        <a href="#/cuenta">Ya tengo una cuenta</a>
      </section>`;
  } else if (mode === "recuperar") {
    body = `
      <section class="panel" style="max-width:560px;margin:25px auto">
        <h2>Recuperar contraseña</h2>
        <form id="real-recovery">
          ${field("Correo electrónico", "email", "email",
            'required autocomplete="email"')}
          <button class="button">Enviar correo de recuperación</button>
        </form>
        <a href="#/cuenta">Volver al inicio de sesión</a>
      </section>`;
  } else {
    body = `
      <section class="panel" style="max-width:560px;margin:25px auto">
        <h2>Iniciar sesión</h2>
        <form id="real-login">
          ${field("Correo electrónico", "email", "email",
            'required autocomplete="email"')}
          ${field("Contraseña", "password", "password",
            'required autocomplete="current-password"')}
          <button class="button">Ingresar</button>
        </form>
        <button type="button" id="real-google">
          Continuar con Google
        </button>
        <p><a href="#/cuenta/registro">Crear cuenta</a></p>
        <p><a href="#/cuenta/recuperar">Olvidé mi contraseña</a></p>
      </section>`;
  }

  root.innerHTML = head + body +
    `<p id="real-auth-status" role="status" aria-live="polite"
      style="max-width:560px;margin:20px auto"></p>`;

  if (currentUser) {
    document.getElementById("real-user-email").textContent =
      currentUser.email || "Cuenta Google";
  }

  document.title = "Mi cuenta | SKANO STORE";
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  renderAccount();
});

window.addEventListener("hashchange", renderAccount);
renderAccount();

document.addEventListener("submit", async event => {
  const form = event.target;

  if (![
    "real-register",
    "real-login",
    "real-recovery",
    "real-change-password"
  ].includes(form.id)) return;

  event.preventDefault();

  const button = form.querySelector("button");
  const values = Object.fromEntries(new FormData(form));
  button.disabled = true;

  try {
    if (form.id === "real-register") {
      if (values.password !== values.confirm) {
        throw new Error("Las contraseñas no coinciden.");
      }

      const result = await createUserWithEmailAndPassword(
        auth, values.email.trim(), values.password
      );
      renderAccount();
      status("Cuenta creada correctamente. Ya puedes ingresar a SKANO STORE.");
    }

    if (form.id === "real-login") {
      await signInWithEmailAndPassword(
        auth, values.email.trim(), values.password
      );
      renderAccount();
      status("Sesión iniciada correctamente.");
    }

    if (form.id === "real-recovery") {
      await sendPasswordResetEmail(auth, values.email.trim());
      status("Si existe una cuenta asociada, revisa su correo de recuperación.");
    }

    if (form.id === "real-change-password") {
      if (values.password !== values.confirm) {
        throw new Error("Las contraseñas no coinciden.");
      }
      await updatePassword(auth.currentUser, values.password);
      form.reset();
      status("Contraseña actualizada.");
    }
  } catch (error) {
    const code = error.code || "";
    const messages = {
      "auth/email-already-in-use": "Este correo ya está registrado.",
      "auth/invalid-email": "El correo electrónico no es válido.",
      "auth/weak-password": "La contraseña es demasiado débil.",
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
      "auth/requires-recent-login":
        "Por seguridad debes cerrar sesión y volver a ingresar antes de cambiar la contraseña.",
      "auth/unauthorized-domain":
        "Debes autorizar este dominio en Firebase Authentication."
    };
    status(messages[code] || error.message || "No se completó la operación.");
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

document.addEventListener("click", async event => {
  const button = event.target.closest("button");
  if (!button) return;

  try {
    if (button.id === "real-logout") {
      await signOut(auth);
      renderAccount();
    }

    if (button.id === "real-google") {
      await signInWithPopup(auth, new GoogleAuthProvider());
      renderAccount();
      status("Sesión iniciada con Google.");
    }
  } catch (error) {
    status("No se pudo completar la operación: " +
      (error.code || error.message));
  }
});
