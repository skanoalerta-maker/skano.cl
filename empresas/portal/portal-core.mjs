// =====================================================================
// SKANO EMPRESAS — Portal empresarial: lógica pura (sin DOM/Firebase).
// La autorización real ocurre SIEMPRE en el backend; esta lógica solo
// decide qué se muestra. Pruebas: node --test portal-core.test.mjs
// =====================================================================

export {
  isTestHost, isValidRut, formatRut, formatDate, formatDateTime, formatNumber,
  quotaPercent, quotaLevel, errorMessage, ROLE_LABEL, CONTRACT_STATE_LABEL, auditLabel as adminAuditLabel,
} from "../admin/admin-core.mjs?v=20261121-1";
import { auditLabel as baseAuditLabel } from "../admin/admin-core.mjs?v=20261121-1";

// ------------------------------------------------------------ menú

export const MENU = Object.freeze([
  { view: "home", label: "Inicio", icon: "◎", perm: "company.read" },
  { view: "vehicles", label: "Vehículos con embargo", icon: "▤", perm: "vehicles.read" },
  { view: "review", label: "Pendientes de revisión", icon: "◐", perm: "vehicles.review" },
  { view: "import", label: "Importar Excel", icon: "⇪", perm: "imports.run" },
  { view: "alerts", label: "Alertas y detecciones", icon: "◬", perm: "alerts.read" },
  { view: "users", label: "Usuarios y permisos", icon: "◍", perm: "members.read" },
  { view: "contract", label: "Contrato y cupos", icon: "▣", perm: "contract.read" },
  { view: "audit", label: "Historial de actividad", icon: "≡", perm: "audit.read" },
]);

export function visibleMenu(permissions) {
  const set = new Set(permissions || []);
  return MENU.filter((m) => set.has(m.perm));
}

export function can(permissions, perm) {
  return (permissions || []).includes(perm);
}

// ------------------------------------------------------------ estados

export const STATUS_LABEL = Object.freeze({
  BORRADOR: "Borrador",
  IMPORTADO: "Importado",
  PENDIENTE_REVISION: "Pendiente de revisión",
  OBSERVADO: "Observado",
  APROBADO: "Aprobado",
  PUBLICADO: "Publicado",
  SUSPENDIDO: "Suspendido",
  RETIRADO: "Retirado",
  CERRADO: "Cerrado",
  EXPIRADO: "Expirado",
});

export function statusTone(status) {
  if (status === "PUBLICADO") return "on";
  if (["PENDIENTE_REVISION", "APROBADO", "IMPORTADO", "BORRADOR"].includes(status)) return "pending";
  if (["OBSERVADO", "SUSPENDIDO", "EXPIRADO"].includes(status)) return "bad";
  return "off";
}

// Espejo de vehicle_states.TRANSITIONS + permiso por destino (backend).
const TRANSITIONS = Object.freeze({
  BORRADOR: ["PENDIENTE_REVISION", "RETIRADO"],
  IMPORTADO: ["PENDIENTE_REVISION", "OBSERVADO", "RETIRADO"],
  PENDIENTE_REVISION: ["OBSERVADO", "APROBADO", "RETIRADO"],
  OBSERVADO: ["PENDIENTE_REVISION", "RETIRADO"],
  APROBADO: ["PUBLICADO", "OBSERVADO", "RETIRADO"],
  PUBLICADO: ["SUSPENDIDO", "RETIRADO", "CERRADO"],
  SUSPENDIDO: ["PENDIENTE_REVISION", "RETIRADO", "CERRADO"],
  EXPIRADO: ["PENDIENTE_REVISION", "RETIRADO", "CERRADO"],
  RETIRADO: [],
  CERRADO: [],
});

const TARGET = Object.freeze({
  PENDIENTE_REVISION: { perm: "vehicles.write", label: "Enviar a revisión", tone: "primary" },
  OBSERVADO: { perm: "vehicles.review", label: "Observar", tone: "secondary" },
  APROBADO: { perm: "vehicles.review", label: "Aprobar", tone: "primary" },
  PUBLICADO: { perm: "vehicles.publish", label: "Publicar", tone: "primary" },
  SUSPENDIDO: { perm: "vehicles.withdraw", label: "Suspender", tone: "secondary" },
  RETIRADO: { perm: "vehicles.withdraw", label: "Retirar", tone: "danger" },
  CERRADO: { perm: "vehicles.withdraw", label: "Cerrar expediente", tone: "danger" },
});

export function availableActions(status, permissions) {
  return (TRANSITIONS[status] || [])
    .filter((to) => can(permissions, TARGET[to].perm))
    .map((to) => ({ to, ...TARGET[to], label: to === "PENDIENTE_REVISION" && status !== "BORRADOR" && status !== "IMPORTADO" ? "Reenviar a revisión" : TARGET[to].label }));
}

export function canEdit(status, permissions) {
  return can(permissions, "vehicles.write") && !["RETIRADO", "CERRADO"].includes(status);
}

// ------------------------------------------------------------ campos

export const MEASURE_OPTIONS = Object.freeze([
  ["EMBARGO", "Embargo"],
  ["PROHIBICION_ENAJENAR", "Prohibición de celebrar actos y contratos / enajenar"],
  ["MEDIDA_PRECAUTORIA", "Medida precautoria"],
  ["ORDEN_INCAUTACION", "Orden judicial de incautación / retiro"],
  ["OTRA", "Otra medida judicial"],
]);
export const MEASURE_LABEL = Object.freeze(Object.fromEntries(MEASURE_OPTIONS));

export const MEASURE_STATUS_OPTIONS = Object.freeze([
  ["VIGENTE", "Vigente"], ["EN_VERIFICACION", "En verificación"], ["ALZADA", "Alzada"], ["CADUCADA", "Caducada"],
]);
export const MEASURE_STATUS_LABEL = Object.freeze(Object.fromEntries(MEASURE_STATUS_OPTIONS));

export const VEHICLE_TYPE_OPTIONS = Object.freeze([
  ["", "—"], ["auto", "Automóvil / camioneta"], ["moto", "Motocicleta"], ["camion", "Camión"], ["bus", "Bus / minibús"],
  ["rampla", "Rampla / remolque"], ["tractor", "Tractor / maquinaria"], ["otro", "Otro"],
]);

export const FIELD_SECTIONS = Object.freeze([
  {
    title: "Identificación del vehículo",
    fields: [
      { name: "ppu", label: "Patente (PPU)", required: true, max: 8, placeholder: "BCDF12" },
      { name: "vehicle_type", label: "Tipo de vehículo", type: "select", options: VEHICLE_TYPE_OPTIONS },
      { name: "brand", label: "Marca", max: 60 },
      { name: "model", label: "Modelo", max: 60 },
      { name: "version", label: "Versión", max: 60 },
      { name: "year", label: "Año", inputmode: "numeric", max: 4 },
      { name: "color", label: "Color", max: 40 },
      { name: "vin", label: "VIN / chasis", max: 25 },
      { name: "engine_number", label: "Número de motor", max: 30 },
    ],
  },
  {
    title: "Antecedentes judiciales",
    fields: [
      { name: "measure_type", label: "Tipo de medida", type: "select", required: true, options: [["", "Seleccionar…"], ...MEASURE_OPTIONS] },
      { name: "measure_other_description", label: "Descripción de la medida", max: 300, showIf: { measure_type: "OTRA" } },
      { name: "measure_status", label: "Estado de vigencia", type: "select", options: [["", "Seleccionar…"], ...MEASURE_STATUS_OPTIONS] },
      { name: "court", label: "Tribunal", required: true, max: 160 },
      { name: "case_role", label: "Rol o identificador de causa", required: true, max: 60, placeholder: "C-1234-2025" },
      { name: "case_year", label: "Año de la causa", inputmode: "numeric", max: 4 },
      { name: "resolution_number", label: "Número de resolución", max: 60 },
      { name: "resolution_date", label: "Fecha de resolución", type: "date" },
      { name: "measure_registration_date", label: "Fecha de inscripción de la medida", type: "date" },
      { name: "creditor", label: "Mandante o acreedor", max: 160 },
      { name: "internal_case_id", label: "Identificador interno del expediente", max: 60 },
      { name: "document_reference", label: "Referencia documental", max: 120 },
      { name: "last_verified_at", label: "Última fecha de verificación", type: "date" },
      { name: "company_legal_capacity", label: "Calidad jurídica de la empresa", max: 120 },
    ],
  },
  {
    title: "Gestión operacional",
    fields: [
      { name: "responsible", label: "Responsable", max: 120 },
      { name: "priority", label: "Prioridad", type: "select", options: [["", "—"], ["ALTA", "Alta"], ["MEDIA", "Media"], ["BAJA", "Baja"]] },
      { name: "internal_status", label: "Estado interno", max: 60 },
      { name: "observations", label: "Observaciones", type: "textarea", max: 500, wide: true },
    ],
  },
]);

export const ALL_FIELDS = Object.freeze(FIELD_SECTIONS.flatMap((s) => s.fields));
export const FIELD_LABEL = Object.freeze(Object.fromEntries(ALL_FIELDS.map((f) => [f.name, f.label])));

/** Valores de formulario → cambios respecto del original (solo lo modificado). */
export function diffValues(original, values) {
  const changes = {};
  for (const f of ALL_FIELDS) {
    const before = String(original?.[f.name] ?? "").trim();
    const after = String(values?.[f.name] ?? "").trim();
    if (before !== after) changes[f.name] = after;
  }
  return changes;
}

/** Validación rápida en cliente (el backend vuelve a validar todo). */
export function quickValidate(values) {
  const errors = [];
  for (const f of ALL_FIELDS) {
    if (f.required && !String(values?.[f.name] ?? "").trim()) errors.push(`${f.label}: requerido.`);
  }
  if (values?.measure_type === "OTRA" && String(values?.measure_other_description || "").trim().length < 5) {
    errors.push("Describe la medida (mínimo 5 caracteres).");
  }
  const year = String(values?.year ?? "").trim();
  if (year && !/^\d{4}$/.test(year)) errors.push("Año: usa 4 dígitos.");
  return errors;
}

// ------------------------------------------------------------ errores de filas

const ISSUE_TEXT = Object.freeze({
  ppu_invalida: "Patente inválida",
  ppu_no_coincide_con_tipo: "La patente no corresponde al tipo de vehículo",
  ano_imposible: "Año imposible",
  ano_causa_imposible: "Año de causa imposible",
  vin_caracteres_invalidos: "VIN con caracteres inválidos",
  vin_contiene_IOQ: "VIN contiene I, O o Q",
  vin_largo_invalido: "VIN con largo inválido",
  chasis_no_estandar_17: "Chasis no estándar (distinto de 17 caracteres)",
  tipo_medida_desconocido: "Tipo de medida desconocido",
  estado_vigencia_desconocido: "Estado de vigencia desconocido",
  estado_vigencia_no_informado: "Estado de vigencia no informado (quedará en verificación)",
  measure_other_description_requerido: "Falta describir la medida",
  registro_vacio: "Registro vacío",
});

export function issueText(code) {
  const c = String(code || "");
  if (ISSUE_TEXT[c]) return ISSUE_TEXT[c];
  let m = c.match(/^duplicado_en_archivo_fila_(\d+)$/);
  if (m) return `Duplicado de la fila ${m[1]}`;
  m = c.match(/^conflicto_vin_con_fila_(\d+)$/);
  if (m) return `VIN distinto al de la fila ${m[1]} para la misma patente`;
  m = c.match(/^([a-z_]+?)_(requerido|invalida|futura|recibido_como_numero|caracteres_invalidos|demasiado_largo)$/);
  if (m) {
    const field = FIELD_LABEL[m[1]] || FIELD_LABEL[m[1].replace(/_ms$/, "")] || m[1];
    const what = { requerido: "requerido", invalida: "fecha inválida", futura: "fecha futura", recibido_como_numero: "llegó como número; revisa ceros a la izquierda", caracteres_invalidos: "caracteres inválidos", demasiado_largo: "demasiado largo" }[m[2]];
    return `${field}: ${what}`;
  }
  return c.replace(/_/g, " ");
}

export const IMPORT_STATUS_LABEL = Object.freeze({
  VALID: "Válida", WARNING: "Con advertencias", INVALID: "Inválida", DUPLICATE_EXISTING: "Ya existe", COMMITTED: "Importada",
  VALIDATED: "Validada", PARTIAL: "Parcial", COMMITTED_JOB: "Confirmada",
});

const AUDIT_EXTRA = Object.freeze({
  VEHICLE_CREATED: "Vehículo registrado",
  VEHICLE_UPDATED: "Vehículo modificado",
  VEHICLE_STATUS_CHANGED: "Cambio de estado",
  DOCUMENT_UPLOADED: "Documento agregado",
  IMPORT_VALIDATED: "Excel validado",
  IMPORT_ROW_FIXED: "Fila corregida",
  IMPORT_COMMITTED: "Importación confirmada",
});

export function auditLabel(action) {
  return AUDIT_EXTRA[action] || baseAuditLabel(action);
}

// ------------------------------------------------------------ invitación

/** Extrae el token de '#/invitacion/<token>' o '#t=<token>'. */
export function parseInviteHash(hash) {
  const h = String(hash || "");
  const m = h.match(/^#\/invitacion\/([A-Za-z0-9_-]{40,60})$/) || h.match(/^#t=([A-Za-z0-9_-]{40,60})$/);
  return m ? m[1] : null;
}

// ------------------------------------------------------------ archivos

/** ArrayBuffer → base64 (por bloques, sin desbordar la pila). */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export const MAX_XLSX_BYTES = 7 * 1024 * 1024;
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

export function checkUpload(file, kind) {
  if (!file) return "Selecciona un archivo.";
  if (kind === "xlsx") {
    if (!/\.xlsx$/i.test(file.name)) return "Solo se aceptan archivos .xlsx.";
    if (file.size > MAX_XLSX_BYTES) return "El archivo supera 7 MB.";
  } else {
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) return "Solo PDF, PNG o JPEG.";
    if (file.size > MAX_DOC_BYTES) return "El archivo supera 5 MB.";
  }
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

export const DOC_KINDS = Object.freeze([
  ["DOCUMENTO_ACREDITATIVO", "Documento acreditativo"],
  ["DOCUMENTO_JUDICIAL", "Documento judicial"],
  ["ANTECEDENTE_COMPLEMENTARIO", "Antecedente complementario"],
  ["FOTO_REFERENCIAL", "Fotografía referencial"],
  ["FOTO_FRONTAL", "Fotografía frontal"],
  ["FOTO_POSTERIOR", "Fotografía posterior"],
  ["FOTO_LATERAL", "Fotografía lateral"],
]);
export const DOC_KIND_LABEL = Object.freeze(Object.fromEntries(DOC_KINDS));

export const ASSIGNABLE_ROLES = Object.freeze([
  ["OPERADOR_EMPRESA", "Operador"],
  ["REVISOR_EMPRESA", "Revisor"],
  ["GESTOR_ALERTAS", "Gestor de alertas"],
  ["AUDITOR_LECTURA", "Auditor (lectura)"],
  ["ADMIN_EMPRESA", "Administrador"],
]);
