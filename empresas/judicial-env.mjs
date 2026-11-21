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

/** Código TOTP de 6 dígitos (acepta espacios). */
export function normalizeTotpCode(value) {
  const code = String(value || "").replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : "";
}
