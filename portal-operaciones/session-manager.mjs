/* =========================================================
   SKANO · GESTOR CENTRALIZADO DE SESIÓN Y AUTORIZACIÓN
   ---------------------------------------------------------
   Reutilizable por cualquier módulo web que use Firebase Auth.
   No importa Firebase ni toca el DOM: recibe sus dependencias
   (leer token, leer perfiles, autorizar, cerrar sesión) y
   publica el estado por onChange.

   Estados:
     idle          sin usuario
     checking      primera verificación de un usuario
     valid         autenticado y autorizado (confirmado)
     revalidating  re-verificación en curso; se conserva el último
                   perfil confirmado
     degraded      error temporal (red, Firestore, token): NO se
                   cierra sesión; operaciones protegidas en pausa
     revoked       autorización realmente retirada (lecturas
                   completas y sin perfil válido, CONFIRMADA con un
                   token renovado y una segunda lectura) -> cierre seguro
     blocked       cuenta bloqueada o deshabilitada -> cierre seguro
     auth_invalid  Firebase confirma sesión inválida -> cierre seguro
     signed_out    cierre voluntario

   Reglas:
     - Nunca se cierra sesión por un error temporal ni porque una
       consulta haya fallado: solo con una decisión definitiva.
     - Una retirada de autorización se confirma antes de cerrar:
       se renueva el token y se vuelve a leer; si la confirmación
       falla por un error temporal la sesión queda en espera.
     - El arranque usa el token en caché (más rápido) y de inmediato
       se renueva en segundo plano; la revocación o deshabilitación
       real se detecta igual en esa renovación.
     - Una sola verificación a la vez por usuario (single-flight).
     - Los resultados de verificaciones antiguas o de otro usuario
       se descartan (contador de generación).
     - No guarda contraseñas ni tokens: la persistencia es la de
       Firebase Auth.
   ========================================================= */

export const SESSION_STATES = Object.freeze({
  IDLE: "idle",
  CHECKING: "checking",
  VALID: "valid",
  REVALIDATING: "revalidating",
  DEGRADED: "degraded",
  REVOKED: "revoked",
  BLOCKED: "blocked",
  AUTH_INVALID: "auth_invalid",
  SIGNED_OUT: "signed_out",
});

const FINAL_STATES = new Set([
  SESSION_STATES.REVOKED,
  SESSION_STATES.BLOCKED,
  SESSION_STATES.AUTH_INVALID,
]);

// Firebase confirma que la sesión ya no sirve.
const AUTH_INVALID_CODES = new Set([
  "auth/user-token-expired",
  "auth/invalid-user-token",
  "auth/user-not-found",
  "auth/invalid-credential",
  "auth/user-mismatch",
]);

const AUTH_BLOCKED_CODES = new Set(["auth/user-disabled"]);

/**
 * Clasifica un error de Firebase (Auth, Firestore o Functions):
 *   "auth_invalid" | "blocked" | "denied" | "missing" | "transient"
 * Lo desconocido se trata como temporal: nunca cierra sesión por sí solo.
 */
export function classifyError(error) {
  const code = String(error?.code || "")
    .replace(/^firestore\//, "")
    .replace(/^functions\//, "");
  if (AUTH_BLOCKED_CODES.has(code)) return "blocked";
  if (AUTH_INVALID_CODES.has(code)) return "auth_invalid";
  if (code === "permission-denied") return "denied";
  if (code === "not-found") return "missing";
  return "transient";
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/** Marca de bloqueo en un perfil (mismo criterio que el backend). */
export function isBlockedProfile(profile, nowMs = Date.now()) {
  if (!profile || typeof profile !== "object") return false;
  if (profile.blocked === true || profile.blocked_by_admin === true) return true;
  const until = toMillis(profile.blocked_until);
  return until !== null && until > nowMs;
}

/**
 * Lee varias fuentes de autorización sin que una falla haga caer a las
 * demás. Cada lectura queda como:
 *   { ok: true, data | null }                    definitiva
 *   { ok: false, kind: "denied"|"missing" }      definitiva (sin perfil)
 *   { ok: false, kind: "transient", error }      indeterminada
 * Devuelve { values: {clave: data|null}, incomplete, errors }.
 */
export async function readSources(sources) {
  const keys = Object.keys(sources);
  const settled = await Promise.allSettled(keys.map((key) => sources[key]()));
  const values = {};
  const errors = {};
  let incomplete = false;
  settled.forEach((result, index) => {
    const key = keys[index];
    if (result.status === "fulfilled") {
      values[key] = result.value ?? null;
      return;
    }
    const kind = classifyError(result.reason);
    values[key] = null;
    if (kind === "transient" || kind === "auth_invalid" || kind === "blocked") {
      incomplete = true;
      errors[key] = { kind, code: result.reason?.code || "unknown" };
    }
  });
  return { values, incomplete, errors };
}

/**
 * Decisión pura a partir de lo leído.
 *   authorize(claims, values) -> perfil de sesión o null
 *   isBlocked(values) -> true si alguna fuente marca bloqueo
 */
export function decideSession({ claims, read, authorize, isBlocked }) {
  if (isBlocked?.(read.values)) return { state: SESSION_STATES.BLOCKED, profile: null };
  const profile = authorize(claims || {}, read.values) || null;
  if (read.incomplete) {
    // No se puede afirmar ni negar el acceso: se conserva la sesión y se
    // reintenta, sin habilitar operaciones protegidas.
    return { state: SESSION_STATES.DEGRADED, profile };
  }
  if (!profile) return { state: SESSION_STATES.REVOKED, profile: null };
  return { state: SESSION_STATES.VALID, profile };
}

export function createSessionManager({
  getToken,            // (user, forceRefresh) => Promise<{ claims }>
  readProfiles,        // (user) => Promise<{ values, incomplete, errors }>
  authorize,           // (claims, values) => profile | null
  isBlocked,           // (values) => boolean
  signOut,             // () => Promise<void>
  onChange,            // (snapshot) => void
  now = () => Date.now(),
  revalidateIntervalMs = 60_000,
  tokenRefreshIntervalMs = 10 * 60_000,
  operateGraceMs = 10 * 60_000,
  retryDelaysMs = [5_000, 15_000, 30_000, 60_000],
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let snapshot = Object.freeze({
    state: SESSION_STATES.IDLE,
    uid: null,
    profile: null,
    lastConfirmedAt: 0,
    lastTokenRefreshAt: 0,
    error: null,
    reason: null,
  });
  let user = null;
  let generation = 0;
  let inflight = null;
  let retryTimer = null;
  let retryIndex = 0;
  let droppedUid = null; // usuario que Firebase retiró sin cierre voluntario

  function emit(patch) {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    try { onChange?.(snapshot); } catch (error) { console.error("[SKANO:session] onChange", error); }
  }

  function cancelRetry() {
    if (retryTimer !== null) clearTimer(retryTimer);
    retryTimer = null;
  }

  function scheduleRetry() {
    cancelRetry();
    const delay = retryDelaysMs[Math.min(retryIndex, retryDelaysMs.length - 1)];
    retryIndex += 1;
    retryTimer = setTimer(() => {
      retryTimer = null;
      revalidate({ force: true, reason: "retry" });
    }, delay);
  }

  async function finishFinal(gen, state, error) {
    if (gen !== generation) return snapshot;
    cancelRetry();
    generation += 1; // ninguna verificación en curso puede revivir la sesión
    emit({ state, profile: null, error: error ? { code: error.code || null } : null });
    user = null;
    try { await signOut(); } catch (signOutError) { console.error("[SKANO:session] signOut", signOutError); }
    return snapshot;
  }

  async function runCheck(currentUser, gen, { forceToken, reason, confirming = false }) {
    let token;
    try {
      token = await getToken(currentUser, forceToken);
    } catch (error) {
      const kind = classifyError(error);
      if (gen !== generation) {
        // Firebase Auth cierra la sesión por su cuenta ante una cuenta
        // deshabilitada o un token revocado (onAuthStateChanged(null) llega
        // antes que este error). Se conserva el motivo para informarlo.
        if ((kind === "blocked" || kind === "auth_invalid") && !user
          && snapshot.state === SESSION_STATES.IDLE && droppedUid === currentUser.uid) {
          droppedUid = null;
          emit({
            state: kind === "blocked" ? SESSION_STATES.BLOCKED : SESSION_STATES.AUTH_INVALID,
            profile: null,
            error: { code: error?.code || null },
            reason,
          });
        }
        return snapshot;
      }
      if (kind === "auth_invalid") return finishFinal(gen, SESSION_STATES.AUTH_INVALID, error);
      if (kind === "blocked") return finishFinal(gen, SESSION_STATES.BLOCKED, error);
      emit({ state: SESSION_STATES.DEGRADED, error: { code: error?.code || "unknown", stage: "token" }, reason });
      scheduleRetry();
      return snapshot;
    }

    let read;
    try {
      read = await readProfiles(currentUser);
    } catch (error) {
      read = { values: {}, incomplete: true, errors: { all: { kind: classifyError(error), code: error?.code || "unknown" } } };
    }
    if (gen !== generation || user?.uid !== currentUser.uid) return snapshot; // resultado antiguo

    const decision = decideSession({ claims: token?.claims, read, authorize, isBlocked });
    const tokenPatch = forceToken ? { lastTokenRefreshAt: now() } : {};

    if (decision.state === SESSION_STATES.VALID) {
      cancelRetry();
      retryIndex = 0;
      emit({ state: SESSION_STATES.VALID, profile: decision.profile, lastConfirmedAt: now(), error: null, reason, ...tokenPatch });
      return snapshot;
    }
    if (decision.state === SESSION_STATES.DEGRADED) {
      // Se conserva el último perfil CONFIRMADO de este usuario; un perfil
      // parcial no reemplaza al confirmado.
      emit({ state: SESSION_STATES.DEGRADED, error: { code: "incomplete", stage: "profiles", sources: Object.keys(read.errors || {}) }, reason, ...tokenPatch });
      scheduleRetry();
      return snapshot;
    }
    if (decision.state === SESSION_STATES.REVOKED && !confirming) {
      // Antes de cerrar, confirmar con un token renovado y una segunda
      // lectura: un permiso denegado puntual o un token con claims
      // desactualizados no deben expulsar al usuario.
      return runCheck(currentUser, gen, { forceToken: true, reason: `${reason}:confirm`, confirming: true });
    }
    return finishFinal(gen, decision.state, null);
  }

  function check({ forceToken = false, reason = "check" } = {}) {
    if (!user) return Promise.resolve(snapshot);
    if (inflight && inflight.uid === user.uid) return inflight.promise; // single-flight
    const currentUser = user;
    const gen = ++generation;
    emit({
      state: snapshot.profile && snapshot.uid === currentUser.uid ? SESSION_STATES.REVALIDATING : SESSION_STATES.CHECKING,
      reason,
    });
    const promise = runCheck(currentUser, gen, { forceToken, reason }).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { uid: currentUser.uid, promise };
    return promise;
  }

  /** Nuevo usuario de Firebase (o el mismo tras F5). */
  function start(nextUser) {
    cancelRetry();
    retryIndex = 0;
    inflight = null;
    generation += 1;
    const previousUid = user?.uid || null;
    user = nextUser || null;
    droppedUid = user ? null : previousUid;
    if (!user) {
      emit({ state: SESSION_STATES.IDLE, uid: null, profile: null, lastConfirmedAt: 0, lastTokenRefreshAt: 0, error: null, reason: "no-user" });
      return Promise.resolve(snapshot);
    }
    const sameUser = snapshot.uid === user.uid;
    emit({
      uid: user.uid,
      profile: sameUser ? snapshot.profile : null,       // nunca el perfil de otro usuario
      lastConfirmedAt: sameUser ? snapshot.lastConfirmedAt : 0,
      lastTokenRefreshAt: sameUser ? snapshot.lastTokenRefreshAt : 0,
      error: null,
    });
    return check({ forceToken: false, reason: "start" }).then((result) => {
      // Renovación inmediata en segundo plano: la sesión ya se muestra,
      // pero un token revocado o una cuenta deshabilitada se detectan
      // en segundos (las operaciones siguen protegidas por el servidor).
      if (result.state === SESSION_STATES.VALID && result.uid === user?.uid && result.lastTokenRefreshAt === 0) {
        return revalidate({ force: true, reason: "start-refresh" });
      }
      return result;
    });
  }

  /**
   * Re-verificación (cambio de pestaña, vuelta de la conexión, intervalo,
   * reintento). Con force=false se omite si la última confirmación es
   * reciente.
   */
  function revalidate({ force = false, reason = "revalidate" } = {}) {
    if (!user || FINAL_STATES.has(snapshot.state)) return Promise.resolve(snapshot);
    if (!force && snapshot.state === SESSION_STATES.VALID && now() - snapshot.lastConfirmedAt < revalidateIntervalMs) {
      return Promise.resolve(snapshot);
    }
    const forceToken = force || now() - snapshot.lastTokenRefreshAt >= tokenRefreshIntervalMs;
    return check({ forceToken, reason });
  }

  /** Cierre voluntario. */
  async function signOutVoluntary() {
    cancelRetry();
    droppedUid = null;
    generation += 1;
    user = null;
    emit({ state: SESSION_STATES.SIGNED_OUT, profile: null, error: null, reason: "voluntary" });
    await signOut();
  }

  /** ¿Se pueden ejecutar operaciones protegidas ahora? */
  function canOperate() {
    if (snapshot.state === SESSION_STATES.VALID) return true;
    return snapshot.state === SESSION_STATES.REVALIDATING
      && Boolean(snapshot.profile)
      && now() - snapshot.lastConfirmedAt < operateGraceMs;
  }

  return {
    start,
    revalidate,
    signOutVoluntary,
    canOperate,
    get snapshot() { return snapshot; },
  };
}
