/* =========================================================
   SKANO · GESTIÓN DE REGISTROS INSTITUCIONALES (PORTAL)
   ---------------------------------------------------------
   Acciones sobre los mismos expedientes que usa la app:
   - Editar datos (autor policial, Operaciones con permiso, admin).
   - Cerrar / vehículo recuperado (autor policial).
   - Corregir PPU y tipo (solo SUPERADMIN, auditado).
   - Autorizar acceso de Seguridad Ciudadana (administradores).
   El backend vuelve a validar cada permiso.
   ========================================================= */

import {
  VEHICLE_TYPES,
  normalizeVehicleType,
  vehicleTypeLabel,
  plateValidationMessage,
  plateCorrectionCandidates,
  normalizePlate,
  isSuperadmin,
} from "./portal-policy.mjs?v=20261117-1";

const COMMON_FIELDS = [
  ["brand", "Marca", "text", 80, true],
  ["model", "Modelo", "text", 80, true],
  ["year", "Año", "number"],
  ["color", "Color", "text", 60],
  ["vin", "VIN", "text", 100],
  ["chassis_number", "N° de chasis", "text", 100],
  ["engine_number", "N° de motor", "text", 100],
  ["region", "Región", "text", 100],
  ["commune", "Comuna", "text", 100],
  ["observation_place", "Lugar de observación", "text", 250],
  ["institutional_reference", "Referencia institucional", "text", 500],
  ["vehicle_characteristics", "Características", "textarea", 3000],
];

const STOLEN_FIELDS = [...COMMON_FIELDS, ["observations", "Observaciones", "textarea", 5000]];
const SUSPICIOUS_FIELDS = [
  ...COMMON_FIELDS,
  ["modus_operandi_category", "Categoría modus operandi", "text", 200],
  ["modus_operandi_description", "Descripción modus operandi", "textarea", 5000],
  ["observations", "Motivo de sospecha", "textarea", 5000, true],
];

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function typeOptions(selected) {
  return VEHICLE_TYPES.map(type =>
    `<option value="${type.code}"${type.code === selected ? " selected" : ""}>${esc(type.label)}</option>`
  ).join("");
}

function canEdit(item, kind, profile, uid) {
  if (!["pending_review", "approved"].includes(item.status)) return false;
  if (profile?.is_admin === true) return true;
  if (profile?.is_institutional === true) {
    return item.submitted_by_uid === uid &&
      profile?.permissions?.[kind === "stolen" ? "vehicles_create" : "suspicious_vehicles_create"] === true;
  }
  return profile?.permissions?.[kind === "stolen" ? "vehicles_create" : "suspicious_vehicles_create"] === true;
}

function canOwnerClose(item, kind, profile, uid) {
  return item.status === "approved" &&
    profile?.is_institutional === true &&
    item.submitted_by_uid === uid &&
    profile?.permissions?.[kind === "stolen" ? "vehicles_create" : "suspicious_vehicles_create"] === true;
}

export function renderInstitutionalManagement({
  item,
  kind,
  container,
  profile,
  uid,
  callables,
  cleanError,
  onChanged,
}) {
  if (!item || !container) return;

  const currentType = item.vehicle_type || normalizeVehicleType(item.type);
  const municipalAllowed = Array.isArray(item.allowed_institution_types) &&
    item.allowed_institution_types.includes("seguridad_ciudadana");
  const superadmin = isSuperadmin(profile);
  const editable = canEdit(item, kind, profile, uid);
  const ownerClose = canOwnerClose(item, kind, profile, uid);
  const history = Array.isArray(item.plate_corrections) ? item.plate_corrections : [];

  if (!editable && !ownerClose && !superadmin && profile?.is_admin !== true && !history.length) return;

  const section = document.createElement("section");
  section.className = "institutional-management";
  section.innerHTML = `
    <h3>Gestión del registro</h3>
    <p class="form-note">Tipo de vehículo: <strong>${esc(vehicleTypeLabel(currentType) || item.type || "No informado")}</strong></p>
    ${profile?.is_admin === true ? `<p class="form-note">Seguridad Ciudadana: <strong data-municipal-state>${municipalAllowed ? "AUTORIZADA" : "SIN ACCESO"}</strong></p>` : ""}
    <div class="action-stack">
      ${editable ? '<button type="button" class="secondary" data-manage="edit">EDITAR DATOS</button>' : ""}
      ${ownerClose ? '<button type="button" class="danger" data-manage="close">CERRAR / VEHÍCULO RECUPERADO</button>' : ""}
      ${superadmin ? '<button type="button" class="secondary" data-manage="plate">CORREGIR PATENTE (SUPERADMIN)</button>' : ""}
      ${profile?.is_admin === true ? `<button type="button" class="secondary" data-manage="municipal">${municipalAllowed ? "RETIRAR ACCESO SEGURIDAD CIUDADANA" : "AUTORIZAR SEGURIDAD CIUDADANA"}</button>` : ""}
    </div>
    <div data-manage-panel></div>
    ${history.length ? `<details><summary>Historial de correcciones de patente (${history.length})</summary><ul>${history.map(entry =>
      `<li>${esc(entry.from_plate)} → ${esc(entry.to_plate)} · ${esc(entry.reason)}</li>`).join("")}</ul></details>` : ""}
    <p class="form-message" data-manage-message role="alert"></p>
  `;
  container.append(section);

  const panel = section.querySelector("[data-manage-panel]");
  const message = section.querySelector("[data-manage-message]");

  async function run(button, label, action, successText) {
    message.textContent = "";
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = label; }
    try {
      const response = await action();
      if (!response?.data?.ok) throw new Error("Respuesta inesperada");
      message.textContent = successText;
      await onChanged?.();
    } catch (error) {
      const details = error?.details?.candidates;
      message.textContent = cleanError(error, "No fue posible completar la acción.") +
        (Array.isArray(details) && details.length ? ` Sugerencias: ${details.join(", ")}.` : "");
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  section.querySelector("[data-manage='edit']")?.addEventListener("click", () => {
    const fields = kind === "stolen" ? STOLEN_FIELDS : SUSPICIOUS_FIELDS;
    panel.innerHTML = `
      <form class="form-grid" data-edit-form>
        ${fields.map(([name, label, type, max, required]) => type === "textarea"
          ? `<label class="span-2">${esc(label)}${required ? " (obligatorio)" : ""}<textarea name="${name}" maxlength="${max}"${required ? " required" : ""}>${esc(item[name] ?? "")}</textarea></label>`
          : `<label>${esc(label)}${required ? " (obligatorio)" : ""}<input name="${name}" type="${type}"${max ? ` maxlength="${max}"` : ""}${type === "number" ? ' min="1900" max="2100"' : ""}${required ? " required" : ""} value="${esc(item[name] ?? "")}"></label>`
        ).join("")}
        <div class="decision-actions span-2"><button type="submit" class="primary">GUARDAR CAMBIOS</button></div>
      </form>`;
    const form = panel.querySelector("[data-edit-form]");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const changes = {};
      for (const [name, , type] of fields) {
        const raw = String(new FormData(form).get(name) ?? "").trim();
        const before = item[name] ?? (type === "number" ? null : "");
        const value = type === "number" ? (raw ? Number(raw) : null) : raw;
        if (String(value ?? "") !== String(before ?? "")) changes[name] = value;
      }
      if (!Object.keys(changes).length) {
        message.textContent = "No hay cambios para guardar.";
        return;
      }
      const updatedMs = item.updated_at ? Date.parse(item.updated_at) : NaN;
      run(form.querySelector("button[type=submit]"), "GUARDANDO…", () => callables.updateInstitutionalVehicle({
        id: item.id,
        changes,
        ...(Number.isFinite(updatedMs) ? { expected_updated_at_ms: updatedMs } : {}),
      }), "Cambios guardados. Portal y aplicación ven la versión actualizada.");
    });
  });

  section.querySelector("[data-manage='close']")?.addEventListener("click", event => {
    const reason = window.prompt("Motivo del cierre (por ejemplo: vehículo recuperado):");
    if (reason == null) return;
    if (!reason.trim()) { message.textContent = "Debes indicar un motivo."; return; }
    const close = kind === "stolen" ? callables.closeInstitutionalStolen : callables.closeSuspicious;
    run(event.currentTarget, "CERRANDO…", () => close({ id: item.id, reason: reason.trim() }),
      "Registro cerrado. El lector deja de alertar por esta patente.");
  });

  section.querySelector("[data-manage='plate']")?.addEventListener("click", () => {
    panel.innerHTML = `
      <form class="form-grid" data-plate-form>
        <label>Patente corregida<input name="plate" required maxlength="12" value="${esc(item.plate || item.observed_plate || "")}"></label>
        <label>Tipo de vehículo<select name="vehicle_type" required><option value="">Selecciona…</option>${typeOptions(currentType)}</select></label>
        <label class="span-2">Motivo de la corrección (obligatorio)<textarea name="reason" maxlength="1000" required></textarea></label>
        <p class="form-note span-2" data-plate-hint></p>
        <div class="decision-actions span-2"><button type="submit" class="primary">CORREGIR PATENTE</button></div>
      </form>`;
    const form = panel.querySelector("[data-plate-form]");
    const hint = form.querySelector("[data-plate-hint]");
    const refresh = () => {
      const plate = normalizePlate(form.elements.plate.value);
      const type = form.elements.vehicle_type.value;
      const problem = plateValidationMessage(plate, type);
      hint.textContent = problem || "Formato correcto para el tipo seleccionado.";
      hint.querySelectorAll("button").forEach(node => node.remove());
      if (problem) {
        for (const suggestion of plateCorrectionCandidates(plate, type)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "text-button";
          button.textContent = `Usar ${suggestion}`;
          button.addEventListener("click", () => { form.elements.plate.value = suggestion; refresh(); });
          hint.append(" ", button);
        }
      }
    };
    form.elements.plate.addEventListener("input", refresh);
    form.elements.vehicle_type.addEventListener("change", refresh);
    refresh();
    form.addEventListener("submit", event => {
      event.preventDefault();
      const plate = normalizePlate(form.elements.plate.value);
      const type = form.elements.vehicle_type.value;
      const problem = plateValidationMessage(plate, type);
      if (!type) { message.textContent = problem; return; }
      if (problem && !window.confirm(`${problem}\n\n¿Confirmas que ${plate} es correcta?`)) return;
      if (!window.confirm(`¿Confirmas cambiar la patente ${item.plate || ""} por ${plate}? Quedará auditado.`)) return;
      run(form.querySelector("button[type=submit]"), "CORRIGIENDO…", () => callables.correctInstitutionalVehiclePlate({
        id: item.id,
        plate,
        vehicle_type: type,
        plate_format_confirmed: Boolean(problem),
        reason: String(form.elements.reason.value || "").trim(),
      }), `Patente corregida a ${plate}.`);
    });
  });

  section.querySelector("[data-manage='municipal']")?.addEventListener("click", event => {
    const allow = !municipalAllowed;
    const reason = window.prompt(allow
      ? "Motivo para autorizar a Seguridad Ciudadana a consultar este registro:"
      : "Motivo para retirar el acceso de Seguridad Ciudadana:");
    if (reason == null) return;
    if (!reason.trim()) { message.textContent = "Debes indicar un motivo."; return; }
    run(event.currentTarget, "GUARDANDO…", () => callables.setInstitutionalRecordMunicipalAccess({
      id: item.id, allow, reason: reason.trim(),
    }), allow ? "Seguridad Ciudadana autorizada para este registro." : "Acceso de Seguridad Ciudadana retirado.");
  });
}
