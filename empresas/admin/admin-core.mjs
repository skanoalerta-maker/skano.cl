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
  PENDING: "Pendiente de habilitación",
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
  CONTRACT_TERMS_UPDATED: "Datos del contrato editados",
  CONTRACT_ISSUED: "Contrato emitido para firma",
  CONTRACT_SIGNED_UPLOADED: "Contrato firmado cargado",
  CONTRACT_APPROVED: "Contrato aprobado (vigente)",
  CONTRACT_REJECTED: "Contrato firmado rechazado",
  CONTRACT_TERMINATED: "Contrato terminado",
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
  TERMS_UPDATED: "Términos editados (vuelve a borrador)",
  ISSUED: "PDF emitido para firma",
  SIGNED_UPLOADED: "PDF firmado cargado por la empresa",
  APPROVED: "Aprobado por SKANO (vigente)",
  REJECTED: "Rechazado por SKANO",
  TERMINATED: "Contrato terminado",
  DOWNLOADED: "Descarga de archivo",
});

export function contractEventLabel(type) {
  return CONTRACT_EVENT_LABEL[type] || String(type || "").replace(/_/g, " ").toLowerCase();
}

export function auditLabel(action) {
  return AUDIT_LABEL[action] || String(action || "").replace(/_/g, " ").toLowerCase();
}

export function pillClass(value) {
  if (["ACTIVE", "on"].includes(value)) return "on";
  if (["SUSPENDED", "NOT_STARTED", "PENDING", "pending"].includes(value)) return "pending";
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

/**
 * Enlace de invitación para el dominio en uso. Antes de que empresas.skano.cl
 * tenga DNS, el panel se usa en <proyecto>.web.app: el enlace se reescribe a
 * ese mismo origen SOLO si ambos dominios pertenecen al mismo entorno
 * configurado (judicial-env.mjs). El token y la ruta no cambian.
 */
export function localizeInviteUrl(url, currentOrigin, envHosts = []) {
  const raw = String(url || "");
  try {
    const u = new URL(raw);
    const cur = new URL(String(currentOrigin || ""));
    if (u.protocol !== "https:" || cur.protocol !== "https:") return raw;
    if (u.host === cur.host) return raw;
    const hosts = new Set((envHosts || []).map((h) => String(h).toLowerCase()));
    if (!hosts.has(u.hostname) || !hosts.has(cur.hostname)) return raw;
    return `${cur.origin}${u.pathname}${u.search}${u.hash}`;
  } catch (_) {
    return raw;
  }
}

export function inviteLinkForDisplay(url) {
  // Enlace solo visible en pruebas; se recorta el token en la vista.
  const s = String(url || "");
  const i = s.indexOf("#t=");
  return i < 0 ? s : `${s.slice(0, i + 3)}${s.slice(i + 3, i + 9)}…`;
}

// ------------------------------------------------------------ contrato firmable

/** Estado documental del contrato (flujo de firma). */
export const DOC_STATUS_LABEL = Object.freeze({
  BORRADOR: "Borrador",
  PENDIENTE_FIRMA: "Pendiente de firma",
  PENDIENTE_REVISION: "Pendiente de revisión SKANO",
  VIGENTE: "Vigente",
  RECHAZADO: "Rechazado",
  VENCIDO: "Vencido",
  TERMINADO: "Terminado",
});

export function docPillClass(status) {
  if (status === "VIGENTE") return "on";
  if (["PENDIENTE_FIRMA", "PENDIENTE_REVISION", "BORRADOR"].includes(status)) return "pending";
  if (["RECHAZADO", "VENCIDO", "TERMINADO"].includes(status)) return "bad";
  return "off";
}

export const FILE_KIND_LABEL = Object.freeze({ GENERADO: "Contrato emitido por SKANO", FIRMADO: "Contrato firmado por la empresa" });
export const FILE_STATUS_LABEL = Object.freeze({
  ACTIVE: "Versión vigente", SUPERSEDED: "Reemplazado", PENDING_REVIEW: "En revisión", APPROVED: "Aprobado", REJECTED: "Rechazado",
});
export const PERIOD_LABEL = Object.freeze({ MENSUAL: "mensual", ANUAL: "anual", UNICO: "pago único" });

export function formatMoney(amount, currency) {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (currency === "UF") return `UF ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(n)}`;
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(n)} CLP`;
}

export function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(b / (1024 * 1024)).toFixed(2).replace(".", ",")} MB`;
}

/** Huella abreviada para mostrar (la completa va en title / copia). */
export function shortHash(h) {
  const s = String(h || "");
  return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-8)}` : s;
}

/**
 * Términos comerciales del formulario → objeto `terms` del backend.
 * Validación de forma; la validación definitiva es del backend.
 * `requireAll` exige lo necesario para emitir el PDF.
 */
export function buildTermsPayload(values, { requireAll = false } = {}) {
  const errors = [];
  const amountRaw = trimmed(values.price_amount).replace(/\./g, "").replace(",", ".");
  const terms = {
    company_address: trimmed(values.company_address),
    representative: {
      name: trimmed(values.rep_name),
      rut: trimmed(values.rep_rut),
      position: trimmed(values.rep_position),
      email: trimmed(values.rep_email).toLowerCase(),
    },
    plan_name: trimmed(values.plan_name),
    price: {
      amount: amountRaw === "" ? null : Number(amountRaw),
      currency: values.price_currency === "UF" ? "UF" : "CLP",
      period: ["MENSUAL", "ANUAL", "UNICO"].includes(values.price_period) ? values.price_period : "MENSUAL",
      taxes: trimmed(values.price_taxes),
    },
    payment_terms: trimmed(values.payment_terms),
    conditions: trimmed(values.conditions),
  };
  const r = terms.representative;
  if (r.rut && !isValidRut(r.rut)) errors.push("RUT del representante inválido.");
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) errors.push("Correo del representante inválido.");
  if (terms.price.amount != null && (!Number.isFinite(terms.price.amount) || terms.price.amount < 0)) errors.push("Precio inválido.");
  if (requireAll) {
    if (r.name.length < 3) errors.push("Falta el nombre del representante legal.");
    if (!r.rut) errors.push("Falta el RUT del representante legal.");
    if (!r.email) errors.push("Falta el correo del representante legal.");
    if (terms.plan_name.length < 2) errors.push("Falta el plan contratado.");
    if (terms.price.amount == null) errors.push("Falta el precio.");
  }
  if (terms.price.amount == null) delete terms.price.amount;
  return { errors, terms };
}

/** Términos guardados → valores de formulario (para editar). */
export function termsToFormValues(t) {
  const terms = t || {};
  const r = terms.representative || {};
  const p = terms.price || {};
  return {
    company_address: terms.company_address || "", rep_name: r.name || "", rep_rut: r.rut ? formatRut(r.rut) : "",
    rep_position: r.position || "", rep_email: r.email || "", plan_name: terms.plan_name || "",
    price_amount: p.amount == null ? "" : String(p.amount), price_currency: p.currency || "CLP",
    price_period: p.period || "MENSUAL", price_taxes: p.taxes || "", payment_terms: terms.payment_terms || "",
    conditions: terms.conditions || "",
  };
}

/** Estado comercial resumido para el indicador superior. */
export function commercialStatus(docStatus, state, testOnly = false) {
  if (testOnly === true) return { tone: "test", label: docStatus === "VIGENTE" && state === "ACTIVE" ? "Contrato de prueba · sin validez contractual" : "Contrato de prueba · habilitación pendiente" };
  if ((docStatus === "VIGENTE" || !docStatus) && state === "ACTIVE") return { tone: "on", label: "Servicio activo" };
  if (["BORRADOR", "PENDIENTE_FIRMA", "PENDIENTE_REVISION", "RECHAZADO"].includes(docStatus)) return { tone: "pending", label: "Habilitación pendiente" };
  if (["VENCIDO", "TERMINADO"].includes(docStatus) || ["EXPIRED", "CANCELLED", "SUSPENDED"].includes(state)) return { tone: "bad", label: "Servicio no habilitado" };
  return { tone: "pending", label: "Habilitación pendiente" };
}

/** Etiqueta del entorno técnico (nunca "pruebas" en producción). */
export function environmentLabel(stage) {
  return stage === "emulator" ? "PRUEBAS · EMULADORES" : "PRODUCCIÓN";
}
