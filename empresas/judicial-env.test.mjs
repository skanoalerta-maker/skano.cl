import test from "node:test";
import assert from "node:assert/strict";
import * as E from "./judicial-env.mjs";

const PROD = { stage: "production", hosts: ["www.skano.cl", "skano.cl"], projectId: "skano-judicial-prd", apiKey: "AIzaPublica", authDomain: "skano-judicial-prd.firebaseapp.com", appId: "1:2:web:3", appCheckSiteKey: "6Lclave", region: "southamerica-west1" };

test("entorno: local solo emuladores con proyecto demo", () => {
  for (const h of ["localhost", "127.0.0.1", "LOCALHOST"]) {
    const r = E.resolveEnvironment(h);
    assert.equal(r.status, "ok");
    assert.equal(r.env.stage, "emulator");
    assert.match(r.env.projectId, /^demo-/);
  }
});

test("entorno: la configuración versionada mantiene producción bloqueada", () => {
  for (const h of ["www.skano.cl", "skano.cl"]) assert.deepEqual(E.resolveEnvironment(h), { status: "blocked", reason: "not-configured" });
  for (const h of ["evil.example", "skano.cl.evil.example", "skano-app-e734d.web.app", "", undefined]) assert.equal(E.resolveEnvironment(h).status, "blocked");
});

test("entorno: producción solo con configuración completa y válida", () => {
  assert.equal(E.resolveEnvironment("www.skano.cl", [PROD]).env.projectId, "skano-judicial-prd");
  for (const k of ["projectId", "apiKey", "authDomain", "appId", "appCheckSiteKey"]) {
    assert.equal(E.resolveEnvironment("www.skano.cl", [{ ...PROD, [k]: " " }]).status, "blocked", k);
  }
  assert.equal(E.resolveEnvironment("www.skano.cl", [{ ...PROD, projectId: "demo-x" }]).reason, "invalid");
  assert.equal(E.resolveEnvironment("www.skano.cl", [{ ...PROD, region: "us-central1" }]).reason, "invalid");
  assert.equal(E.resolveEnvironment("otro.skano.cl", [PROD]).status, "blocked");
});

test("entorno: una sola versión del SDK", () => {
  assert.match(E.SDK_VERSION, /^\d+\.\d+\.\d+$/);
});

test("TOTP: clave legible y código de 6 dígitos", () => {
  assert.equal(E.formatTotpSecret("abcdefghijklmnop"), "ABCD EFGH IJKL MNOP");
  assert.equal(E.normalizeTotpCode(" 123 456 "), "123456");
  for (const bad of ["12345", "1234567", "12a456", "", null]) assert.equal(E.normalizeTotpCode(bad), "");
});

test("errores TOTP: código incorrecto se reintenta; sesión vencida pide clave nueva", () => {
  assert.equal(E.totpErrorKind({ code: "auth/invalid-verification-code" }), "code");
  assert.equal(E.totpErrorKind({ code: "auth/requires-recent-login" }), "expired");
  assert.equal(E.totpErrorKind({ code: "auth/invalid-multi-factor-session" }), "expired");
  assert.equal(E.totpErrorKind({ code: "auth/network-request-failed" }), "network");
  assert.equal(E.totpErrorKind({ code: "auth/internal-error" }), "other");
  assert.equal(E.totpErrorKind(null), "other");
});
