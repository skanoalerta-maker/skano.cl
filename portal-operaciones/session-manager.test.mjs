// Gestor de sesión: ejecutar con
//   node --test portal-operaciones/session-manager.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_STATES as S, createSessionManager, readSources, classifyError, isBlockedProfile,
} from "./session-manager.mjs";
import { authorizeOperationsSession } from "./portal-policy.mjs";

const err = (code) => Object.assign(new Error(code), { code });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

// Mundo simulado: perfiles por uid y fallas programables por fuente.
function world() {
  const db = {
    "admins/admin1": { active: true, role: "superadmin" },
    "staff_accounts/staff1": { role: "operations_staff", status: "active", permissions: { vehicles_read: true } },
    "users/police1": { role: "police", police_verified: true, institutional_status: "approved" },
    "police_officers/police1": { status: "active", verified: true, institution: "Carabineros de Chile" },
    "companies_members/empresaA1": { company_id: "empresa-A", status: "active" },
    "companies_members/empresaB1": { company_id: "empresa-B", status: "active" },
  };
  const claims = { staff1: { staff: true, staff_role: "operations_staff" } };
  const failures = {};           // "admins" -> error a lanzar
  const tokenMeta = {};           // datos extra del token (issuedAtTime)
  const tokenFailures = [];      // errores para las próximas llamadas a getToken
  const calls = { token: 0, forced: 0, read: 0, signOut: 0 };
  const timers = [];
  let clock = 1_000_000;

  const read = (collection, uid) => async () => {
    if (failures[collection]) throw failures[collection];
    // Reglas reales: admins/{uid} inexistente o inactivo -> permission-denied.
    if (collection === "admins" && !(db[`admins/${uid}`]?.active === true)) throw err("permission-denied");
    return db[`${collection}/${uid}`] ?? null;
  };

  const authorize = (tokenClaims, v) => {
    if (v.companyMember?.status === "active") return { kind: "company", company_id: v.companyMember.company_id };
    if (!authorizeOperationsSession(tokenClaims, v.staff, v.admin, v.user, v.officer)) return null;
    if (v.admin) return { kind: "admin", role: v.admin.role };
    if (v.staff) return { kind: "staff" };
    return { kind: "institutional", institution: v.officer?.institution };
  };

  const manager = createSessionManager({
    getToken: async (user, force) => {
      calls.token += 1; if (force) calls.forced += 1;
      const next = tokenFailures.shift();
      if (next) throw next;
      return { claims: claims[user.uid] || {}, ...tokenMeta };
    },
    readProfiles: async (user) => {
      calls.read += 1;
      if (world.readGate) await world.readGate.promise;
      return readSources({
        staff: read("staff_accounts", user.uid),
        admin: read("admins", user.uid),
        user: read("users", user.uid),
        officer: read("police_officers", user.uid),
        companyMember: read("companies_members", user.uid),
      });
    },
    authorize,
    isBlocked: (v) => Object.values(v).some((p) => isBlockedProfile(p, clock)),
    signOut: async () => { calls.signOut += 1; },
    onChange: () => {},
    now: () => clock,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
  });
  const api = {
    db, claims, failures, tokenFailures, tokenMeta, calls, timers, manager,
    advance(ms) { clock += ms; },
    async runTimers() { const pending = timers.splice(0); for (const t of pending) await t.fn(); await new Promise((r) => setImmediate(r)); },
  };
  return api;
}
world.readGate = null;
const user = (uid) => ({ uid });

test("clasificación de errores", () => {
  assert.equal(classifyError(err("unavailable")), "transient");
  assert.equal(classifyError(err("firestore/deadline-exceeded")), "transient");
  assert.equal(classifyError(err("auth/network-request-failed")), "transient");
  assert.equal(classifyError(new TypeError("Failed to fetch")), "transient");
  assert.equal(classifyError(err("permission-denied")), "denied");
  assert.equal(classifyError(err("auth/user-token-expired")), "auth_invalid");
  assert.equal(classifyError(err("auth/user-disabled")), "blocked");
});

test("roles: SUPERADMIN, staff, policía y empresa obtienen sesión válida", async () => {
  for (const [uid, kind] of [["admin1", "admin"], ["staff1", "staff"], ["police1", "institutional"], ["empresaA1", "company"]]) {
    const w = world();
    await w.manager.start(user(uid));
    assert.equal(w.manager.snapshot.state, S.VALID, uid);
    assert.equal(w.manager.snapshot.profile.kind, kind);
    assert.equal(w.manager.canOperate(), true);
    assert.equal(w.calls.signOut, 0);
  }
});

test("staff sin claims y usuario sin perfil: autorización denegada con cierre seguro", async () => {
  const w = world();
  delete w.claims.staff1;
  await w.manager.start(user("staff1"));
  assert.equal(w.manager.snapshot.state, S.REVOKED);
  assert.equal(w.calls.signOut, 1);
  const w2 = world();
  await w2.manager.start(user("nadie"));
  assert.equal(w2.manager.snapshot.state, S.REVOKED);
});

test("falla temporal de Firestore al volver a la pestaña: NO cierra sesión, pausa operaciones y se recupera", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  w.advance(5 * 60_000);
  w.failures.admins = err("unavailable");
  await w.manager.revalidate({ reason: "visibility" });
  assert.equal(w.manager.snapshot.state, S.DEGRADED);
  assert.equal(w.manager.snapshot.profile.kind, "admin", "conserva el último perfil confirmado");
  assert.equal(w.manager.canOperate(), false, "operaciones protegidas en pausa");
  assert.equal(w.calls.signOut, 0);
  assert.equal(w.timers.length, 1, "reintento programado");
  delete w.failures.admins;
  await w.runTimers();
  assert.equal(w.manager.snapshot.state, S.VALID);
  assert.equal(w.manager.canOperate(), true);
});

test("F5 sin conexión: la primera verificación queda en espera, sin cerrar sesión", async () => {
  const w = world();
  w.tokenFailures.push(err("auth/network-request-failed"));
  await w.manager.start(user("police1"));
  assert.equal(w.manager.snapshot.state, S.DEGRADED);
  assert.equal(w.manager.snapshot.profile, null);
  assert.equal(w.calls.signOut, 0);
  await w.runTimers();
  assert.equal(w.manager.snapshot.state, S.VALID);
});

test("Firebase confirma sesión inválida o cuenta deshabilitada: cierre seguro", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  w.tokenFailures.push(err("auth/user-token-expired"));
  await w.manager.revalidate({ force: true });
  assert.equal(w.manager.snapshot.state, S.AUTH_INVALID);
  assert.equal(w.calls.signOut, 1);

  const w2 = world();
  await w2.manager.start(user("staff1"));
  w2.tokenFailures.push(err("auth/user-disabled"));
  await w2.manager.revalidate({ force: true });
  assert.equal(w2.manager.snapshot.state, S.BLOCKED);
  assert.equal(w2.calls.signOut, 1);
});

test("revocación real y bloqueo real: cierre seguro", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  w.db["admins/admin1"].active = false;          // revocado
  await w.manager.revalidate({ force: true });
  assert.equal(w.manager.snapshot.state, S.REVOKED);
  assert.equal(w.calls.signOut, 1);

  const w2 = world();
  await w2.manager.start(user("police1"));
  w2.db["users/police1"].blocked = true;          // bloqueado
  await w2.manager.revalidate({ force: true });
  assert.equal(w2.manager.snapshot.state, S.BLOCKED);
  assert.equal(w2.calls.signOut, 1);
});

test("una revocación no se confunde con una falla temporal de otra fuente", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  w.db["admins/admin1"].active = false;
  w.failures.users = err("unavailable");          // otra lectura falla temporalmente
  await w.manager.revalidate({ force: true });
  assert.equal(w.manager.snapshot.state, S.DEGRADED, "sin lecturas completas no se decide la revocación");
  assert.equal(w.manager.canOperate(), false);
  assert.equal(w.calls.signOut, 0);
  delete w.failures.users;
  await w.runTimers();
  assert.equal(w.manager.snapshot.state, S.REVOKED, "con lecturas completas, la revocación se aplica");
});

test("verificaciones simultáneas: una sola en curso (dos pestañas o eventos repetidos)", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  const before = w.calls.read;
  world.readGate = deferred();
  const runs = [1, 2, 3, 4, 5].map(() => w.manager.revalidate({ force: true }));
  world.readGate.resolve();
  await Promise.all(runs);
  world.readGate = null;
  assert.equal(w.calls.read - before, 1);
  assert.equal(w.manager.snapshot.state, S.VALID);
});

test("resultado antiguo de otro usuario se descarta (cambio de cuenta en otra pestaña)", async () => {
  const w = world();
  world.readGate = deferred();
  const slow = w.manager.start(user("empresaA1"));
  await new Promise((r) => setImmediate(r));
  world.readGate.resolve(); world.readGate = null;
  const fast = w.manager.start(user("empresaB1"));
  await Promise.all([slow, fast]);
  assert.equal(w.manager.snapshot.uid, "empresaB1");
  assert.equal(w.manager.snapshot.profile.company_id, "empresa-B", "nunca queda la organización anterior");
});

test("al cambiar de usuario no se conserva el perfil ni la organización anteriores", async () => {
  const w = world();
  await w.manager.start(user("empresaA1"));
  w.failures.companies_members = err("unavailable");
  await w.manager.start(user("empresaB1"));
  assert.equal(w.manager.snapshot.uid, "empresaB1");
  assert.equal(w.manager.snapshot.profile, null, "sin confirmar, sin perfil: no hereda empresa-A");
  assert.equal(w.manager.canOperate(), false);
});

test("cambio de pestaña frecuente: no re-verifica dentro del intervalo; token se renueva cada 10 min", async () => {
  const w = world();
  await w.manager.start(user("staff1"));
  const reads = w.calls.read; const forced = w.calls.forced;
  for (let i = 0; i < 5; i += 1) { w.advance(10_000); await w.manager.revalidate({ reason: "visibility" }); }
  assert.equal(w.calls.read, reads, "sin lecturas repetidas al alternar pestañas");
  w.advance(60_000);
  await w.manager.revalidate({ reason: "visibility" });
  assert.equal(w.calls.read, reads + 1);
  assert.equal(w.calls.forced, forced, "token reciente: no se fuerza renovación");
  w.advance(10 * 60_000);
  await w.manager.revalidate({ reason: "visibility" });
  assert.equal(w.calls.forced, forced + 1, "inactividad prolongada: renueva token");
  assert.equal(w.manager.snapshot.state, S.VALID);
});

test("durante una re-verificación breve se pueden seguir usando las operaciones", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  world.readGate = deferred();
  const run = w.manager.revalidate({ force: true });
  await new Promise((r) => setImmediate(r));
  assert.equal(w.manager.snapshot.state, S.REVALIDATING);
  assert.equal(w.manager.canOperate(), true);
  world.readGate.resolve(); world.readGate = null;
  await run;
});

test("una verificación tardía no revive una sesión cerrada", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  world.readGate = deferred();
  const late = w.manager.revalidate({ force: true });
  await new Promise((r) => setImmediate(r));
  await w.manager.signOutVoluntary();
  world.readGate.resolve(); world.readGate = null;
  await late;
  assert.equal(w.manager.snapshot.state, S.SIGNED_OUT);
  assert.equal(w.manager.canOperate(), false);
});

test("cierre voluntario", async () => {
  const w = world();
  await w.manager.start(user("police1"));
  await w.manager.signOutVoluntary();
  assert.equal(w.manager.snapshot.state, S.SIGNED_OUT);
  assert.equal(w.calls.signOut, 1);
  assert.equal(w.manager.snapshot.profile, null);
});

// ---------------------------------------------------------------
// Confirmación antes de cerrar y arranque rápido (rama portal-ops)
// ---------------------------------------------------------------
// Falla solo durante la próxima lectura de perfiles (no en la confirmación).
const failOnce = (w, collection, error) => {
  const readAt = w.calls.read + 1;
  Object.defineProperty(w.failures, collection, {
    configurable: true, enumerable: true,
    get() { return w.calls.read === readAt ? error : undefined; },
  });
};

test("permiso denegado puntual: se confirma con token renovado y NO cierra sesión", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  const forced = w.calls.forced;
  failOnce(w, "admins", err("permission-denied"));
  await w.manager.revalidate({ force: true });
  assert.equal(w.manager.snapshot.state, S.VALID);
  assert.equal(w.calls.signOut, 0);
  assert.equal(w.calls.forced, forced + 2, "revalidación + confirmación con token renovado");
});

test("revocación real: se confirma con segunda lectura y token renovado antes de cerrar", async () => {
  const w = world();
  await w.manager.start(user("staff1"));
  const reads = w.calls.read; const forced = w.calls.forced;
  w.db["staff_accounts/staff1"].status = "disabled";
  w.advance(2 * 60_000);
  await w.manager.revalidate({ reason: "interval" });
  assert.equal(w.manager.snapshot.state, S.REVOKED);
  assert.equal(w.calls.signOut, 1);
  assert.equal(w.calls.read, reads + 2, "lectura + confirmación");
  assert.ok(w.calls.forced >= forced + 1, "la confirmación renueva el token");
});

test("confirmación con red caída: queda en espera, sin cerrar sesión", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  failOnce(w, "admins", err("permission-denied"));
  w.tokenFailures.push(undefined, err("auth/network-request-failed"));
  await w.manager.revalidate({ force: true });
  assert.equal(w.manager.snapshot.state, S.DEGRADED);
  assert.equal(w.calls.signOut, 0);
  assert.equal(w.manager.canOperate(), false);
  await w.runTimers();
  assert.equal(w.manager.snapshot.state, S.VALID);
});

test("arranque: token en caché para mostrar la interfaz y renovación forzada inmediata", async () => {
  const w = world();
  const states = [];
  const forcedSeq = [];
  const m = createSessionManager({
    getToken: async (_u, force) => { forcedSeq.push(Boolean(force)); return { claims: {} }; },
    readProfiles: async () => ({ values: { admin: { active: true, role: "admin" } }, incomplete: false, errors: {} }),
    authorize: (_c, v) => (v.admin ? { kind: "admin" } : null),
    isBlocked: () => false,
    signOut: async () => {},
    onChange: (snap) => states.push(snap.state),
    setTimer: () => 0, clearTimer: () => {},
  });
  await m.start(user("admin1"));
  assert.deepEqual(forcedSeq, [false, true], "primero caché, luego renovación forzada");
  assert.equal(states.indexOf(S.VALID) < states.indexOf(S.REVALIDATING), true, "la interfaz se habilita antes de la renovación");
  assert.equal(m.snapshot.state, S.VALID);
  assert.ok(m.snapshot.lastTokenRefreshAt > 0);
  void w;
});

test("arranque: cuenta deshabilitada se detecta en la renovación inmediata y cierra", async () => {
  const w = world();
  w.tokenFailures.push(undefined, err("auth/user-disabled"));
  await w.manager.start(user("police1"));
  assert.equal(w.manager.snapshot.state, S.BLOCKED);
  assert.equal(w.calls.signOut, 1);
});

test("arranque: token revocado se detecta en la renovación inmediata y cierra", async () => {
  const w = world();
  w.tokenFailures.push(undefined, err("auth/user-token-expired"));
  await w.manager.start(user("admin1"));
  assert.equal(w.manager.snapshot.state, S.AUTH_INVALID);
  assert.equal(w.calls.signOut, 1);
});

test("Firebase cierra solo la sesión (cuenta deshabilitada): se conserva el motivo para el mensaje", async () => {
  const states = [];
  let mgr;
  let failNext = false;
  mgr = createSessionManager({
    getToken: async () => {
      if (failNext) {
        failNext = false;
        await mgr.start(null);                       // onAuthStateChanged(null) del SDK
        throw err("auth/user-disabled");
      }
      return { claims: {} };
    },
    readProfiles: async () => ({ values: { admin: { active: true } }, incomplete: false, errors: {} }),
    authorize: (_c, v) => (v.admin ? { kind: "admin" } : null),
    isBlocked: () => false,
    signOut: async () => {},
    onChange: (snap) => states.push(snap.state),
    setTimer: () => 0, clearTimer: () => {},
  });
  await mgr.start(user("admin1"));
  failNext = true;
  await mgr.revalidate({ force: true });
  assert.equal(mgr.snapshot.state, S.BLOCKED);
  assert.equal(mgr.canOperate(), false);
  assert.deepEqual(states.slice(-2), [S.IDLE, S.BLOCKED]);
});

test("cierre voluntario: no se muestra como bloqueo aunque llegue un error tardío", async () => {
  const w = world();
  await w.manager.start(user("admin1"));
  await w.manager.signOutVoluntary();
  await w.manager.start(null);
  assert.equal(w.manager.snapshot.state, S.IDLE);
});

// ---------------------------------------------------------------
// Entrada sin consultas duplicadas
// ---------------------------------------------------------------

test("inicio de sesión con token recién emitido: una sola lectura de perfiles y sin renovación extra", async () => {
  const w = world();
  w.tokenMeta.issuedAtTime = new Date(1_000_000 - 5_000).toUTCString();
  await w.manager.start(user("admin1"));
  assert.equal(w.manager.snapshot.state, S.VALID);
  assert.equal(w.calls.read, 1, "perfiles leídos una vez");
  assert.equal(w.calls.forced, 0, "el token recién emitido no se vuelve a pedir");
  assert.ok(w.manager.snapshot.lastTokenRefreshAt > 0);
});

test("F5 con token antiguo: renovación forzada sin repetir la lectura de perfiles", async () => {
  const w = world();
  w.tokenMeta.issuedAtTime = new Date(1_000_000 - 30 * 60_000).toUTCString();
  await w.manager.start(user("staff1"));
  assert.equal(w.manager.snapshot.state, S.VALID);
  assert.equal(w.calls.forced, 1, "una renovación forzada");
  assert.equal(w.calls.read, 1, "sin lectura duplicada");
});

test("F5: si el token renovado ya no trae los claims de staff, se confirma y se cierra", async () => {
  const w = world();
  w.tokenMeta.issuedAtTime = new Date(1_000_000 - 30 * 60_000).toUTCString();
  let tokenCalls = 0;
  const original = w.claims.staff1;
  // El primer token (en caché) aún trae el claim; el renovado ya no.
  Object.defineProperty(w.claims, "staff1", { configurable: true, get() { tokenCalls += 1; return tokenCalls === 1 ? original : {}; } });
  await w.manager.start(user("staff1"));
  assert.equal(w.manager.snapshot.state, S.REVOKED);
  assert.equal(w.calls.signOut, 1);
  assert.equal(w.calls.read, 2, "la revocación se confirma con una lectura nueva");
});

test("revalidación periódica sigue leyendo los perfiles (no reutiliza la lectura)", async () => {
  const w = world();
  w.tokenMeta.issuedAtTime = new Date(1_000_000 - 30 * 60_000).toUTCString();
  await w.manager.start(user("admin1"));
  const reads = w.calls.read;
  w.advance(2 * 60_000);
  await w.manager.revalidate({ reason: "interval" });
  assert.equal(w.calls.read, reads + 1);
});
