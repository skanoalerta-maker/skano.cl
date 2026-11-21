// =====================================================================
// SKANO EMPRESAS — Panel SUPERADMIN: lógica pura (sin DOM ni Firebase)
// Se prueba con: node --test empresas/admin/admin-core.test.mjs
// =====================================================================

const TEST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Host local de pruebas (emuladores). El entorno real se resuelve en ../judicial-env.mjs. */
export function isTestHost(hostname) {
  return TEST_HOSTS.has(String(hostname || "").toLowerCase());
}

export function rutCheckDigit(body) {
  let sum = 0;
  let factor = 2;
  for (const d of String(body).split("").reverse()) {
    sum += Number(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const r = 11 - (sum % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

export function isValidRut(value) {
  const m = String(value || "").toUpperCase().replace(/[.\s]/g, "").match(/^(\d{6,9})-?([\dK])$/);
  return Boolean(m) && rutCheckDigit(String(Number(m[1]))) === m[2];
}

export function formatRut(value) {
  const m = String(value || "").toUpperCase().replace(/[.\s]/g, "").match(/^(\d{6,9})-?([\dK])$/);
  if (!m) return String(value || "");
  const body = String(Number(m[1])).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${m[2]}`;
}

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" });
const DATETIME_FMT = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

export function formatDate(ms) {
  return Number.isFinite(Number(ms)) && ms ? DATE_FMT.format(new Date(Number(ms))) : "—";
}

export function formatDateTime(ms) {
  return Number.isFinite(Number(ms)) && ms ? DATETIME_FMT.format(new Date(Number(ms))) : "—";
}

export function formatNumber(n) {
  return new Intl.NumberFormat("es-CL").format(Number(n) || 0);
}

export const COMPANY_STATUS_LABEL = Object.freeze({ ACTIVE: "Activa", SUSPENDED: "Suspendida", DISABLED: "Deshabilitada" });
export const CONTRACT_STATE_LABEL = Object.freeze({
  NONE: "Sin contrato",
  NOT_STARTED: "Por iniciar",
  ACTIVE: "Vigente",
  EXPIRED: "Vencido",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
});
export const ROLE_LABEL = Object.freeze({
  SUPERADMIN_SKANO: "Superadmin SKANO",
  ADMIN_EMPRESA: "Administrador",
  OPERADOR_EMPRESA: "Operador",
  REVISOR_EMPRESA: "Revisor",
  GESTOR_ALERTAS: "Gestor de alertas",
  AUDITOR_LECTURA: "Auditor (lectura)",
});
export const MODULE_LABEL = Object.freeze({ judicial: "Embargos", theft: "Encargos" });

const AUDIT_LABEL = Object.freeze({
  COMPANY_CREATED: "Empresa creada",
  COMPANY_UPDATED: "Empresa modificada",
  COMPANY_STATUS_CHANGED: "Estado de empresa",
  CONTRACT_CREATED: "Contrato creado",
  CONTRACT_QUOTA_CHANGED: "Cupo modificado",
  CONTRACT_MODULE_ENABLED: "Módulo activado",
  CONTRACT_MODULE_SUSPENDED: "Módulo suspendido",
  CONTRACT_RENEWED: "Contrato renovado",
  CONTRACT_STATUS_CHANGED: "Estado de contrato",
  MEMBER_INVITED: "Usuario invitado",
  INVITATION_ACCEPTED: "Invitación aceptada",
  INVITATION_REVOKED: "Invitación revocada",
  MEMBER_ROLE_CHANGED: "Rol modificado",
  MEMBER_DISABLED: "Usuario deshabilitado",
  MEMBER_REACTIVATED: "Usuario reactivado",
});

const CONTRACT_EVENT_LABEL = Object.freeze({
  CREATED: "Contrato creado",
  QUOTA_INCREASE: "Ampliación de cupo",
  QUOTA_DECREASE: "Reducción de cupo",
  MODULE_ENABLED: "Módulo activado",
  MODULE_SUSPENDED: "Módulo suspendido",
  RENEWED: "Renovación",
  STATUS_ACTIVE: "Contrato reactivado",
  STATUS_SUSPENDED: "Contrato suspendido",
  STATUS_CANCELLED: "Contrato cancelado",
});

export function contractEventLabel(type) {
  return CONTRACT_EVENT_LABEL[type] || String(type || "").replace(/_/g, " ").toLowerCase();
}

export function auditLabel(action) {
  return AUDIT_LABEL[action] || String(action || "").replace(/_/g, " ").toLowerCase();
}

export function pillClass(value) {
  if (["ACTIVE", "on"].includes(value)) return "on";
  if (["SUSPENDED", "NOT_STARTED", "pending"].includes(value)) return "pending";
  if (["EXPIRED", "DISABLED", "CANCELLED"].includes(value)) return "bad";
  return "off";
}

export function quotaPercent(used, quota) {
  const q = Number(quota) || 0;
  const u = Number(used) || 0;
  if (q <= 0) return u > 0 ? 100 : 0;
  return Math.min(100, Math.round((u / q) * 100));
}

export function quotaLevel(used, quota) {
  const p = quotaPercent(used, quota);
  if (Number(used) > Number(quota)) return "over";
  if (p >= 90) return "high";
  if (p >= 70) return "mid";
  return "ok";
}

/** Fecha 'AAAA-MM-DD' de un input → ms a medianoche local. */
export function dateInputToMs(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function trimmed(v) {
  return String(v ?? "").trim();
}

/** Formulario de empresa → payload para adminCreateCompany. */
export function buildCompanyPayload(values) {
  const errors = [];
  const legal = trimmed(values.legal_name);
  const trade = trimmed(values.trade_name);
  const rut = trimmed(values.rut);
  const email = trimmed(values.primary_email).toLowerCase();
  if (legal.length < 3) errors.push("Razón social: mínimo 3 caracteres.");
  if (trade.length < 2) errors.push("Nombre comercial: mínimo 2 caracteres.");
  if (!isValidRut(rut)) errors.push("RUT inválido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("Correo principal inválido.");
  const representatives = trimmed(values.rep_name)
    ? [{ name: trimmed(values.rep_name), rut: trimmed(values.rep_rut) || undefined, email: trimmed(values.rep_email) || undefined }]
    : [];
  if (representatives[0]?.rut && !isValidRut(representatives[0].rut)) errors.push("RUT del representante inválido.");
  const contacts = trimmed(values.contact_name)
    ? [{ name: trimmed(values.contact_name), email: trimmed(values.contact_email) || undefined, phone: trimmed(values.contact_phone) || undefined }]
    : [];
  return {
    errors,
    payload: { legal_name: legal, trade_name: trade, rut, primary_email: email, representatives, contacts, notes: trimmed(values.notes) },
  };
}

function quotaValue(v) {
  const n = Number(String(v ?? "").replace(/\./g, ""));
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/** Formulario de contrato → payload para adminCreateContract. */
export function buildContractPayload(values) {
  const errors = [];
  const payload = { company_id: trimmed(values.company_id) };
  const start = dateInputToMs(values.starts_at);
  if (start === null) errors.push("Fecha de inicio inválida.");
  else payload.starts_at_ms = start;
  if (values.duration === "custom") {
    const end = dateInputToMs(values.ends_at);
    if (end === null) errors.push("Fecha de término inválida.");
    else if (start !== null && end <= start) errors.push("La fecha de término debe ser posterior al inicio.");
    else payload.ends_at_ms = end;
  } else {
    const months = Number(values.duration);
    if (![1, 2, 3, 6, 12, 24].includes(months)) errors.push("Duración inválida.");
    else payload.months = months;
  }
  payload.modules = {};
  for (const m of ["judicial", "theft"]) {
    const enabled = values[`${m}_enabled`] === true || values[`${m}_enabled`] === "on";
    const quota = quotaValue(values[`${m}_quota`] || 0);
    if (Number.isNaN(quota)) errors.push(`Cupo de ${MODULE_LABEL[m]} inválido.`);
    if (enabled && quota === 0) errors.push(`Módulo ${MODULE_LABEL[m]} activo con cupo 0.`);
    payload.modules[m] = { enabled, quota: Number.isNaN(quota) ? 0 : quota };
  }
  if (!payload.modules.judicial.enabled && !payload.modules.theft.enabled) errors.push("Activa al menos un módulo.");
  payload.notes = trimmed(values.notes);
  return { errors, payload };
}

// Textos propios solo para casos donde conviene un mensaje fijo; en el
// resto se muestra el mensaje (en español) que devuelve el backend.
const ERROR_TEXT = Object.freeze({
  "legal-basis-pending": "Bloqueado hasta resolver la base legal (sección 21).",
  "rate-limited": "Demasiadas solicitudes; espera un minuto.",
  "session-revoked": "Tu sesión fue revocada. Vuelve a iniciar sesión.",
  "user-disabled": "Cuenta deshabilitada.",
  "mfa-required": "Este rol requiere autenticación multifactor.",
  internal: "Error interno. Intenta nuevamente.",
});

/** Mensaje legible para errores de httpsCallable. */
export const CONNECTIVITY_TEXT = "No se pudo contactar al servidor de SKANO. Revisa tu conexión e intenta nuevamente.";

export function isConnectivityError(err) {
  const code = String(err?.code || "");
  return ["functions/unavailable", "functions/deadline-exceeded", "auth/network-request-failed"].includes(code)
    || (code === "functions/internal" && String(err?.message || "").trim().toLowerCase() === "internal" && !err?.details);
}

export function errorMessage(err) {
  if (isConnectivityError(err)) return CONNECTIVITY_TEXT;
  const reason = err?.details?.reason;
  if (reason && ERROR_TEXT[reason]) return ERROR_TEXT[reason];
  if (err?.message && !/^internal$/i.test(err.message)) return String(err.message).replace(/^FirebaseError:\s*/, "");
  return ERROR_TEXT.internal;
}

export function inviteLinkForDisplay(url) {
  // Enlace solo visible en pruebas; se recorta el token en la vista.
  const s = String(url || "");
  const i = s.indexOf("#t=");
  return i < 0 ? s : `${s.slice(0, i + 3)}${s.slice(i + 3, i + 9)}…`;
}
