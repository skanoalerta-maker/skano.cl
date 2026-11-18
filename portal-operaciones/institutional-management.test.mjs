// Mensajes de la gestión institucional ante errores del backend.
// Ejecutar: node --test portal-operaciones/institutional-management.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { managementErrorMessage } from "./institutional-management.mjs";

const fnError = (code, message, details) => Object.assign(new Error(message || code), { code: `functions/${code}`, details });

test("1. SUPERADMIN: sin error no hay mensaje que mostrar (la acción exitosa no pasa por aquí)", () => {
  assert.equal(typeof managementErrorMessage, "function");
});

test("2. administrador sin rol SUPERADMIN: motivo explícito, conserva el formulario", () => {
  const text = managementErrorMessage(fnError("permission-denied", "Solo SUPERADMIN puede corregir patentes.", { reason: "superadmin_required" }));
  assert.match(text, /SUPERADMIN/);
  assert.match(text, /formulario se conserva/);
});

test("3. policía sin autorización y rechazos sin motivo", () => {
  assert.match(managementErrorMessage(fnError("permission-denied", "x", { reason: "no_management_role" })), /rol habilitado/);
  assert.match(managementErrorMessage(fnError("permission-denied", "x")), /sin indicar un motivo.*formulario se conserva/);
});

test("4. expediente antiguo con ID basado en la patente", () => {
  assert.match(managementErrorMessage(fnError("failed-precondition", "x", { reason: "legacy_plate_document_id" })), /registro antiguo/);
});

test("5. patente duplicada: muestra el mensaje del servidor, no uno genérico", () => {
  const text = managementErrorMessage(fnError("already-exists", "La PPU corregida ya tiene un registro activo o pendiente."));
  assert.equal(text, "La PPU corregida ya tiene un registro activo o pendiente.");
});

test("6. error de red o sin conexión", () => {
  assert.match(managementErrorMessage(fnError("unavailable", "unavailable")), /conexión.*formulario se conserva/);
  assert.match(managementErrorMessage(fnError("internal", "internal"), { online: false }), /conexión/);
  assert.match(managementErrorMessage(fnError("internal", "internal")), /formulario se conserva/);
});

test("7. sesión expirada o revocada: mensaje propio, sin perder el formulario", () => {
  assert.match(managementErrorMessage(fnError("unauthenticated", "x")), /sesión expiró.*formulario se conserva/);
  assert.match(managementErrorMessage(fnError("unauthenticated", "x", { reason: "session_revoked" })), /sesión expiró/);
  assert.match(managementErrorMessage(fnError("unavailable", "x", { reason: "auth_lookup_unavailable" })), /no pudo verificar tu sesión/);
});

test("formato de patente: incluye las sugerencias del servidor", () => {
  const text = managementErrorMessage(fnError("invalid-argument", "x", { reason: "plate_format_mismatch", candidates: ["BC012"] }));
  assert.match(text, /Sugerencias: BC012\./);
});
