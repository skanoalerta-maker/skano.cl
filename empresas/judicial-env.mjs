// =====================================================================
// SKANO JUDICIAL — Configuración pública por entorno (sin DOM ni Firebase)
//
// Estos valores NO son secretos: la API key web de Firebase y la clave de
// sitio de reCAPTCHA Enterprise son públicas por diseño. La seguridad la
// dan el backend (autorización por miembro), App Check, MFA y las reglas
// que niegan todo acceso directo. Aun así, la API key debe restringirse por
// referente HTTP y por API en Google Cloud (ver plan de publicación).
//
// Mientras un entorno tenga campos vacíos, los portales NO se inicializan
// en ese dominio: muestran "no habilitado". Completar solo con autorización
// (functions_judicial/scripts/configure_web.js genera este archivo).
// =====================================================================

export const SDK_VERSION = "12.16.0";
export const REGION = "southamerica-west1";

export const EMULATOR = Object.freeze({
  stage: "emulator",
  projectId: "demo-skano-judicial",
  apiKey: "demo-skano-judicial-key",
  authDomain: "demo-skano-judicial.firebaseapp.com",
  appId: "",
  appCheckSiteKey: "",
  region: REGION,
  authEmulatorUrl: "http://127.0.0.1:9299",
  functionsHost: "127.0.0.1",
  functionsPort: 5201,
});

export const HOSTED = Object.freeze([
  Object.freeze({
    stage: "production",
    hosts: Object.freeze(["www.skano.cl", "skano.cl"]),
    projectId: "",
    apiKey: "",
    authDomain: "",
    appId: "",
    appCheckSiteKey: "",
    region: REGION,
  }),
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REQUIRED = ["projectId", "apiKey", "authDomain", "appId", "appCheckSiteKey"];

/**
 * Entorno para un hostname: { status: "ok", env } o { status: "blocked" }.
 * Un entorno alojado incompleto o con un proyecto demo-* queda bloqueado.
 */
export function resolveEnvironment(hostname, hosted = HOSTED) {
  const host = String(hostname || "").toLowerCase();
  if (LOCAL_HOSTS.has(host)) return { status: "ok", env: EMULATOR };
  const env = hosted.find((e) => e.hosts.includes(host));
  if (!env) return { status: "blocked", reason: "host" };
  if (REQUIRED.some((k) => !String(env[k] || "").trim())) return { status: "blocked", reason: "not-configured" };
  if (env.projectId.startsWith("demo-") || env.region !== REGION) return { status: "blocked", reason: "invalid" };
  return { status: "ok", env };
}

/** Clave de TOTP agrupada en bloques de 4 para dictarla o tipearla. */
export function formatTotpSecret(secret) {
  return String(secret || "").replace(/\s+/g, "").toUpperCase().match(/.{1,4}/g)?.join(" ") || "";
}

/**
 * Clasifica un error de Firebase al activar o usar TOTP:
 *  "code"    código incorrecto: se puede reintentar en el mismo diálogo
 *  "expired" sesión o clave vencida / requiere inicio reciente: nueva clave
 *  "network" sin conexión
 *  "other"   cualquier otro
 */
export function totpErrorKind(err) {
  const code = String(err?.code || "");
  if (["auth/invalid-verification-code", "auth/totp-challenge-timeout", "auth/missing-code", "auth/invalid-totp-code"].includes(code)) return "code";
  if (["auth/requires-recent-login", "auth/invalid-multi-factor-session", "auth/missing-multi-factor-session", "auth/code-expired", "auth/user-token-expired", "auth/session-expired"].includes(code)) return "expired";
  if (code === "auth/network-request-failed") return "network";
  return "other";
}

/**
 * Mensaje de inicio de sesión. Correo inexistente y contraseña incorrecta
 * comparten el mismo texto (no se revela si la cuenta existe).
 */
export function signInErrorText(err) {
  const code = String(err?.code || "");
  if (code === "skano/mfa-cancelled") return "Verificación cancelada.";
  if (code === "auth/too-many-requests") return "Demasiados intentos fallidos: el acceso quedó en pausa unos minutos. Espera o usa «¿Olvidaste tu contraseña?».";
  if (code === "auth/network-request-failed") return "Sin conexión con el servicio de acceso. Revisa tu Internet e inténtalo de nuevo.";
  if (code === "auth/user-disabled") return "Tu cuenta está deshabilitada. Contacta a SKANO.";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email", "auth/invalid-login-credentials"].includes(code)) return "Correo o contraseña incorrectos.";
  return `No se pudo iniciar sesión (${code || "error"}). Inténtalo de nuevo.`;
}

/** Código TOTP de 6 dígitos (acepta espacios). */
export function normalizeTotpCode(value) {
  const code = String(value || "").replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : "";
}
