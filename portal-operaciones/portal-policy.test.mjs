import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlate, visibleSections } from "./portal-policy.mjs";

test("normaliza PPU sin crear una convención paralela", () => {
  assert.equal(normalizePlate("AB-CD-12"), "ABCD12");
  assert.equal(normalizePlate("ab cd 12"), "ABCD12");
});

test("visibilidad del módulo exige permisos específicos", () => {
  const hidden = visibleSections({ permissions: {} });
  assert.equal(hidden.readSuspicious, false);
  assert.equal(hidden.createSuspicious, false);
  const visible = visibleSections({ permissions: {
    suspicious_vehicles_read: true,
    suspicious_vehicles_create: true,
    suspicious_vehicles_review: true,
    suspicious_vehicles_deactivate: true,
  } });
  assert.equal(visible.readSuspicious, true);
  assert.equal(visible.createSuspicious, true);
  assert.equal(visible.reviewSuspicious, true);
  assert.equal(visible.deactivateSuspicious, true);
});

test("administrador conserva acceso global", () => {
  assert.equal(visibleSections({ is_admin: true }).readSuspicious, true);
});
