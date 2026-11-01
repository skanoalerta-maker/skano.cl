"use strict";

import { auth, app } from "./store-firebase.js";
import {
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updatePassword,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// SKANO_OWNER_ACCESS_V1: el permiso se verifica en Cloud Functions, nunca por email.
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js";
const checkAdminAccess = httpsCallable(getFunctions(app, "us-central1"), "listStoreCategories");
const db = getFirestore(app);
const root = document.getElementById("content");
let user = auth.currentUser;
let profile = null;
let loading = true;
let profileError = false;
let adminAuthorized = false;
let accessSequence = 0;

const route = () => location.hash === "#/cuenta" ||
  location.hash.startsWith("#/cuenta/");

const safe = x => String(x ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const field = (label,name,type="text",value="",required=true) =>
  `<label>${label}<input name="${name}" type="${type}"
   value="${safe(value)}" maxlength="200"
   ${required?'required':''}></label>`;

function message(text) {
  const el = document.getElementById("portal-message");
  if (el) el.textContent = text;
}

function view() {
  if (!route() || !root) return;
  const mode = location.hash.split("/")[2] || "login";

  const brand = `<div class="portal-brand">
    <img src="./assets/skano-logo.png" alt="SKANO">
    <strong>SKANO <span>STORE</span></strong>
    <p>Tu cuenta. Tu seguridad. Tus compras.</p>
  </div>`;

  let content = "";

  if (loading) {
    content = "<p>Comprobando sesión...</p>";
  } else if (profileError) {
    content = '<h2>No se pudo consultar tu perfil</h2><p>Recarga la página para volver a intentarlo. Tus datos no se modificarán.</p>';
  } else if (user && adminAuthorized && mode !== "editar" && mode !== "clave") {
    content = `<h2>Mi cuenta administradora</h2>
      <p class="portal-muted">Tu cuenta tiene acceso administrativo verificado.</p>
      <div class="portal-summary"><b>Administrador SKANO STORE</b><span>${safe(user.email)}</span></div>
      <a class="portal-button" href="#/admin">Entrar al panel de administración</a>
      <a href="#/admin/productos">Gestionar productos reales</a>
      <a href="#/admin/categorias">Gestionar categorías</a>
      <a href="#/">Ir a la tienda</a>
      ${profile ? '<a href="#/cuenta/editar">Editar mis datos</a><a href="#/cuenta/clave">Cambiar contraseña</a>' : ''}
      <button type="button" id="portal-logout" class="portal-secondary">Cerrar sesión</button>`;
  } else if (user && profile && mode !== "editar" && mode !== "clave") {
    const name = profile.accountType === "empresa"
      ? profile.companyName
      : `${profile.firstName} ${profile.lastName}`;

    content = `<h2>Bienvenido a SKANO STORE</h2>
      <p class="portal-muted">Tu sesión está activa.</p>
      <div class="portal-summary">
        <b>${safe(name)}</b>
        <span>${safe(user.email)}</span>
        <span>${profile.accountType === "empresa"
          ? "Cuenta empresa" : "Persona natural"}</span>
      </div>
      <a class="portal-button" href="#/">Ir a la tienda</a>
      <a href="#/cuenta/editar">Editar mis datos</a>
      <a href="#/cuenta/clave">Cambiar contraseña</a>
      <button type="button" id="portal-logout" class="portal-secondary">
        Cerrar sesión
      </button>`;
  } else if (user && profile && mode === "clave") {
    content = `<h2>Cambiar contraseña</h2>
      <form id="portal-password">
        ${field("Nueva contraseña","password","password")}
        ${field("Repetir contraseña","confirm","password")}
        <button>Actualizar contraseña</button>
      </form><a href="#/cuenta">Volver</a>`;
  } else if ((user && !profile) || (user && mode === "editar") ||
             (!user && mode === "registro")) {
    const p = profile || {};
    const editing = !!profile;
    content = `<h2>${editing ? "Editar mi perfil" : "Crear cuenta completa"}</h2>
      <p class="portal-muted">Completa tus antecedentes para comprar
      en SKANO STORE.</p>
      <form id="portal-register">
        <h3>Tipo de cliente</h3>
        <div class="portal-types">
          <label><input type="radio" name="accountType" value="persona"
            ${p.accountType !== "empresa"?"checked":""}
            ${editing?"disabled":""}> Persona natural</label>
          <label><input type="radio" name="accountType" value="empresa"
            ${p.accountType === "empresa"?"checked":""}
            ${editing?"disabled":""}> Empresa</label>
        </div>
        <div id="portal-persona">
          ${field("Nombres","firstName","text",p.firstName)}
          ${field("Apellidos","lastName","text",p.lastName)}
          ${field("RUT personal","rut","text",p.rut)}
        </div>
        <div id="portal-empresa">
          ${field("Razón social","companyName","text",p.companyName)}
          ${field("RUT de la empresa","companyRut","text",p.companyRut)}
          ${field("Giro comercial","businessActivity","text",p.businessActivity)}
          ${field("Nombre del contacto","contactName","text",p.contactName)}
        </div>
        <h3>Contacto y despacho</h3>
        ${field("Teléfono","phone","tel",p.phone)}
        ${!user ? field("Correo electrónico","email","email") :
          `<div class="portal-login-status">
  <span class="portal-login-dot"></span>
  <span>Sesión segura activa</span>
</div>`}
        ${field("Región","region","text",p.region)}
        ${field("Comuna","commune","text",p.commune)}
        ${field("Dirección","address","text",p.address)}
        ${field("Casa, departamento u oficina","addressDetail",
                 "text",p.addressDetail,false)}
        ${!user ? `<h3>Contraseña</h3>
          ${field("Contraseña (mínimo 8 caracteres)","password","password")}
          ${field("Repetir contraseña","confirm","password")}` : ""}
        ${!editing ? `<label class="portal-check">
          <input type="checkbox" name="terms" required>
          Acepto los términos y la política de privacidad de SKANO STORE.
        </label>` : ""}
        <button>${editing?"Guardar cambios":"Crear mi cuenta"}</button>
      </form>
      ${user ? '<a href="#/cuenta">Volver a mi cuenta</a>' :
                '<a href="#/cuenta">Ya tengo cuenta</a>'}`;
  } else if (mode === "recuperar") {
    content = `<h2>Recuperar acceso</h2>
      <form id="portal-reset">
        ${field("Correo electrónico","email","email")}
        <button>Enviar enlace de recuperación</button>
      </form><a href="#/cuenta">Volver al ingreso</a>`;
  } else {
    content = `<h2>Ingresa a tu cuenta</h2>
      <p class="portal-muted">Bienvenido a SKANO STORE</p>
      <form id="portal-login">
        ${field("Correo electrónico","email","email")}
        ${field("Contraseña","password","password")}
        <button>Iniciar sesión</button>
      </form>
      <button id="portal-google" type="button" class="portal-secondary">
        Continuar con Google
      </button>
      <div class="portal-links">
        <a href="#/cuenta/registro">Crear cuenta</a>
        <a href="#/cuenta/recuperar">Olvidé mi contraseña</a>
      </div>`;
  }

  root.innerHTML = `<section class="portal-wrap">
    ${brand}
    <div class="portal-card">${content}
      <p id="portal-message" role="status" aria-live="polite"></p>
    </div>
  </section>`;

  document.title = "Mi cuenta | SKANO STORE";

  const radios = root.querySelectorAll('input[name="accountType"]');
  function toggle() {
    const type = root.querySelector('input[name="accountType"]:checked')
      ?.value || profile?.accountType || "persona";

    for (const [id,visible] of [
      ["portal-persona",type==="persona"],
      ["portal-empresa",type==="empresa"]
    ]) {
      const group = document.getElementById(id);
      if (!group) continue;
      group.hidden = !visible;
      group.querySelectorAll("input").forEach(input => {
        input.disabled = !visible;
      });
    }
  }
  radios.forEach(r => r.addEventListener("change",toggle));
  toggle();
}

async function loadProfile() {
  const request = ++accessSequence;
  const current = auth.currentUser;
  user = current;
  profile = null;
  profileError = false;
  adminAuthorized = false;
  loading = true;
  view();
  if (current) {
    const [profileResult, adminResult] = await Promise.allSettled([
      getDoc(doc(db, "store_customers", current.uid)),
      checkAdminAccess()
    ]);
    if (request !== accessSequence || auth.currentUser?.uid !== current.uid) return;
    if (profileResult.status === "fulfilled") {
      profile = profileResult.value.exists() ? profileResult.value.data() : null;
    } else {
      profileError = true;
      console.warn("No se pudo consultar el perfil de cliente.");
    }
    adminAuthorized = adminResult.status === "fulfilled";
    if (!adminAuthorized && adminResult.reason?.code !== "functions/permission-denied") {
      console.warn("No se pudo verificar el acceso de administrador:", adminResult.reason?.code || "sin respuesta");
    }
  }
  if (request !== accessSequence) return;
  loading = false;
  view();
}
onAuthStateChanged(auth, () => { loadProfile(); });
window.addEventListener("hashchange",view);
view();

document.addEventListener("submit",async e => {
  const form=e.target;
  if (!["portal-login","portal-register","portal-reset",
         "portal-password"].includes(form.id)) return;
  e.preventDefault();

  const data=Object.fromEntries(new FormData(form));
  const button=form.querySelector("button");
  button.disabled=true;

  try {
    if (form.id==="portal-login") {
      await signInWithEmailAndPassword(
        auth,data.email.trim(),data.password
      );
      await loadProfile(); if (adminAuthorized) { location.hash = "#/admin"; return; }
      message("Sesión iniciada correctamente.");
    }

    if (form.id==="portal-reset") {
      await sendPasswordResetEmail(auth,data.email.trim());
      message("Si existe la cuenta, revisa su correo para recuperar acceso.");
    }

    if (form.id==="portal-password") {
      if (data.password!==data.confirm || data.password.length<8)
        throw new Error("Las contraseñas deben coincidir y tener 8 caracteres.");
      await updatePassword(auth.currentUser,data.password);
      message("Contraseña cambiada.");
    }

    if (form.id==="portal-register") {
      if(profileError||loading)throw new Error("Consulta tu perfil antes de guardar cambios.");
      const type=data.accountType || profile?.accountType;
      if (!["persona","empresa"].includes(type))
        throw new Error("Selecciona el tipo de cliente.");

      if (!user && (
        data.password!==data.confirm || data.password.length<8
      )) throw new Error("Revisa las contraseñas.");

      if (!user && !data.terms)
        throw new Error("Debes aceptar los términos.");

      if (!user) {
        const result=await createUserWithEmailAndPassword(
          auth,data.email.trim(),data.password
        );
        user=result.user;
      }

      const details={
        accountType:type,
        firstName:data.firstName?.trim()||"",
        lastName:data.lastName?.trim()||"",
        rut:data.rut?.trim()||"",
        companyName:data.companyName?.trim()||"",
        companyRut:data.companyRut?.trim()||"",
        businessActivity:data.businessActivity?.trim()||"",
        contactName:data.contactName?.trim()||"",
        phone:data.phone.trim(),
        email:user.email,
        region:data.region.trim(),
        commune:data.commune.trim(),
        address:data.address.trim(),
        addressDetail:data.addressDetail?.trim()||"",
        updatedAt:serverTimestamp()
      };

      if (profile) {
        await updateDoc(doc(db,"store_customers",user.uid),details);
      } else {
        await setDoc(doc(db,"store_customers",user.uid),{
          ...details,
          createdAt:serverTimestamp(),
          termsAcceptedAt:serverTimestamp()
        });
      }

      await loadProfile();
      location.hash="#/cuenta";
      message("Perfil guardado correctamente.");
    }
  } catch(err) {
    console.error(err);
    message("No se pudo completar: "+(err.code||err.message));
  } finally {
    if(button.isConnected)button.disabled=false;
  }
});

document.addEventListener("click",async e => {
  const button=e.target.closest("button");
  if(!button)return;

  try {
    if(button.id==="portal-logout") {
      await signOut(auth);
      location.hash="#/cuenta";
    }
    if(button.id==="portal-google") {
      await signInWithPopup(auth,new GoogleAuthProvider());
      await loadProfile(); if (adminAuthorized) location.hash = "#/admin";
    }
  } catch(err) {
    message("Error: "+(err.code||err.message));
  }
});
