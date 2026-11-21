import test from "node:test";
import assert from "node:assert/strict";
import * as C from "./admin-core.mjs";

test("guardia de entorno: solo hosts locales de prueba", () => {
  for (const h of ["localhost", "127.0.0.1", "LOCALHOST"]) assert.equal(C.isTestHost(h), true);
  for (const h of ["www.skano.cl", "skano.cl", "skano-app-e734d.web.app", "", undefined]) assert.equal(C.isTestHost(h), false);
  assert.equal(C.TEST_ENV, undefined, "la configuración vive solo en ../judicial-env.mjs");
});

test("RUT: validación y formato", () => {
  assert.equal(C.isValidRut("76.086.428-5"), true);
  assert.equal(C.isValidRut("76086428-4"), false);
  assert.equal(C.formatRut("76086428-5"), "76.086.428-5");
  assert.equal(C.formatRut("1111111-K".replace("K", C.rutCheckDigit("1111111"))), `1.111.111-${C.rutCheckDigit("1111111")}`);
});

test("cupos: porcentaje y nivel", () => {
  assert.equal(C.quotaPercent(50, 100), 50);
  assert.equal(C.quotaPercent(0, 0), 0);
  assert.equal(C.quotaLevel(95, 100), "high");
  assert.equal(C.quotaLevel(120, 100), "over");
  assert.equal(C.quotaPercent(120, 100), 100);
});

test("payload de empresa: validaciones", () => {
  const bad = C.buildCompanyPayload({ legal_name: "A", trade_name: "", rut: "1-1", primary_email: "x" });
  assert.equal(bad.errors.length, 4);
  const ok = C.buildCompanyPayload({ legal_name: "Cobranzas SpA", trade_name: "Cobranzas", rut: "76.086.428-5", primary_email: " A@B.CL ", rep_name: "Rep" });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.payload.primary_email, "a@b.cl");
  assert.equal(ok.payload.representatives.length, 1);
});

test("payload de contrato: duración, fechas y módulos", () => {
  const ok = C.buildContractPayload({ company_id: "x-1", starts_at: "2026-12-01", duration: "6", judicial_enabled: true, judicial_quota: "1.500", theft_enabled: false, theft_quota: "0" });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.payload.months, 6);
  assert.equal(ok.payload.modules.judicial.quota, 1500);
  assert.equal("detection_alerts_enabled" in ok.payload, false, "el panel nunca envía alertas por detección");
  const custom = C.buildContractPayload({ company_id: "x", starts_at: "2026-12-01", duration: "custom", ends_at: "2026-11-01", judicial_enabled: true, judicial_quota: 1 });
  assert.ok(custom.errors.includes("La fecha de término debe ser posterior al inicio."));
  const none = C.buildContractPayload({ company_id: "x", starts_at: "2026-12-01", duration: "3" });
  assert.ok(none.errors.includes("Activa al menos un módulo."));
  const zero = C.buildContractPayload({ company_id: "x", starts_at: "2026-12-01", duration: "3", judicial_enabled: "on", judicial_quota: "0" });
  assert.ok(zero.errors.some((e) => e.includes("cupo 0")));
});

test("mensajes de error legibles", () => {
  assert.equal(C.errorMessage({ details: { reason: "legal-basis-pending" } }), "Bloqueado hasta resolver la base legal (sección 21).");
  assert.equal(C.errorMessage({ message: "Ya existe una empresa con ese RUT." }), "Ya existe una empresa con ese RUT.");
  assert.equal(C.errorMessage({}), "Error interno. Intenta nuevamente.");
});

test("enlace de invitación recortado al mostrar", () => {
  const shown = C.inviteLinkForDisplay("http://127.0.0.1:8088/empresas/portal/invitacion/#t=ABCDEFGHIJKLMNOP");
  assert.ok(shown.endsWith("#t=ABCDEF…"));
});

test("fechas en zona horaria de Chile", () => {
  assert.equal(C.formatDate(Date.UTC(2026, 10, 20, 15)), "20-11-2026");
  assert.equal(C.formatDate(null), "—");
});

test("eventos de contrato en español", () => {
  assert.equal(C.contractEventLabel("QUOTA_INCREASE"), "Ampliación de cupo");
  assert.equal(C.contractEventLabel("STATUS_CANCELLED"), "Contrato cancelado");
});

test("errores de conectividad se distinguen de errores del servidor", () => {
  assert.equal(C.errorMessage({ code: "functions/internal", message: "internal" }), C.CONNECTIVITY_TEXT);
  assert.equal(C.errorMessage({ code: "functions/unavailable", message: "x" }), C.CONNECTIVITY_TEXT);
  assert.equal(C.errorMessage({ code: "functions/internal", message: "Error interno.", details: { reason: "internal" } }), "Error interno. Intenta nuevamente.");
});

test("enlace de invitación: se adapta al dominio del mismo entorno (antes del DNS)", () => {
  const hosts = ["empresas.skano.cl", "skano-judicial-prd.web.app"];
  const url = "https://empresas.skano.cl/portal/invitacion/#t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd";
  assert.equal(C.localizeInviteUrl(url, "https://skano-judicial-prd.web.app", hosts),
    "https://skano-judicial-prd.web.app/portal/invitacion/#t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd");
  assert.equal(C.localizeInviteUrl(url, "https://empresas.skano.cl", hosts), url, "mismo dominio: sin cambios");
  assert.equal(C.localizeInviteUrl(url, "https://otro-sitio.web.app", hosts), url, "dominio ajeno al entorno: sin cambios");
  assert.equal(C.localizeInviteUrl("https://malicioso.example/portal/#t=x", "https://skano-judicial-prd.web.app", hosts), "https://malicioso.example/portal/#t=x");
  assert.equal(C.localizeInviteUrl(url, "http://127.0.0.1:8088", []), url, "emulador: sin cambios");
  assert.equal(C.localizeInviteUrl("", "https://skano-judicial-prd.web.app", hosts), "");
  assert.equal(C.localizeInviteUrl("no-es-url", "https://skano-judicial-prd.web.app", hosts), "no-es-url");
});
