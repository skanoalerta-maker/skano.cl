// =====================================================================
// SKANO JUDICIAL — Arranque de Firebase compartido por el panel SUPERADMIN
// (admin/) y el portal empresarial (portal/).
// - Una sola versión del SDK web (SDK_VERSION) para ambos portales.
// - En 127.0.0.1/localhost se conecta SOLO a los emuladores.
// - En un dominio publicado exige configuración completa y App Check
//   (reCAPTCHA Enterprise); si falta algo, el portal no se inicializa.
// - Segundo factor TOTP: inicio de sesión y activación.
// - Sin innerHTML: todo el contenido va por textContent.
// =====================================================================

import { SDK_VERSION, resolveEnvironment, formatTotpSecret, normalizeTotpCode, totpErrorKind, signInErrorText } from "./judicial-env.mjs?v=20261122-2";
export { signInErrorText };
import { qrSvg } from "./qr.mjs?v=20261122-1";

/** Impide usar el portal dentro de un iframe ajeno (clickjacking). */
export function refuseFraming() {
  if (window.top === window.self) return;
  document.documentElement.replaceChildren();
  throw new Error("SKANO: el portal no puede cargarse dentro de un marco.");
}

/**
 * Inicializa Firebase para el host actual. Devuelve null si el entorno está
 * bloqueado (el llamador muestra la pantalla "no habilitado").
 */
export async function bootFirebase(appName) {
  refuseFraming();
  const resolved = resolveEnvironment(location.hostname);
  if (resolved.status !== "ok") return null;
  const env = resolved.env;
  const FB = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-functions.js`),
  ]);
  const config = { apiKey: env.apiKey, authDomain: env.authDomain, projectId: env.projectId };
  if (env.appId) config.appId = env.appId;
  const app = initializeApp(config, appName);
  if (env.stage !== "emulator") {
    // App Check antes de cualquier llamada: el backend lo exige en producción.
    const AC = await import(`${FB}/firebase-app-check.js`);
    AC.initializeAppCheck(app, { provider: new AC.ReCaptchaEnterpriseProvider(env.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  }
  const auth = A.getAuth(app);
  if (env.stage === "emulator") A.connectAuthEmulator(auth, env.authEmulatorUrl, { disableWarnings: true });
  await A.setPersistence(auth, A.browserSessionPersistence);
  auth.languageCode = "es";
  const functions = F.getFunctions(app, env.region);
  if (env.stage === "emulator") F.connectFunctionsEmulator(functions, env.functionsHost, env.functionsPort);
  return { env, app, auth, functions, A, F };
}

// ------------------------------------------------------------ diálogo de código

function node(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

/**
 * Pide un código de 6 dígitos. onCode(code) valida; si lanza un error, se
 * muestra y el diálogo sigue abierto. Resuelve true al validar, false al cancelar.
 */
function codeDialog({ eyebrow, title, lines = [], extra = null, submit, onCode, onFatal = null }) {
  return new Promise((resolve) => {
    const input = node("input", { name: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 7, required: true, "aria-label": "Código de 6 dígitos" });
    const msg = node("p", { class: "message", role: "alert" });
    const ok = node("button", { class: "primary", type: "submit" }, submit);
    const cancel = node("button", { class: "secondary", type: "button" }, "CANCELAR");
    const form = node("form", { class: "modal", method: "dialog", novalidate: true },
      node("p", { class: "eyebrow" }, eyebrow), node("h2", {}, title),
      ...lines.map((l) => node("p", { class: "muted" }, l)), extra,
      node("label", {}, "Código de 6 dígitos", input), msg, node("div", { class: "modal-actions" }, cancel, ok));
    const dlg = node("dialog", { class: "mfa-dialog" }, form);
    let done = false;
    const finish = (value) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(value); };
    cancel.addEventListener("click", () => finish(false));
    dlg.addEventListener("cancel", (ev) => { ev.preventDefault(); finish(false); });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const code = normalizeTotpCode(input.value);
      if (!code) { msg.textContent = "Ingresa los 6 dígitos que muestra tu aplicación."; return; }
      ok.disabled = true;
      msg.textContent = "";
      try { await onCode(code); finish(true); } catch (err) {
        const kind = totpErrorKind(err);
        if (kind !== "code" && onFatal) { finish(false); onFatal(err); return; }
        msg.textContent = kind === "code"
          ? "Código incorrecto. Revisa la hora de tu teléfono y escribe el código que se ve ahora."
          : kind === "network" ? "Sin conexión. Revisa tu Internet e inténtalo de nuevo."
          : "No se pudo verificar el código. Vuelve a iniciar sesión para generar una clave nueva.";
        input.value = "";
        input.focus();
      } finally { ok.disabled = false; }
    });
    document.body.append(dlg);
    dlg.showModal();
    input.focus();
  });
}

// ------------------------------------------------------------ MFA TOTP

/**
 * Inicia sesión con correo y contraseña; si la cuenta tiene segundo factor,
 * pide el código TOTP. Lanza { code: "skano/mfa-cancelled" } si se cancela.
 */
export async function signInWithSecondFactor(fb, email, password) {
  const { A, auth } = fb;
  try {
    return await A.signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err?.code !== "auth/multi-factor-auth-required") throw err;
    const resolver = A.getMultiFactorResolver(auth, err);
    const hint = resolver.hints.find((h) => h.factorId === A.TotpMultiFactorGenerator.FACTOR_ID);
    if (!hint) throw err;
    let cred = null;
    const ok = await codeDialog({
      eyebrow: "VERIFICACIÓN EN DOS PASOS", title: "Ingresa tu código",
      lines: ["Abre tu aplicación de autenticación y escribe el código de SKANO Empresas."],
      submit: "VERIFICAR",
      onCode: async (code) => { cred = await resolver.resolveSignIn(A.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)); },
    });
    if (!ok) throw Object.assign(new Error("Verificación cancelada."), { code: "skano/mfa-cancelled" });
    return cred;
  }
}

/**
 * Activa TOTP para el usuario actual. Devuelve true si quedó activado.
 * Después de activarlo hay que volver a iniciar sesión con el código para
 * que el token incluya el segundo factor.
 */
export async function enrollSecondFactor(fb) {
  const { A, auth } = fb;
  const user = auth.currentUser;
  if (!user) return false;
  if (A.multiFactor(user).enrolledFactors.length) return false;
  // Cada intento genera una clave nueva en Firebase; la clave solo existe en
  // esta pantalla (el código QR se dibuja en el navegador, sin servicios externos).
  const session = await A.multiFactor(user).getSession();
  const secret = await A.TotpMultiFactorGenerator.generateSecret(session);
  const url = secret.generateQrCodeUrl(user.email || "usuario", "SKANO Empresas");
  const key = formatTotpSecret(secret.secretKey);
  const copyBtn = node("button", { class: "link", type: "button" }, "Copiar clave");
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(secret.secretKey); copyBtn.textContent = "Clave copiada"; } catch (_) { copyBtn.textContent = "No se pudo copiar: escríbela"; }
  });
  const touch = globalThis.matchMedia?.("(pointer: coarse)").matches;
  const deadline = secret.enrollmentCompletionDeadline ? new Date(secret.enrollmentCompletionDeadline) : null;
  const extra = node("div", { class: "mfa-secret" },
    node("p", {}, node("b", {}, "Opción A — en el computador: "), "abre Google Authenticator en tu teléfono, toca «+» › «Escanear un código QR» y apunta a este código:"),
    node("div", { class: "mfa-qr" }, qrSvg(url, { size: 200 })),
    node("p", {}, node("b", {}, "Opción B — manual: "), "en la app toca «+» › «Ingresar una clave de configuración». Nombre: SKANO Empresas · Clave:"),
    node("code", {}, key), " ", copyBtn,
    node("p", { class: "muted" }, "Tipo de clave: basada en el tiempo. No compartas esta clave ni el código QR."),
    touch ? node("p", {}, node("a", { href: url, rel: "noopener" }, "Opción C — en este teléfono: abrir en la app de autenticación")) : null,
    deadline ? node("p", { class: "muted" }, `Completa la activación antes de las ${deadline.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}; después se genera una clave nueva.`) : null);
  let fatal = null;
  const ok = await codeDialog({
    eyebrow: "SEGURIDAD DE LA CUENTA", title: "Activa la verificación en dos pasos",
    lines: [
      "Tu rol administra información judicial y requiere un segundo factor.",
      "Agrega SKANO Empresas a tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator o 1Password) y escribe el código de 6 dígitos que aparece.",
    ],
    extra, submit: "ACTIVAR",
    onCode: async (code) => {
      await A.multiFactor(user).enroll(A.TotpMultiFactorGenerator.assertionForEnrollment(secret, code), "Aplicación de autenticación");
    },
    onFatal: (err) => { fatal = err; },
  });
  if (fatal) throw fatal;
  return ok;
}

/**
 * Respuesta común al error "mfa-required" del backend: ofrece activar el
 * segundo factor y cierra la sesión para que el usuario vuelva a ingresar
 * con su código. Devuelve el texto a mostrar en la pantalla de inicio.
 */
export async function handleMfaRequired(fb) {
  const { A, auth } = fb;
  let text = "Tu rol requiere verificación en dos pasos. Ingresa nuevamente con tu código.";
  try {
    const user = auth.currentUser;
    if (user && !A.multiFactor(user).enrolledFactors.length) {
      const enrolled = await enrollSecondFactor(fb);
      text = enrolled
        ? "Verificación en dos pasos activada. Ingresa nuevamente con tu código."
        : "Tu rol requiere activar la verificación en dos pasos para continuar.";
    }
  } catch (err) {
    const kind = totpErrorKind(err);
    text = kind === "expired"
      ? "La clave de activación venció. Vuelve a ingresar: se generará una clave nueva."
      : kind === "network"
        ? "Sin conexión al activar la verificación. Vuelve a ingresar cuando tengas Internet."
        : `No se pudo activar la verificación en dos pasos (${err?.code || "error"}). Vuelve a ingresar para intentarlo con una clave nueva.`;
  }
  await A.signOut(auth).catch(() => {});
  return text;
}
