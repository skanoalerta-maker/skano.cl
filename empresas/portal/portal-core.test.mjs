import test from "node:test";
import assert from "node:assert/strict";
import * as C from "./portal-core.mjs";

const PERMS = {
  ADMIN: ["company.read", "members.read", "members.manage", "notifications.manage", "contract.read", "vehicles.read", "vehicles.write", "vehicles.review", "vehicles.publish", "vehicles.withdraw", "imports.run", "documents.read", "documents.write", "alerts.read", "alerts.manage", "audit.read", "exports.run", "stats.read"],
  OPER: ["company.read", "contract.read", "vehicles.read", "vehicles.write", "imports.run", "documents.read", "documents.write", "stats.read"],
  REV: ["company.read", "contract.read", "vehicles.read", "vehicles.review", "vehicles.publish", "documents.read", "stats.read"],
  ALERT: ["company.read", "vehicles.read", "alerts.read", "alerts.manage", "stats.read"],
};

test("menú según permisos", () => {
  assert.equal(C.visibleMenu(PERMS.ADMIN).length, 8);
  assert.deepEqual(C.visibleMenu(PERMS.OPER).map((m) => m.view), ["home", "vehicles", "import", "contract"]);
  assert.deepEqual(C.visibleMenu(PERMS.REV).map((m) => m.view), ["home", "vehicles", "review", "contract"]);
  assert.deepEqual(C.visibleMenu(PERMS.ALERT).map((m) => m.view), ["home", "vehicles", "alerts"]);
  assert.deepEqual(C.visibleMenu([]), []);
});

test("acciones por estado y permiso (espejo del backend)", () => {
  const to = (s, p) => C.availableActions(s, p).map((a) => a.to);
  assert.deepEqual(to("BORRADOR", PERMS.OPER), ["PENDIENTE_REVISION"]);
  assert.deepEqual(to("PENDIENTE_REVISION", PERMS.OPER), []);
  assert.deepEqual(to("PENDIENTE_REVISION", PERMS.REV), ["OBSERVADO", "APROBADO"]);
  assert.deepEqual(to("APROBADO", PERMS.REV), ["PUBLICADO", "OBSERVADO"]);
  assert.deepEqual(to("PUBLICADO", PERMS.ADMIN), ["SUSPENDIDO", "RETIRADO", "CERRADO"]);
  assert.deepEqual(to("RETIRADO", PERMS.ADMIN), []);
  assert.equal(C.availableActions("OBSERVADO", PERMS.OPER)[0].label, "Reenviar a revisión");
  assert.equal(C.canEdit("PUBLICADO", PERMS.OPER), true);
  assert.equal(C.canEdit("CERRADO", PERMS.ADMIN), false);
  assert.equal(C.canEdit("BORRADOR", PERMS.REV), false);
});

test("diferencias de formulario y validación rápida", () => {
  assert.deepEqual(C.diffValues({ ppu: "BCDF12", color: "Rojo" }, { ppu: "BCDF12", color: "Azul " }), { color: "Azul" });
  assert.deepEqual(C.diffValues({ color: "Rojo" }, { color: "" }), { color: "" });
  const errs = C.quickValidate({ ppu: "", measure_type: "OTRA", year: "20" });
  assert.ok(errs.some((e) => e.startsWith("Patente")));
  assert.ok(errs.some((e) => e.startsWith("Describe")));
  assert.ok(errs.includes("Año: usa 4 dígitos."));
  assert.deepEqual(C.quickValidate({ ppu: "BCDF12", measure_type: "EMBARGO", court: "J", case_role: "C-1" }), []);
});

test("textos de errores de importación", () => {
  assert.equal(C.issueText("ppu_invalida"), "Patente inválida");
  assert.equal(C.issueText("duplicado_en_archivo_fila_7"), "Duplicado de la fila 7");
  assert.equal(C.issueText("case_role_requerido"), "Rol o identificador de causa: requerido");
  assert.equal(C.issueText("resolution_date_futura"), "Fecha de resolución: fecha futura");
  assert.equal(C.issueText("case_role_recibido_como_numero"), "Rol o identificador de causa: llegó como número; revisa ceros a la izquierda");
});

test("token de invitación: solo formatos válidos", () => {
  const tok = "A".repeat(43);
  assert.equal(C.parseInviteHash(`#/invitacion/${tok}`), tok);
  assert.equal(C.parseInviteHash(`#t=${tok}`), tok);
  assert.equal(C.parseInviteHash("#t=corto"), null);
  assert.equal(C.parseInviteHash(`#t=${tok}<script>`), null);
});

test("archivos: tipo y tamaño", () => {
  assert.equal(C.checkUpload({ name: "a.csv", size: 10 }, "xlsx"), "Solo se aceptan archivos .xlsx.");
  assert.equal(C.checkUpload({ name: "a.xlsx", size: 8 * 1024 * 1024 }, "xlsx"), "El archivo supera 7 MB.");
  assert.equal(C.checkUpload({ name: "a.xlsx", size: 100 }, "xlsx"), null);
  assert.equal(C.checkUpload({ name: "a.exe", size: 100 }, "doc"), "Solo PDF, PNG o JPEG.");
  assert.equal(C.arrayBufferToBase64(new TextEncoder().encode("SKANO").buffer), "U0tBTk8=");
  const big = new Uint8Array(200000).fill(65);
  assert.equal(C.arrayBufferToBase64(big.buffer).length, Math.ceil(200000 / 3) * 4);
});

test("el portal no ofrece roles de plataforma", () => {
  assert.ok(!C.ASSIGNABLE_ROLES.some(([r]) => r === "SUPERADMIN_SKANO"));
  assert.ok(C.isTestHost("localhost") && !C.isTestHost("www.skano.cl"));
});
