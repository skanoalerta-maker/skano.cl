import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlate, validatedEvidencePaths, visibleSections } from "./portal-policy.mjs";

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

test("evidencia exige UID, submission, nombres exactos, count, principal y paths únicos", () => {
  const base = "institutional_vehicle_submissions/user-a/submission-a/evidence/";
  const valid = {
    id: "submission-a",
    submitted_by_uid: "user-a",
    evidence_storage_paths: [`${base}photo_1.jpg`, `${base}photo_2.jpg`],
    primary_evidence_storage_path: `${base}photo_1.jpg`,
    evidence_count: 2,
  };
  assert.deepEqual(validatedEvidencePaths(valid), valid.evidence_storage_paths);
  assert.deepEqual(validatedEvidencePaths({ ...valid, evidence_count: 1 }), []);
  assert.deepEqual(validatedEvidencePaths({ ...valid, primary_evidence_storage_path: `${base}photo_2.jpg` }), []);
  assert.deepEqual(validatedEvidencePaths({ ...valid, evidence_storage_paths: [`${base}photo_1.jpg`, `${base}photo_1.jpg`] }), []);
  assert.deepEqual(validatedEvidencePaths({ ...valid, evidence_storage_paths: ["institutional_vehicle_submissions/user-b/submission-a/evidence/photo_1.jpg"], evidence_count: 1 }), []);
  assert.deepEqual(validatedEvidencePaths({ id: "historical", submitted_by_uid: "user-a" }), []);
});
