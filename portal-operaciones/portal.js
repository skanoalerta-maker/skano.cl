import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js";

import {
  getBlob,
  getStorage,
  ref as storageRef,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

import {
  authorizeOperationsSession,
  hasPermission,
  normalizePlate,
  validatedEvidencePaths
} from "./portal-policy.mjs";


/* =========================================================
   FIREBASE
   ========================================================= */

const firebaseConfig = Object.freeze({
  projectId: "skano-app-e734d",
  appId: "1:663221835822:web:339ba87801334f55b1e7bf",
  storageBucket: "skano-app-e734d.firebasestorage.app",
  apiKey: "AIzaSyAB9eiXvC5EifYp0P_ZxtI8HIwdVsPXTF4",
  authDomain: "skano-app-e734d.firebaseapp.com",
  messagingSenderId: "663221835822",
  measurementId: "G-3QJ70H0TQ3"
});


const app =
  initializeApp(firebaseConfig);


if (
  app.options.projectId !==
  "skano-app-e734d"
) {
  throw new Error(
    "Proyecto Firebase no autorizado."
  );
}


const auth =
  getAuth(app);

const db =
  getFirestore(app);

const functions =
  getFunctions(
    app,
    "us-central1"
  );

const storage = getStorage(app);


/* =========================================================
   CLOUD FUNCTIONS
   ========================================================= */

const callables =
  Object.freeze({

    createVehicle:
      httpsCallable(
        functions,
        "createOperationsVehicle"
      ),

    deactivateVehicle:
      httpsCallable(
        functions,
        "deactivateOperationsVehicle"
      ),

    exportVehicles:
      httpsCallable(
        functions,
        "exportOperationsVehicles"
      ),

    reviewRequest:
      httpsCallable(
        functions,
        "reviewInstitutionalRequest"
      ),

    listSuspicious: httpsCallable(functions, "listInstitutionalSuspiciousVehicles"),
    getSuspicious: httpsCallable(functions, "getInstitutionalSuspiciousVehicle"),
    createSuspicious: httpsCallable(functions, "createInstitutionalSuspiciousVehicle"),
    approveSuspicious: httpsCallable(functions, "approveInstitutionalSuspiciousVehicle"),
    rejectSuspicious: httpsCallable(functions, "rejectInstitutionalSuspiciousVehicle"),
    closeSuspicious: httpsCallable(functions, "closeInstitutionalSuspiciousVehicle")

  });


/* =========================================================
   ESTADO
   ========================================================= */

const state = {

  profile: null,

  user: null,

  vehicles: [],

  requests: [],

  suspicious: [],

  suspiciousCursor: null,
  suspiciousEvidenceUrls: [],
  suspiciousEvidenceIndex: 0,

  selectedSuspicious: null,

  pendingSuspiciousAction: null,

  selectedVehicle: null,

  selectedRequest: null,

  pendingRequestDecision: null,

  validated: false

};


/* =========================================================
   HELPERS DOM
   ========================================================= */

const $ =
  (
    selector,
    root = document
  ) =>
    root.querySelector(
      selector
    );


const $$ =
  (
    selector,
    root = document
  ) =>
    [
      ...root.querySelectorAll(
        selector
      )
    ];


/* =========================================================
   FECHAS
   ========================================================= */

const safeDate =
  value => {

    const date =
      value?.toDate?.() ??
      (
        value
          ? new Date(value)
          : null
      );


    return (
      date &&
      !Number.isNaN(
        date.getTime()
      )
    )
      ? new Intl.DateTimeFormat(
          "es-CL",
          {
            dateStyle:
              "medium"
          }
        ).format(
          date
        )
      : "—";
  };


/* =========================================================
   LOG TÉCNICO
   ========================================================= */

const technicalError =
  (
    scope,
    error
  ) =>
    console.error(
      `[SKANO:${scope}]`,
      error?.code ||
        "unknown",
      error?.message ||
        "Error"
    );


/* =========================================================
   ERRORES LIMPIOS
   ========================================================= */

const cleanError =
  (
    error,
    fallback
  ) => {

    if (
      error?.code?.includes(
        "unauthenticated"
      )
    ) {
      return (
        "Sesión expirada. " +
        "Vuelve a ingresar."
      );
    }


    if (
      error?.code?.includes(
        "permission-denied"
      )
    ) {
      return (
        "Permiso insuficiente " +
        "para realizar esta operación."
      );
    }


    if (
      error?.code?.includes(
        "already-exists"
      )
    ) {
      return (
        "Ya existe un vehículo " +
        "con esa patente."
      );
    }


    if (
      error?.code?.includes(
        "failed-precondition"
      )
    ) {
      return (
        "La solicitud ya fue procesada " +
        "o cambió de estado."
      );
    }


    return fallback;
  };


/* =========================================================
   BOTONES OCUPADOS
   ========================================================= */

function setBusy(
  button,
  busy,
  label
) {

  if (!button) {
    return;
  }


  if (busy) {

    button.dataset.original =
      button.textContent;

  }


  button.disabled =
    busy;


  button.textContent =
    busy
      ? label
      : (
          button.dataset.original ||
          button.textContent
        );
}


/* =========================================================
   AVISOS
   ========================================================= */

function notice(
  message,
  type = "success"
) {

  const node =
    $("#notice");


  if (!node) {
    return;
  }


  node.textContent =
    message;


  node.className =
    `notice ${type}`;


  node.hidden =
    false;


  clearTimeout(
    notice.timer
  );


  notice.timer =
    setTimeout(
      () => {

        node.hidden =
          true;

      },
      5000
    );
}


/* =========================================================
   PERMISOS
   ========================================================= */

function permission(
  name
) {

  return hasPermission(
    state.profile,
    name
  );
}


function enforcePermissions() {

  $$(
    "[data-permission]"
  ).forEach(
    node => {

      node.hidden =
        !permission(
          node.dataset.permission
        );

    }
  );

  $$(
    "[data-operations-only]"
  ).forEach(
    node => {

      node.hidden =
        state.profile?.is_institutional === true;

    }
  );
}


/* =========================================================
   INVALIDAR SESIÓN
   ========================================================= */

async function invalidate(
  message =
    "No tienes autorización para ingresar al Portal de Operaciones SKANO."
) {

  state.validated =
    false;

  state.profile =
    null;

  state.user =
    null;


  await signOut(
    auth
  ).catch(
    () => {}
  );


  $("#portalView").hidden =
    true;

  $("#loadingView").hidden =
    true;

  $("#loginView").hidden =
    false;


  $("#loginMessage").textContent =
    message;
}


/* =========================================================
   LEER PERFILES DE AUTORIZACIÓN

   IMPORTANTE:

   Un operations_staff normalmente puede leer:
   staff_accounts/{uid}

   Pero NO necesita poder leer:
   admins/{uid}

   Un admin puede leer su:
   admins/{uid}

   Por eso usamos Promise.allSettled.
   Una consulta denegada NO hace caer automáticamente
   la otra autorización válida.
   ========================================================= */

async function readAuthorizationProfiles(
  user
) {

  const [
    staffResult,
    adminResult,
    userResult,
    officerResult
  ] =
    await Promise.allSettled([

      getDoc(
        doc(
          db,
          "staff_accounts",
          user.uid
        )
      ),

      getDoc(
        doc(
          db,
          "admins",
          user.uid
        )
      ),

      getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      ),

      getDoc(
        doc(
          db,
          "police_officers",
          user.uid
        )
      )

    ]);


  const staffSnap =
    staffResult.status ===
    "fulfilled"
      ? staffResult.value
      : null;


  const adminSnap =
    adminResult.status ===
    "fulfilled"
      ? adminResult.value
      : null;


  const userSnap =
    userResult.status ===
    "fulfilled"
      ? userResult.value
      : null;


  const officerSnap =
    officerResult.status ===
    "fulfilled"
      ? officerResult.value
      : null;


  return {

    staffProfile:
      staffSnap?.exists()
        ? staffSnap.data()
        : null,

    adminProfile:
      adminSnap?.exists()
        ? adminSnap.data()
        : null,

    userProfile:
      userSnap?.exists()
        ? userSnap.data()
        : null,

    officerProfile:
      officerSnap?.exists()
        ? officerSnap.data()
        : null

  };
}


/* =========================================================
   CONSTRUIR PERFIL DE SESIÓN
   ========================================================= */

function buildSessionProfile(
  staffProfile,
  adminProfile,
  userProfile,
  officerProfile
) {

  const isAdmin =

    adminProfile?.active ===
      true &&

    [
      "admin",
      "superadmin"
    ].includes(
      adminProfile?.role
    );


  if (isAdmin) {

    return {

      ...adminProfile,

      is_admin:
        true,

      is_institutional:
        false,

      status:
        "active"

    };

  }


  const isStaff =
    staffProfile?.role === "operations_staff" &&
    staffProfile?.status === "active";


  if (isStaff) {

    return {

      ...staffProfile,

      is_admin:
        false,

      is_institutional:
        false

    };

  }


  const isInstitutional =
    userProfile?.role === "police" &&
    userProfile?.police_verified === true &&
    userProfile?.institutional_status === "approved" &&
    officerProfile?.status === "active" &&
    officerProfile?.verified === true &&
    officerProfile?.can_manage_vehicles === true &&
    officerProfile?.vehicle_manager_status === "active";


  if (isInstitutional) {

    return {

      ...userProfile,
      ...officerProfile,

      role:
        "institutional_vehicle_manager",

      status:
        "active",

      is_admin:
        false,

      is_institutional:
        true,

      full_name:
        officerProfile?.full_name ||
        userProfile?.full_name ||
        userProfile?.name ||
        null,

      institution:
        officerProfile?.institution ||
        userProfile?.institution ||
        "Institución acreditada",

      permissions: {

        suspicious_vehicles_read:
          true,

        suspicious_vehicles_create:
          true,

        suspicious_vehicles_review:
          false,

        suspicious_vehicles_deactivate:
          false,

        vehicles_read:
          false,

        vehicles_create:
          false,

        vehicles_deactivate:
          false,

        vehicles_export:
          false,

        institutional_requests_read:
          false,

        institutional_requests_review:
          false

      }

    };

  }


  return null;
}


/* =========================================================
   VALIDACIÓN DE SESIÓN

   PERMITE:

   - operations_staff válido
   - admin activo
   - superadmin activo

   NO autoriza por correo.
   NO autoriza solo por estar autenticado.
   ========================================================= */

async function validateSession(
  user
) {

  $("#loginView").hidden =
    true;

  $("#portalView").hidden =
    true;

  $("#loadingView").hidden =
    false;


  try {

    /*
     * Renueva token para recoger
     * claims actuales.
     */

    await user.getIdToken(
      true
    );


    const token =
      await user.getIdTokenResult();


    /*
     * Lee ambos caminos posibles
     * sin hacer caer toda la sesión
     * si uno de ellos está prohibido.
     */

    const {
      staffProfile,
      adminProfile,
      userProfile,
      officerProfile
    } =
      await readAuthorizationProfiles(
        user
      );


    /*
     * Seguridad real del portal.
     */

    const authorized =
      authorizeOperationsSession(
        token.claims,
        staffProfile,
        adminProfile,
        userProfile,
        officerProfile
      );


    if (!authorized) {

      await invalidate();

      return;

    }


    const profile =
      buildSessionProfile(
        staffProfile,
        adminProfile,
        userProfile,
        officerProfile
      );


    if (!profile) {

      await invalidate();

      return;

    }


    state.user =
      user;

    state.profile =
      profile;

    state.validated =
      true;


    const displayName =

      profile?.full_name ||

      profile?.name ||

      user.displayName ||

      user.email?.split(
        "@"
      )[0] ||

      "funcionario";


    $("#welcomeName").textContent =
      displayName;


    $("#sidebarName").textContent =
      displayName;


    $("#sidebarEmail").textContent =
      user.email || "";

    const displayRole = profile?.is_admin === true
      ? (profile?.role === "superadmin" ? "SUPERADMIN" : "ADMINISTRADOR")
      : profile?.is_institutional === true
        ? "ACCESO INSTITUCIONAL"
        : "OPERADOR DE CONTROL";

    $("#sidebarRole").textContent = displayRole;
    $("#topbarOperator").textContent = displayName;
    $("#topbarRole").textContent = displayRole;


    enforcePermissions();


    /*
     * Oculta validación y muestra portal.
     */

    $("#loadingView").hidden =
      true;


    $("#loginView").hidden =
      true;


    $("#portalView").hidden =
      false;


    /*
     * Estas cargas NO bloquean
     * el ingreso al portal.
     */

    await Promise.allSettled([

      loadVehicles(),

      permission(
        "institutional_requests_read"
      )
        ? loadRequests()
        : Promise.resolve(),

      permission("suspicious_vehicles_read")
        ? loadSuspiciousVehicles({ reset: true })
        : Promise.resolve(),

      loadDashboardAggregates()

    ]);

    renderRecentMovements();

  } catch (error) {

    technicalError(
      "session",
      error
    );


    await invalidate(
      error?.code?.includes(
        "permission-denied"
      )
        ? (
            "No tienes autorización " +
            "para ingresar al Portal " +
            "de Operaciones SKANO."
          )
        : (
            "No fue posible " +
            "validar la sesión."
          )
    );

  }
}


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
  auth,
  user => {

    /*
     * Firebase conserva sesiones.
     * Si existe una sesión autenticada,
     * vuelve a validarse el rol.
     */

    if (user) {

      validateSession(
        user
      );

      return;

    }


    state.validated =
      false;

    state.user =
      null;

    state.profile =
      null;


    $("#loadingView").hidden =
      true;


    $("#portalView").hidden =
      true;


    $("#loginView").hidden =
      false;

  }
);


/* =========================================================
   LOGIN
   ========================================================= */

$("#loginForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const button =
      $("#loginButton");


    const email =
      $("#email")
        .value
        .trim();


    const password =
      $("#password")
        .value;


    $("#loginMessage").textContent =
      "";


    /*
     * No permite enviar formulario
     * sin ambos campos.
     */

    if (
      !email ||
      !password
    ) {

      $("#loginMessage").textContent =
        "Debes ingresar correo electrónico y contraseña.";

      return;

    }


    setBusy(
      button,
      true,
      "VALIDANDO…"
    );


    try {

      /*
       * Firebase Authentication exige
       * correo + contraseña correcta.
       */

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


      $("#password").value =
        "";

    } catch (error) {

      technicalError(
        "login",
        error
      );


      $("#password").value =
        "";


      $("#loginMessage").textContent =

        error?.code ===
        "auth/invalid-credential"

          ? (
              "Correo o contraseña " +
              "incorrectos."
            )

          : (
              "No fue posible " +
              "iniciar sesión."
            );

    } finally {

      setBusy(
        button,
        false
      );

    }
  }
);


/* =========================================================
   RESTABLECER CONTRASEÑA
   ========================================================= */

$("#forgotPasswordButton").addEventListener(
  "click",
  async () => {

    const email =
      $("#email")
        .value
        .trim();


    const message =
      $("#loginMessage");


    message.classList.remove(
      "neutral"
    );


    if (!email) {

      message.textContent =
        "Ingresa tu correo electrónico para continuar.";


      $("#email").focus();


      return;
    }


    const button =
      $("#forgotPasswordButton");


    setBusy(
      button,
      true,
      "ENVIANDO…"
    );


    message.textContent =
      "";


    try {

      await sendPasswordResetEmail(
        auth,
        email
      );

    } catch (error) {

      technicalError(
        "password-reset",
        error
      );

    } finally {

      /*
       * Mensaje neutro:
       * no revela si una cuenta existe.
       */

      message.textContent =
        "Si el correo corresponde a una cuenta autorizada, recibirás instrucciones para restablecer tu contraseña.";


      message.classList.add(
        "neutral"
      );


      setBusy(
        button,
        false
      );

    }
  }
);


/* =========================================================
   LOGOUT
   ========================================================= */

$("#logoutButton").addEventListener(
  "click",
  async () => {

    state.validated =
      false;

    state.user =
      null;

    state.profile =
      null;


    await signOut(
      auth
    );


    location.replace(
      "/portal-operaciones/"
    );

  }
);


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function showView(
  name
) {

  if (
    name === "vehicles" &&
    !permission("vehicles_read")
  ) {

    return notice(
      "Tu sesión no tiene acceso a vehículos con encargo.",
      "error"
    );

  }


  if (
    name === "administration" &&
    state.profile?.is_institutional === true
  ) {

    return notice(
      "Esta sección está reservada para Operaciones SKANO.",
      "error"
    );

  }


  if (
    name ===
      "requests" &&

    !permission(
      "institutional_requests_read"
    )
  ) {

    return notice(
      "No tienes permiso para acceder a acreditaciones.",
      "error"
    );

  }


  if (
    name ===
      "exports" &&

    !permission(
      "vehicles_export"
    )
  ) {

    return notice(
      "No tienes permiso para exportar.",
      "error"
    );

  }

  if (name === "suspicious" && !permission("suspicious_vehicles_read")) {
    return notice("No tienes permiso para consultar vehículos sospechosos.", "error");
  }


  $$(
    ".view"
  ).forEach(
    node => {

      node.classList.toggle(
        "active",
        node.dataset.panel ===
          name
      );

    }
  );


  $$(
    ".nav-item"
  ).forEach(
    node => {

      node.classList.toggle(
        "active",
        node.dataset.view ===
          name
      );

    }
  );


  const sidebar =
    $(".sidebar");


  if (sidebar) {

    sidebar.classList.remove(
      "open"
    );

  }
}


/* =========================================================
   BOTONES NAVEGACIÓN
   ========================================================= */

$$(
  ".nav-item"
).forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        showView(
          button.dataset.view
        );

      }
    );

  }
);


$$(
  "[data-go]"
).forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        showView(
          button.dataset.go
        );

      }
    );

  }
);


/* =========================================================
   MENÚ MÓVIL
   ========================================================= */

$("#menuButton").addEventListener(
  "click",
  () => {

    $(".sidebar")
      ?.classList
      .toggle(
        "open"
      );

  }
);


/* =========================================================
   RELOJ
   ========================================================= */

function updateClock() {

  const clock =
    $("#clock");


  if (!clock) {
    return;
  }


  clock.textContent =
    new Intl.DateTimeFormat(
      "es-CL",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short"
      }
    ).format(
      new Date()
    );
}


updateClock();


setInterval(
  updateClock,
  1000
);


/* =========================================================
   DASHBOARD OPERACIONAL
   ========================================================= */

function toJsDate(value) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function vehicleIsActive(vehicle) {
  return vehicle?.active !== false && vehicle?.status !== "inactive";
}

function vehiclePlate(vehicle) {
  return normalizePlate(vehicle?.plate || vehicle?.plate_normalized || vehicle?.id || "");
}

function vehicleTimestamp(vehicle) {
  return toJsDate(vehicle?.updated_at || vehicle?.created_at || vehicle?.reported_at || vehicle?.recovered_at);
}

function refreshVehicleMetrics() {
  const active = state.vehicles.filter(vehicleIsActive).length;
  const inactive = Math.max(0, state.vehicles.length - active);
  const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recent = state.vehicles.filter(vehicle => {
    const date = toJsDate(vehicle?.created_at || vehicle?.reported_at || vehicle?.updated_at);
    return date && date.getTime() >= recentThreshold;
  }).length;

  if ($("#activeVehiclesCount")) $("#activeVehiclesCount").textContent = String(active);
  if ($("#inactiveVehiclesCount")) $("#inactiveVehiclesCount").textContent = String(inactive);
  if ($("#recentVehiclesCount")) $("#recentVehiclesCount").textContent = String(recent);
}

async function safeCount(queryRef, fallback = 0) {
  try {
    const snapshot = await getCountFromServer(queryRef);
    return snapshot.data().count;
  } catch (error) {
    technicalError("dashboard-count", error);
    return fallback;
  }
}

async function loadDashboardAggregates() {
  const jobs = [];

  if (permission("suspicious_vehicles_read")) {
    const statuses = ["pending_review", "approved", "rejected", "closed"];
    const ids = ["#pendingSuspiciousCount", "#approvedSuspiciousCount", "#rejectedSuspiciousCount", "#closedSuspiciousCount"];

    statuses.forEach((status, index) => {
      const fallback = state.suspicious.filter(item => item.status === status).length;

      if (state.profile?.is_institutional === true) {
        const node = $(ids[index]);
        if (node) node.textContent = String(fallback);
        return;
      }

      const countQuery = query(
        collection(db, "institutional_vehicle_submissions"),
        where("report_type", "==", "suspicious_vehicle"),
        where("status", "==", status)
      );
      jobs.push(
        safeCount(countQuery, fallback).then(count => {
          const node = $(ids[index]);
          if (node) node.textContent = String(count);
        })
      );
    });
  }

  if (permission("institutional_requests_read")) {
    const pendingQuery = query(
      collection(db, "institutional_requests"),
      where("status", "==", "pending")
    );
    jobs.push(
      safeCount(pendingQuery, state.requests.length).then(count => {
        if ($("#pendingRequestsCount")) $("#pendingRequestsCount").textContent = String(count);
      })
    );
  }

  refreshVehicleMetrics();
  await Promise.allSettled(jobs);
}

function renderRecentMovements() {
  const container = $("#recentMovements");
  if (!container) return;

  const movements = [];

  if (permission("vehicles_read")) {
    state.vehicles.forEach(vehicle => {
      const date = vehicleTimestamp(vehicle);
      if (!date) return;
      const active = vehicleIsActive(vehicle);
      movements.push({
        date,
        kind: "encargo",
        typeLabel: "ENCARGO",
        title: vehiclePlate(vehicle) || "PPU no informada",
        status: active ? "ACTIVO" : "INACTIVO",
        statusClass: active ? "active" : "inactive",
        primary: [vehicle.brand || vehicle.marca, vehicle.model || vehicle.modelo].filter(Boolean).join(" · ") || "Vehículo sin descripción",
        secondary: vehicle.source || vehicle.origin || vehicle.fuente || "Origen no informado"
      });
    });
  }

  if (permission("suspicious_vehicles_read")) {
    state.suspicious.forEach(item => {
      const date = toJsDate(item.updated_at || item.reviewed_at || item.submitted_at);
      if (!date) return;
      const statusMap = {
        pending_review: ["PENDIENTE", "pending"],
        approved: ["APROBADO", "approved"],
        rejected: ["RECHAZADO", "rejected"],
        closed: ["CERRADO", "closed"]
      };
      const [status, statusClass] = statusMap[item.status] || ["NO INFORMADO", "inactive"];
      movements.push({
        date,
        kind: "interest",
        typeLabel: "INTERÉS",
        title: normalizePlate(item.plate || item.observed_plate || "") || "PPU no informada",
        status,
        statusClass,
        primary: item.institution || item.display_source || "Vehículo de interés institucional",
        secondary: item.submitted_by_name || item.submitted_by_email || "Funcionario no informado"
      });
    });
  }

  if (permission("institutional_requests_read")) {
    state.requests.forEach(request => {
      const date = toJsDate(request.updated_at || request.submitted_at || request.created_at);
      if (!date) return;
      movements.push({
        date,
        kind: "accreditation",
        typeLabel: "ACREDITACIÓN",
        title: request.full_name || request.name || "Solicitud institucional",
        status: "PENDIENTE",
        statusClass: "pending",
        primary: request.institution || "Institución no informada",
        secondary: [request.unit, request.region].filter(Boolean).join(" · ") || "Antecedentes institucionales"
      });
    });
  }

  movements.sort((a, b) => b.date - a.date);
  const visible = movements.slice(0, 10);

  if (!visible.length) {
    container.innerHTML = '<div class="inline-state">No hay movimientos recientes disponibles para esta sesión.</div>';
    return;
  }

  container.replaceChildren(...visible.map(item => {
    const article = document.createElement("article");
    article.className = "movement-item";

    const type = document.createElement("span");
    type.className = `movement-type ${item.kind}`;
    type.textContent = item.typeLabel;

    const body = document.createElement("div");
    body.className = "movement-body";

    const titleLine = document.createElement("div");
    titleLine.className = "movement-title-line";

    const strong = document.createElement("strong");
    strong.textContent = item.title;

    const status = document.createElement("span");
    status.className = `movement-status ${item.statusClass}`;
    status.textContent = item.status;

    titleLine.append(strong, status);

    const primary = document.createElement("p");
    primary.className = "movement-primary";
    primary.textContent = item.primary;

    const secondary = document.createElement("span");
    secondary.className = "movement-secondary";
    secondary.textContent = item.secondary;

    body.append(titleLine, primary, secondary);

    const time = document.createElement("time");
    time.dateTime = item.date.toISOString();

    const dateText = document.createElement("span");
    dateText.className = "movement-date";
    dateText.textContent = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(item.date);

    const clockText = document.createElement("span");
    clockText.className = "movement-clock";
    clockText.textContent = new Intl.DateTimeFormat("es-CL", { timeStyle: "short" }).format(item.date);

    time.append(dateText, clockText);
    article.append(type, body, time);
    return article;
  }));
}

/* =========================================================
   BÚSQUEDA RÁPIDA DE PPU
   Solo usa registros ya cargados en la sesión.
   ========================================================= */

$("#headerPlateSearch")?.addEventListener("submit", event => {
  event.preventDefault();
  const plate = normalizePlate($("#headerPlateInput")?.value || "");

  if (plate.length < 5) {
    notice("Ingresa una patente válida.", "error");
    return;
  }

  const vehicle = state.vehicles.find(item => vehiclePlate(item) === plate);
  const suspicious = state.suspicious.find(item => normalizePlate(item.plate || item.observed_plate || "") === plate);

  if (vehicle) {
    showView("vehicles");
    $("#vehicleSearch").value = plate;
    renderVehicles();
    openVehicleDetail(vehicle);
    if (suspicious) notice("La PPU también aparece entre los antecedentes institucionales cargados.");
    return;
  }

  if (suspicious) {
    showView("suspicious");
    $("#suspiciousPlate").value = plate;
    openSuspiciousDetail(suspicious.id);
    return;
  }

  notice("No se encontró la PPU entre los registros actualmente cargados. Usa el buscador del módulo para ampliar la consulta.", "error");
});

/* =========================================================
   VEHÍCULOS
   ========================================================= */

async function loadVehicles() {

  if (!permission("vehicles_read")) {
    state.vehicles = [];
    $("#vehiclesLoading").hidden = false;
    $("#vehiclesLoading").textContent = "No tienes permiso para consultar vehículos.";
    refreshVehicleMetrics();
    return;
  }

  $("#vehiclesLoading").hidden = false;
  $("#vehiclesLoading").textContent = "Cargando vehículos…";

  try {
    const snap = await getDocs(
      query(
        collection(db, "stolen_vehicles"),
        limit(250)
      )
    );

    state.vehicles = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    refreshVehicleMetrics();
    renderVehicles();
    renderRecentMovements();
  } catch (error) {
    technicalError("vehicles-read", error);
    $("#vehiclesLoading").hidden = false;
    $("#vehiclesLoading").textContent = "No fue posible cargar los vehículos.";
  }
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

const escapeHtml =
  value =>
    String(
      value ?? ""
    ).replace(
      /[&<>'"]/g,
      char =>
        ({
          "&":
            "&amp;",

          "<":
            "&lt;",

          ">":
            "&gt;",

          "'":
            "&#39;",

          '"':
            "&quot;"
        })[char]
    );


/* =========================================================
   RENDER VEHÍCULOS
   ========================================================= */

function renderVehicles() {
  const term = normalizePlate($("#vehicleSearch").value);
  const filter = $("#vehicleFilter").value;

  const rows = state.vehicles.filter(vehicle => {
    const plate = vehiclePlate(vehicle);
    const matchesTerm = !term || plate.includes(term);
    const isActive = vehicleIsActive(vehicle);
    const matchesFilter = filter === "all" || (filter === "active" ? isActive : !isActive);
    return matchesTerm && matchesFilter;
  });

  $("#vehiclesLoading").hidden = true;
  $("#vehiclesEmpty").hidden = rows.length > 0;

  const body = $("#vehiclesTable tbody");
  body.replaceChildren(...rows.map(vehicle => {
    const tr = document.createElement("tr");
    const plate = vehiclePlate(vehicle);
    const active = vehicleIsActive(vehicle);
    const brand = vehicle.brand || vehicle.marca || "No informado";
    const model = vehicle.model || vehicle.modelo || "No informado";
    const year = vehicle.year || vehicle.ano || "No informado";
    const color = vehicle.color || "No informado";
    const type = vehicle.type || vehicle.tipo || "No informado";
    const source = vehicle.source || vehicle.origin || vehicle.fuente || "No informado";

    tr.innerHTML = `
      <td data-label="PPU"><b class="plate">${escapeHtml(plate || "No informado")}</b></td>
      <td data-label="Vehículo"><b>${escapeHtml(brand)}</b><small>${escapeHtml(model)}</small></td>
      <td data-label="Año">${escapeHtml(year)}</td>
      <td data-label="Color">${escapeHtml(color)}</td>
      <td data-label="Tipo">${escapeHtml(type)}</td>
      <td data-label="Estado"><span class="pill ${active ? "on" : "off"}">${active ? "ACTIVO" : "INACTIVO"}</span></td>
      <td data-label="Ingreso">${escapeHtml(safeDate(vehicle.created_at || vehicle.reported_at))}</td>
      <td data-label="Actualización">${escapeHtml(safeDate(vehicle.updated_at || vehicle.recovered_at || vehicle.closed_at))}</td>
      <td data-label="Origen">${escapeHtml(source)}</td>
      <td data-label="Acción"><div class="action-stack"></div></td>
    `;

    const actions = $(".action-stack", tr);

    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "text-button view-file";
    detailButton.textContent = "VER EXPEDIENTE";
    detailButton.addEventListener("click", () => openVehicleDetail(vehicle));
    actions.append(detailButton);

    if (active && permission("vehicles_deactivate")) {
      const deactivateButton = document.createElement("button");
      deactivateButton.type = "button";
      deactivateButton.className = "text-button danger-text";
      deactivateButton.textContent = "DAR DE BAJA";
      deactivateButton.addEventListener("click", () => openDeactivate(vehicle));
      actions.append(deactivateButton);
    }

    return tr;
  }));
}

function firstPresent(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function vehicleDetailValue(item, keys, { date = false } = {}) {
  const value = firstPresent(item, keys);
  if (value == null) return "No informado";
  return date ? (safeDate(value) === "—" ? "No informado" : safeDate(value)) : String(value);
}

function renderVehicleDetailSections(vehicle) {
  const sections = [
    ["Identificación", [
      ["PPU", vehiclePlate(vehicle) || "No informado"],
      ["Marca", vehicleDetailValue(vehicle, ["brand", "marca"])],
      ["Modelo", vehicleDetailValue(vehicle, ["model", "modelo"])],
      ["Año", vehicleDetailValue(vehicle, ["year", "ano"])],
      ["Color", vehicleDetailValue(vehicle, ["color"])],
      ["Tipo", vehicleDetailValue(vehicle, ["type", "tipo"])]
    ]],
    ["Identificadores", [
      ["VIN", vehicleDetailValue(vehicle, ["vin", "VIN", "vehicle_vin"])],
      ["Número de chasis", vehicleDetailValue(vehicle, ["chassis_number", "chassisNumber", "chassis"])],
      ["Número de motor", vehicleDetailValue(vehicle, ["engine_number", "engineNumber", "motor_number", "motorNumber"])]
    ]],
    ["Situación", [
      ["Estado", vehicleIsActive(vehicle) ? "Activo" : "Inactivo / cerrado"],
      ["Estado registrado", vehicleDetailValue(vehicle, ["status"])],
      ["Motivo / antecedente", vehicleDetailValue(vehicle, ["encargo_reason", "reason", "theft_reason", "case_reason", "observations", "notes"])],
      ["Ingreso", vehicleDetailValue(vehicle, ["created_at", "reported_at"], { date: true })],
      ["Recuperación / cierre", vehicleDetailValue(vehicle, ["recovered_at", "closed_at", "deactivated_at"], { date: true })],
      ["Motivo de baja", vehicleDetailValue(vehicle, ["deactivation_reason", "closed_reason", "inactive_reason", "recovered_to"])]
    ]],
    ["Origen", [
      ["Fuente", vehicleDetailValue(vehicle, ["source", "origin", "fuente"])],
      ["Propietario / responsable", vehicleDetailValue(vehicle, ["owner_name", "owner_email", "owner_uid"])],
      ["Creado por", vehicleDetailValue(vehicle, ["created_by_name", "created_by_email", "created_by", "created_by_uid"])]]
    ],
    ["Trazabilidad", [
      ["Última actualización", vehicleDetailValue(vehicle, ["updated_at"], { date: true })],
      ["Desactivado por", vehicleDetailValue(vehicle, ["deactivated_by_name", "deactivated_by_email", "deactivated_by", "closed_by"])],
      ["Último reporte", vehicleDetailValue(vehicle, ["last_report_id"])],
      ["Última comisaría / destino", vehicleDetailValue(vehicle, ["last_known_police_destination", "recovered_to"])]]
    ]
  ];

  return sections.map(([title, fields]) => `
    <section>
      <h3>${escapeHtml(title)}</h3>
      <dl>${fields.map(([label, value]) => `
        <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
      `).join("")}</dl>
    </section>
  `).join("");
}

function openVehicleDetail(vehicle) {
  state.selectedVehicle = vehicle;
  const active = vehicleIsActive(vehicle);
  $("#vehicleDetailTitle").textContent = vehiclePlate(vehicle) || "Vehículo con encargo";
  $("#vehicleDetailStatus").className = `pill ${active ? "on" : "off"}`;
  $("#vehicleDetailStatus").textContent = active ? "ACTIVO" : "INACTIVO";
  $("#vehicleDetailContent").innerHTML = renderVehicleDetailSections(vehicle);
  $("#vehicleDetailDeactivate").hidden = !active || !permission("vehicles_deactivate");
  $("#vehicleDetailDialog").showModal();
}

$("[data-close-vehicle-detail]")?.addEventListener("click", () => $("#vehicleDetailDialog").close());
$("#vehicleDetailDeactivate")?.addEventListener("click", () => {
  const vehicle = state.selectedVehicle;
  $("#vehicleDetailDialog").close();
  if (vehicle) openDeactivate(vehicle);
});


/* =========================================================
   FILTROS VEHÍCULOS
   ========================================================= */

$("#vehicleSearch").addEventListener(
  "input",
  renderVehicles
);


$("#vehicleFilter").addEventListener(
  "change",
  renderVehicles
);


$("#refreshVehicles").addEventListener(
  "click",
  loadVehicles
);


/* =========================================================
   CREAR VEHÍCULO
   ========================================================= */

const vehicleDialog =
  $("#vehicleDialog");


$$(
  "[data-open-create]"
).forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        if (
          !permission(
            "vehicles_create"
          )
        ) {

          notice(
            "Permiso insuficiente.",
            "error"
          );

          return;

        }


        $("#vehicleForm").reset();


        $("#vehicleFormMessage").textContent =
          "";


        vehicleDialog.showModal();

      }
    );

  }
);


/* =========================================================
   FORMULARIO CREAR VEHÍCULO
   ========================================================= */

$("#vehicleForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    if (
      !permission(
        "vehicles_create"
      )
    ) {

      await invalidate(
        "Tu permiso para crear vehículos ya no está disponible."
      );

      return;

    }


    const button =
      $("#createVehicleButton");


    const data =
      new FormData(
        event.currentTarget
      );


    const plate =
      normalizePlate(
        data.get(
          "plate"
        )
      );


    if (
      plate.length <
      5
    ) {

      $("#vehicleFormMessage").textContent =
        "Ingresa una patente válida.";

      return;

    }


    const vehicle = {

      plate,

      brand:
        data.get(
          "brand"
        )?.trim(),

      model:
        data.get(
          "model"
        )?.trim(),

      color:
        data.get(
          "color"
        )?.trim(),

      source:
        data.get(
          "source"
        )?.trim() ||
        "operations_portal"

    };


    const year =
      data.get(
        "year"
      );


    if (year) {

      vehicle.year =
        Number(
          year
        );

    }


    setBusy(
      button,
      true,
      "REGISTRANDO…"
    );


    try {

      const result =
        await callables
          .createVehicle({
            vehicle
          });


      if (
        !result.data?.ok
      ) {

        throw new Error(
          "Respuesta inesperada"
        );

      }


      vehicleDialog.close();


      notice(
        `Vehículo ${plate} registrado correctamente.`
      );


      await loadVehicles();

    } catch (error) {

      technicalError(
        "vehicle-create",
        error
      );


      $("#vehicleFormMessage").textContent =
        cleanError(
          error,
          "No fue posible crear el vehículo."
        );

    } finally {

      setBusy(
        button,
        false
      );

    }
  }
);


/* =========================================================
   DAR DE BAJA VEHÍCULO
   ========================================================= */

function openDeactivate(
  vehicle
) {

  if (
    !permission(
      "vehicles_deactivate"
    )
  ) {

    notice(
      "Permiso insuficiente.",
      "error"
    );

    return;

  }


  state.selectedVehicle =
    vehicle;


  $("#deactivatePlate").textContent =
    normalizePlate(

      vehicle.plate ||

      vehicle.plate_normalized ||

      vehicle.id

    );


  $("#deactivateForm").reset();


  $("#otherReasonLabel").hidden =
    true;


  $("#deactivateMessage").textContent =
    "";


  $("#deactivateDialog").showModal();
}


/* =========================================================
   MOTIVO DAR DE BAJA
   ========================================================= */

$("#reasonPreset").addEventListener(
  "change",
  event => {

    $("#otherReasonLabel").hidden =

      event.target.value !==
      "Otro";

  }
);


/* =========================================================
   FORM DAR DE BAJA
   ========================================================= */

$("#deactivateForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    if (
      !permission(
        "vehicles_deactivate"
      )
    ) {

      await invalidate(
        "Tu permiso para dar de baja vehículos ya no está disponible."
      );

      return;

    }


    if (
      !state.selectedVehicle
    ) {

      $("#deactivateMessage").textContent =
        "No hay un vehículo seleccionado.";

      return;

    }


    const preset =
      $("#reasonPreset")
        .value;


    const reason =

      preset ===
        "Otro"

        ? $("#otherReason")
            .value
            .trim()

        : preset;


    if (!reason) {

      $("#deactivateMessage").textContent =
        "Debes indicar un motivo.";

      return;

    }


    const button =
      $("#deactivateButton");


    setBusy(
      button,
      true,
      "DANDO DE BAJA…"
    );


    try {

      const result =
        await callables
          .deactivateVehicle({

            id:
              state
                .selectedVehicle
                .id,

            reason

          });


      if (
        !result.data?.ok
      ) {

        throw new Error(
          "Respuesta inesperada"
        );

      }


      $("#deactivateDialog").close();


      state.selectedVehicle =
        null;


      notice(
        "Vehículo dado de baja correctamente."
      );


      await loadVehicles();

    } catch (error) {

      technicalError(
        "vehicle-deactivate",
        error
      );


      $("#deactivateMessage").textContent =
        cleanError(
          error,
          "No fue posible dar de baja el vehículo."
        );

    } finally {

      setBusy(
        button,
        false
      );

    }
  }
);


/* =========================================================
   SOLICITUDES INSTITUCIONALES
   ========================================================= */

async function loadRequests() {

  if (
    !permission(
      "institutional_requests_read"
    )
  ) {

    return;

  }


  $("#requestsLoading").hidden =
    false;


  $("#requestsLoading").textContent =
    "Cargando solicitudes…";


  try {

    const snap =
      await getDocs(
        query(

          collection(
            db,
            "institutional_requests"
          ),

          where(
            "status",
            "==",
            "pending"
          ),

          limit(
            100
          )

        )
      );


    state.requests =
      snap.docs.map(
        item => ({

          id:
            item.id,

          ...item.data()

        })
      );


    $("#pendingRequestsCount").textContent =
      String(
        state.requests.length
      );


    renderRequests();
    renderRecentMovements();

  } catch (error) {

    technicalError(
      "requests-read",
      error
    );


    $("#requestsLoading").hidden =
      false;


    $("#requestsLoading").textContent =
      "No fue posible cargar las acreditaciones.";

  }
}


/* =========================================================
   RENDER ACREDITACIONES
   ========================================================= */

function renderRequests() {

  $("#requestsLoading").hidden =
    true;


  $("#requestsEmpty").hidden =
    state.requests.length >
    0;


  $("#requestsGrid").replaceChildren(

    ...state.requests.map(
      request => {

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "request-card";


        card.innerHTML =
          `
            <span class="pill pending">
              PENDIENTE
            </span>


            <h3>

              ${escapeHtml(

                request.full_name ||

                request.name ||

                "Solicitud institucional"

              )}

            </h3>


            <p>

              ${escapeHtml(

                request.institution ||

                "Institución no informada"

              )}

            </p>


            <dl>

              <div>

                <dt>
                  Región
                </dt>

                <dd>

                  ${escapeHtml(
                    request.region ||
                    "—"
                  )}

                </dd>

              </div>


              <div>

                <dt>
                  Unidad
                </dt>

                <dd>

                  ${escapeHtml(
                    request.unit ||
                    "—"
                  )}

                </dd>

              </div>


              <div>

                <dt>
                  Fecha
                </dt>

                <dd>

                  ${safeDate(

                    request.submitted_at ||

                    request.created_at

                  )}

                </dd>

              </div>

            </dl>


            <button class="secondary">
              REVISAR SOLICITUD
            </button>
          `;


        $("button", card)
          .addEventListener(
            "click",
            () => {

              openRequest(
                request
              );

            }
          );


        return card;

      }
    )

  );
}


/* =========================================================
   ACTUALIZAR ACREDITACIONES
   ========================================================= */

$("#refreshRequests").addEventListener(
  "click",
  loadRequests
);


/* =========================================================
   ABRIR SOLICITUD
   ========================================================= */

function openRequest(
  request
) {

  state.selectedRequest =
    request;


  $("#requestName").textContent =

    request.full_name ||

    request.name ||

    "Solicitud institucional";


  const fields = [

    [
      "Correo",
      request.email
    ],

    [
      "Institución",
      request.institution
    ],

    [
      "Código institucional",
      request.institution_code
    ],

    [
      "Región",
      request.region
    ],

    [
      "Unidad",
      request.unit
    ],

    [
      "Rol solicitado",
      request.requested_role
    ],

    [
      "Fecha",
      safeDate(

        request.submitted_at ||

        request.created_at

      )
    ],

    [
      "Estado",
      request.status
    ]

  ];


  $("#requestDetails").innerHTML =

    fields

      .filter(
        (
          [
            ,
            value
          ]
        ) =>
          value
      )

      .map(
        (
          [
            key,
            value
          ]
        ) =>
          `
            <div>

              <dt>
                ${escapeHtml(
                  key
                )}
              </dt>

              <dd>
                ${escapeHtml(
                  value
                )}
              </dd>

            </div>
          `
      )

      .join(
        ""
      );


  $("#requestMessage").textContent =
    "";


  $("#requestDialog").showModal();
}


/* =========================================================
   CERRAR SOLICITUD
   ========================================================= */

$(
  "[data-close-request]"
)?.addEventListener(
  "click",
  () => {

    $("#requestDialog").close();

  }
);


/* =========================================================
   DECIDIR ACREDITACIÓN
   ========================================================= */

async function decideRequest(decision) {
  if (!permission("institutional_requests_review")) {
    notice("No tienes permiso para procesar acreditaciones.", "error");
    return false;
  }

  if (!state.selectedRequest) {
    notice("No existe una solicitud seleccionada.", "error");
    return false;
  }

  const approve = decision === "approve";
  const button = $("#confirmRequestDecision");
  setBusy(button, true, approve ? "APROBANDO…" : "RECHAZANDO…");
  $("#requestDecisionMessage").textContent = "";

  try {
    const result = await callables.reviewRequest({
      uid: state.selectedRequest.uid || state.selectedRequest.id,
      decision
    });

    if (!result.data?.ok) throw new Error("Respuesta inesperada");

    if ($("#requestDecisionDialog")?.open) $("#requestDecisionDialog").close();
    if ($("#requestDialog")?.open) $("#requestDialog").close();
    state.pendingRequestDecision = null;
    state.selectedRequest = null;

    notice(`Solicitud ${approve ? "aprobada" : "rechazada"} correctamente.`);
    await loadRequests();
    return true;
  } catch (error) {
    technicalError("request-review", error);
    $("#requestDecisionMessage").textContent = cleanError(error, "No fue posible procesar la acreditación.");
    return false;
  } finally {
    setBusy(button, false);
  }
}

function openRequestDecision(decision) {
  if (!permission("institutional_requests_review") || !state.selectedRequest) return;
  state.pendingRequestDecision = decision;
  const approve = decision === "approve";
  $("#requestDecisionTitle").textContent = approve ? "Aprobar acreditación" : "Rechazar acreditación";
  $("#requestDecisionIntro").textContent = approve
    ? "Confirma que revisaste los antecedentes institucionales antes de aprobar esta solicitud."
    : "Confirma el rechazo de esta solicitud institucional. El registro conservará su trazabilidad.";
  $("#confirmRequestDecision").className = approve ? "primary" : "danger";
  $("#confirmRequestDecision").textContent = approve ? "CONFIRMAR APROBACIÓN" : "CONFIRMAR RECHAZO";
  $("#requestDecisionMessage").textContent = "";
  $("#requestDecisionDialog").showModal();
}

function closeRequestDecision() {
  if ($("#requestDecisionDialog")?.open) $("#requestDecisionDialog").close();
  state.pendingRequestDecision = null;
  $("#requestDecisionMessage").textContent = "";
}

$("#approveButton").addEventListener("click", () => openRequestDecision("approve"));
$("#rejectButton").addEventListener("click", () => openRequestDecision("reject"));
$$('[data-close-request-decision]').forEach(button => button.addEventListener("click", closeRequestDecision));
$("#requestDecisionForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.pendingRequestDecision) return;
  await decideRequest(state.pendingRequestDecision);
});


/* =========================================================
   EXPORTACIÓN
   ========================================================= */

$("#exportButton").addEventListener(
  "click",
  async () => {

    if (
      !permission(
        "vehicles_export"
      )
    ) {

      await invalidate(
        "Tu permiso para exportar ya no está disponible."
      );

      return;

    }


    const button =
      $("#exportButton");


    setBusy(
      button,
      true,
      "GENERANDO…"
    );


    $("#exportStatus").textContent =
      "";


    try {

      const exportLimit =
        Number(
          $("#exportLimit")
            .value
        );


      const result =
        await callables
          .exportVehicles({

            limit:
              exportLimit

          });


      const vehicles =
        result.data?.vehicles;


      if (
        !result.data?.ok ||

        !Array.isArray(
          vehicles
        )
      ) {

        throw new Error(
          "Formato de exportación inesperado"
        );

      }


      downloadCsv(
        vehicles
      );


      $("#exportStatus").textContent =
        `Exportación generada: ${vehicles.length} registros.`;


      notice(
        "Listado generado correctamente."
      );

    } catch (error) {

      technicalError(
        "vehicles-export",
        error
      );


      $("#exportStatus").textContent =
        cleanError(
          error,
          "No fue posible generar la exportación."
        );

    } finally {

      setBusy(
        button,
        false
      );

    }
  }
);


/* =========================================================
   DESCARGAR CSV
   ========================================================= */

function downloadCsv(
  vehicles
) {

  const columns = [

    "id",

    "plate",

    "brand",

    "model",

    "year",

    "color",

    "status",

    "active",

    "source"

  ];


  const value =
    item => {

      const raw =

        item == null

          ? ""

          : typeof item ===
              "object"

            ? JSON.stringify(
                item
              )

            : String(
                item
              );


      return `"${raw.replaceAll(
        '"',
        '""'
      )}"`;

    };


  const csv = [

    columns.join(
      ","
    ),

    ...vehicles.map(
      row =>

        columns.map(
          key =>
            value(
              row[key]
            )
        ).join(
          ","
        )
    )

  ].join(
    "\r\n"
  );


  /*
   * BOM intencional SOLO para CSV,
   * necesario para Excel/acentos.
   */

  const blob =
    new Blob(
      [
        "\ufeff",
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href =
    url;


  anchor.download =
    `skano-vehiculos-${
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )
    }.csv`;


  document.body.appendChild(
    anchor
  );


  anchor.click();


  anchor.remove();


  URL.revokeObjectURL(
    url
  );
}


/* =========================================================
   REVALIDACIÓN DE SESIÓN

   Cuando el navegador vuelve a primer plano,
   vuelve a revisar:

   - claims
   - staff_accounts
   - admins

   También usa Promise.allSettled para que
   operations_staff no falle por no tener
   acceso al documento admins/{uid}.
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  async () => {

    if (
      document.hidden ||

      !state.user ||

      !state.validated
    ) {

      return;

    }


    try {

      const user =
        state.user;


      /*
       * Fuerza actualización de claims.
       */

      await user.getIdToken(
        true
      );


      const token =
        await user.getIdTokenResult();


      const {
        staffProfile,
        adminProfile,
        userProfile,
        officerProfile
      } =
        await readAuthorizationProfiles(
          user
        );


      const authorized =
        authorizeOperationsSession(
          token.claims,
          staffProfile,
          adminProfile,
          userProfile,
          officerProfile
        );


      if (
        !authorized
      ) {

        await invalidate();

        return;

      }


      const profile =
        buildSessionProfile(
          staffProfile,
          adminProfile,
          userProfile,
          officerProfile
        );


      if (!profile) {

        await invalidate();

        return;

      }


      state.profile =
        profile;


      enforcePermissions();

    } catch (error) {

      technicalError(
        "session-recheck",
        error
      );

    }
  }
);

/* =========================================================
   VEHÍCULOS DE INTERÉS INSTITUCIONAL
   ========================================================= */

const suspiciousStatusLabel = value => ({
  pending_review: "PENDIENTE", approved: "APROBADO", rejected: "RECHAZADO", closed: "DESACTIVADO / CERRADO"
})[value] || "NO INFORMADO";

const informed = value => {
  if (value === true) return "Sí";
  if (value === false) return "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "No informado";
  if (value == null || String(value).trim() === "") return "No informado";
  return String(value);
};

async function loadSuspiciousVehicles({ reset = false } = {}) {
  if (!permission("suspicious_vehicles_read")) return;
  const loading = $("#suspiciousLoading");
  loading.hidden = false;
  loading.textContent = "Cargando antecedentes…";
  try {
    const filters = {
      pageSize: 25,
      status: $("#suspiciousStatus")?.value || "all",
      institutionType: $("#suspiciousInstitution")?.value || "all",
      plate: normalizePlate($("#suspiciousPlate")?.value || ""),
      from: $("#suspiciousFrom")?.value || null,
      to: $("#suspiciousTo")?.value || null,
      cursor: reset ? null : state.suspiciousCursor,
    };
    const response = await callables.listSuspicious(filters);
    const data = response.data || {};
    state.suspicious = reset ? (data.items || []) : [...state.suspicious, ...(data.items || [])];
    state.suspiciousCursor = data.nextCursor || null;
    renderSuspiciousVehicles();
    renderRecentMovements();
    if (reset) loadDashboardAggregates();
  } catch (error) {
    technicalError("suspicious-list", error);
    loading.textContent = cleanError(error, "No fue posible cargar los antecedentes.");
  }
}

function renderSuspiciousVehicles() {
  const body = $("#suspiciousTable tbody");
  body.innerHTML = state.suspicious.map(item => {
    const status = item.status || "";
    const origin = item.institution || (item.source === "operations" ? "OPERACIONES SKANO" : item.institution_type);
    return `<tr>
      <td data-label="PPU"><strong class="plate">${escapeHtml(informed(item.plate || item.observed_plate))}</strong></td>
      <td data-label="Vehículo">${escapeHtml(informed([item.brand, item.model].filter(Boolean).join(" ")))}<small>${escapeHtml(informed(item.color))}</small></td>
      <td data-label="Origen">${escapeHtml(informed(origin))}<small>${escapeHtml(informed(item.submitted_by_name))}</small></td>
      <td data-label="Fecha">${escapeHtml(safeDate(item.submitted_at))}</td>
      <td data-label="Estado"><span class="pill ${status === "approved" ? "on" : status === "pending_review" ? "pending" : "off"}">${escapeHtml(suspiciousStatusLabel(status))}</span></td>
      <td data-label="Acción"><button class="text-button suspicious-detail-button" data-id="${escapeHtml(item.id)}">VER DETALLE</button></td>
    </tr>`;
  }).join("");
  $("#suspiciousLoading").hidden = true;
  $("#suspiciousEmpty").hidden = state.suspicious.length !== 0;
  $("#loadMoreSuspicious").hidden = !state.suspiciousCursor;
  $$(".suspicious-detail-button").forEach(button => button.addEventListener("click", () => openSuspiciousDetail(button.dataset.id)));
}

const detailFields = {
  "Vehículo": [["PPU", "plate"], ["PPU observada", "observed_plate"], ["Marca", "brand"], ["Modelo", "model"], ["Color", "color"], ["Año", "year"], ["Tipo", "type"]],
  "Ubicación": [["Región", "region"], ["Comuna", "commune"], ["Lugar de observación", "observation_place"], ["Fecha de avistamiento", "observed_at"]],
  "Antecedentes": [["Observaciones", "observations"], ["Características", "vehicle_characteristics"], ["Categoría modus operandi", "modus_operandi_category"], ["Descripción modus operandi", "modus_operandi_description"], ["Referencia institucional", "institutional_reference"], ["Robado al momento del envío", "stolen_at_time_of_submission"], ["Tipo de reporte", "report_type"], ["Tipo de envío", "submission_type"]],
  "Origen institucional": [["Institución", "institution"], ["Tipo institucional", "institution_type"], ["Fuente", "source"], ["Descripción de origen", "display_source"], ["UID creador", "submitted_by_uid"], ["Creador", "submitted_by_name"], ["Correo", "submitted_by_email"]],
  "Validaciones": [["Biometría confirmada", "biometric_confirmed"], ["Biometría confirmada el", "biometric_confirmed_at"], ["Declaración aceptada", "responsibility_declaration_accepted"], ["Identidad confirmada", "identity_confirmed"], ["Origen institucional", "institutional_reported"], ["Reporte policial", "police_reported"], ["Marcado sospechoso", "suspicious_reported"]],
  "Auditoría": [["Estado", "status"], ["Enviado el", "submitted_at"], ["Actualizado el", "updated_at"], ["Revisado por", "reviewed_by"], ["Revisado el", "reviewed_at"], ["Motivo de rechazo", "rejection_reason"], ["Proyección activa", "active_vehicle_id"], ["Cerrado por", "closed_by"], ["Cerrado el", "closed_at"], ["Motivo de cierre", "closed_reason"]],
};

function detailValue(item, key) {
  return key.endsWith("_at") ? (item[key] ? safeDate(item[key]) : "No informado") : informed(item[key]);
}

function clearSuspiciousEvidence() {
  state.suspiciousEvidenceUrls.forEach(url => URL.revokeObjectURL(url));
  state.suspiciousEvidenceUrls = [];
  state.suspiciousEvidenceIndex = 0;
  $("#suspiciousEvidence").hidden = false;
  $("#suspiciousEvidenceEmpty").hidden = false;
  $("#suspiciousEvidenceEmpty").textContent = "Sin evidencia fotográfica registrada";
  $("#suspiciousEvidenceGallery").hidden = true;
  $("#suspiciousEvidenceThumbnails").replaceChildren();
}

function showSuspiciousEvidence(index) {
  if (!state.suspiciousEvidenceUrls.length) return;
  const bounded = (index + state.suspiciousEvidenceUrls.length) % state.suspiciousEvidenceUrls.length;
  state.suspiciousEvidenceIndex = bounded;
  const url = state.suspiciousEvidenceUrls[bounded];
  $("#suspiciousEvidenceMain").src = url;
  $("#suspiciousEvidenceExpanded").src = url;
  $("#previousEvidence").disabled = state.suspiciousEvidenceUrls.length < 2;
  $("#nextEvidence").disabled = state.suspiciousEvidenceUrls.length < 2;
  $$(".evidence-thumbnail").forEach((button, buttonIndex) => {
    button.setAttribute("aria-current", buttonIndex === bounded ? "true" : "false");
  });
}

async function renderSuspiciousEvidence(item) {
  clearSuspiciousEvidence();
  const paths = validatedEvidencePaths(item);
  if (!paths.length) return;
  let blobs;
  try {
    blobs = await Promise.all(paths.map(path => getBlob(storageRef(storage, path))));
  } catch (error) {
    technicalError("suspicious-evidence", error);
    $("#suspiciousEvidenceEmpty").textContent = "No fue posible cargar la evidencia fotográfica.";
    return;
  }
  state.suspiciousEvidenceUrls = blobs.map(blob => URL.createObjectURL(blob));
  $("#suspiciousEvidenceEmpty").hidden = true;
  $("#suspiciousEvidenceGallery").hidden = false;
  const thumbnails = $("#suspiciousEvidenceThumbnails");
  state.suspiciousEvidenceUrls.forEach((url, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evidence-thumbnail";
    button.setAttribute("aria-label", `Ver fotografía ${index + 1}`);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `Miniatura de evidencia ${index + 1}`;
    button.append(image);
    button.addEventListener("click", () => showSuspiciousEvidence(index));
    thumbnails.append(button);
  });
  showSuspiciousEvidence(0);
}

async function openSuspiciousDetail(id) {
  clearSuspiciousEvidence();
  $("#suspiciousDetailContent").innerHTML = '<div class="inline-state">Cargando ficha completa…</div>';
  $("#suspiciousDetailDialog").showModal();
  try {
    const response = await callables.getSuspicious({ id });
    const item = response.data.submission;
    state.selectedSuspicious = item;
    $("#suspiciousDetailTitle").textContent = item.plate || item.observed_plate || "Detalle institucional";
    $("#suspiciousDetailContent").innerHTML = Object.entries(detailFields).map(([title, fields]) =>
      `<section><h3>${escapeHtml(title)}</h3><dl>${fields.map(([label, key]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(detailValue(item, key))}</dd></div>`).join("")}</dl></section>`
    ).join("");
    await renderSuspiciousEvidence(item);
    $("#approveSuspicious").hidden = item.status !== "pending_review" || !permission("suspicious_vehicles_review");
    $("#rejectSuspicious").hidden = item.status !== "pending_review" || !permission("suspicious_vehicles_review");
    $("#closeSuspicious").hidden = item.status !== "approved" || !permission("suspicious_vehicles_deactivate");
  } catch (error) {
    $("#suspiciousDetailContent").textContent = cleanError(error, "No fue posible abrir la ficha.");
    clearSuspiciousEvidence();
  }
}

async function performSuspiciousAction(action, reason = null) {
  const item = state.selectedSuspicious;
  if (!item) return false;

  if (action !== "approve" && !reason?.trim()) {
    $("#suspiciousReasonMessage").textContent = "Debes ingresar un motivo.";
    return false;
  }

  const button = action === "approve" ? $("#approveSuspicious") : $("#confirmSuspiciousReason");
  setBusy(button, true, action === "approve" ? "APROBANDO…" : "PROCESANDO…");
  $("#suspiciousActionMessage").textContent = "";
  $("#suspiciousReasonMessage").textContent = "";

  try {
    const callable = action === "approve"
      ? callables.approveSuspicious
      : action === "reject"
        ? callables.rejectSuspicious
        : callables.closeSuspicious;

    await callable({ id: item.id, reason: action === "approve" ? null : reason.trim() });

    if ($("#suspiciousReasonDialog")?.open) $("#suspiciousReasonDialog").close();
    if ($("#suspiciousDetailDialog")?.open) $("#suspiciousDetailDialog").close();
    clearSuspiciousEvidence();
    state.pendingSuspiciousAction = null;
    state.selectedSuspicious = null;

    await loadSuspiciousVehicles({ reset: true });
    notice(
      action === "approve"
        ? "Antecedente aprobado como vehículo de interés institucional."
        : action === "reject"
          ? "Antecedente rechazado; se conserva el historial."
          : "Antecedente desactivado y cerrado."
    );
    return true;
  } catch (error) {
    technicalError(`suspicious-${action}`, error);
    const target = action === "approve" ? $("#suspiciousActionMessage") : $("#suspiciousReasonMessage");
    target.textContent = cleanError(error, "No fue posible completar la acción.");
    return false;
  } finally {
    setBusy(button, false);
  }
}

function openSuspiciousReason(action) {
  if (!state.selectedSuspicious) return;
  state.pendingSuspiciousAction = action;
  $("#suspiciousReasonForm").reset();
  $("#suspiciousReasonMessage").textContent = "";
  $("#suspiciousReasonTitle").textContent = action === "reject" ? "Rechazar antecedente" : "Cerrar antecedente";
  $("#suspiciousReasonIntro").textContent = action === "reject"
    ? "El antecedente se conservará para trazabilidad. Indica el motivo del rechazo."
    : "El expediente permanecerá en el historial. Indica el motivo del cierre o desactivación.";
  $("#confirmSuspiciousReason").textContent = action === "reject" ? "CONFIRMAR RECHAZO" : "CONFIRMAR CIERRE";
  $("#suspiciousReasonDialog").showModal();
  $("#suspiciousReasonText").focus();
}

function closeSuspiciousReason() {
  if ($("#suspiciousReasonDialog")?.open) $("#suspiciousReasonDialog").close();
  state.pendingSuspiciousAction = null;
  $("#suspiciousReasonMessage").textContent = "";
}

$("#refreshSuspicious")?.addEventListener("click", () => loadSuspiciousVehicles({ reset: true }));
$("#loadMoreSuspicious")?.addEventListener("click", () => loadSuspiciousVehicles());
$("#suspiciousPlate")?.addEventListener("keydown", event => { if (event.key === "Enter") loadSuspiciousVehicles({ reset: true }); });
$("#openSuspiciousCreate")?.addEventListener("click", () => {
  if (!permission("suspicious_vehicles_create")) {
    notice("No tienes permiso para crear vehículos sospechosos.", "error");
    return;
  }

  $("#suspiciousCreateForm")?.reset();
  $("#suspiciousCreateMessage").textContent = "";
  if ($("#suspiciousEvidenceSelection")) {
    $("#suspiciousEvidenceSelection").textContent = "Selecciona entre 1 y 3 fotografías.";
  }
  $("#suspiciousCreateDialog").showModal();
});
$("[data-close-suspicious-create]")?.addEventListener("click", () => $("#suspiciousCreateDialog").close());
$("[data-close-suspicious-detail]")?.addEventListener("click", () => $("#suspiciousDetailDialog").close());
$("#suspiciousDetailDialog")?.addEventListener("close", clearSuspiciousEvidence);
$("#previousEvidence")?.addEventListener("click", () => showSuspiciousEvidence(state.suspiciousEvidenceIndex - 1));
$("#nextEvidence")?.addEventListener("click", () => showSuspiciousEvidence(state.suspiciousEvidenceIndex + 1));
$("#openEvidenceLightbox")?.addEventListener("click", () => $("#suspiciousEvidenceLightbox").showModal());
$("[data-close-evidence-lightbox]")?.addEventListener("click", () => $("#suspiciousEvidenceLightbox").close());
$("#approveSuspicious")?.addEventListener("click", () => performSuspiciousAction("approve"));
$("#rejectSuspicious")?.addEventListener("click", () => openSuspiciousReason("reject"));
$("#closeSuspicious")?.addEventListener("click", () => openSuspiciousReason("close"));
$$('[data-close-suspicious-reason]').forEach(button => button.addEventListener("click", closeSuspiciousReason));
$("#suspiciousReasonForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const action = state.pendingSuspiciousAction;
  if (!action) return;
  const reason = $("#suspiciousReasonText").value.trim();
  await performSuspiciousAction(action, reason);
});

function selectedEvidenceFiles() {
  const input = $("#suspiciousEvidenceFiles");
  return input?.files ? [...input.files] : [];
}

async function compressEvidenceToJpeg(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("invalid-image");
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/jpeg", 0.72);
  });

  if (!blob || blob.size <= 0 || blob.size > 8 * 1024 * 1024) {
    throw new Error("invalid-image-size");
  }

  return blob;
}

async function uploadSuspiciousEvidence(submissionId, files) {
  const blobs = await Promise.all(
    files.map(file => compressEvidenceToJpeg(file))
  );
  const paths = [];

  for (let index = 0; index < blobs.length; index += 1) {
    const path = `institutional_vehicle_submissions/${state.user.uid}/${submissionId}/evidence/photo_${index + 1}.jpg`;

    await uploadBytes(
      storageRef(storage, path),
      blobs[index],
      {
        contentType: "image/jpeg",
        customMetadata: {
          uploader_uid: state.user.uid,
          submission_id: submissionId,
          report_type: "suspicious_vehicle"
        }
      }
    );

    paths.push(path);
  }

  return {
    paths,
    primaryPath: paths[0],
    count: paths.length
  };
}

$("#suspiciousEvidenceFiles")?.addEventListener("change", event => {
  const files = [...(event.currentTarget.files || [])];
  const message = $("#suspiciousEvidenceSelection");

  if (!message) return;

  if (!files.length) {
    message.textContent = "Selecciona entre 1 y 3 fotografías.";
    return;
  }

  if (files.length > 3) {
    message.textContent = "Máximo 3 fotografías.";
    event.currentTarget.value = "";
    return;
  }

  message.textContent = `${files.length} fotografía${files.length === 1 ? "" : "s"} seleccionada${files.length === 1 ? "" : "s"}.`;
});

$("#suspiciousCreateForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!permission("suspicious_vehicles_create")) {
    notice("No tienes permiso para crear vehículos sospechosos.", "error");
    return;
  }

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const files = selectedEvidenceFiles();

  if (files.length < 1 || files.length > 3) {
    $("#suspiciousCreateMessage").textContent = "Debes adjuntar entre 1 y 3 fotografías.";
    return;
  }

  if (files.some(file => !file?.type?.startsWith("image/"))) {
    $("#suspiciousCreateMessage").textContent = "Solo puedes adjuntar archivos de imagen.";
    return;
  }

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  delete data.evidence_files;
  data.year = data.year ? Number(data.year) : null;

  const normalizedPlate = normalizePlate(data.plate || "");
  if (normalizedPlate.length < 5 || normalizedPlate.length > 8) {
    $("#suspiciousCreateMessage").textContent = "Ingresa una patente válida.";
    return;
  }
  data.plate = normalizedPlate;

  const submissionId = doc(
    collection(db, "institutional_vehicle_submissions")
  ).id;

  $("#suspiciousCreateMessage").textContent = "";
  setBusy(submitButton, true, "SUBIENDO EVIDENCIA…");

  try {
    const evidence = await uploadSuspiciousEvidence(submissionId, files);

    submitButton.textContent = "GUARDANDO…";

    const response = await callables.createSuspicious({
      submissionId,
      vehicle: data,
      evidence
    });

    if (!response.data?.ok) {
      throw new Error("Respuesta inesperada");
    }

    form.reset();
    if ($("#suspiciousEvidenceSelection")) {
      $("#suspiciousEvidenceSelection").textContent = "Selecciona entre 1 y 3 fotografías.";
    }

    $("#suspiciousCreateDialog").close();
    await loadSuspiciousVehicles({ reset: true });

    notice(
      state.profile?.is_institutional === true
        ? "Antecedente enviado a Operaciones SKANO para revisión."
        : "Vehículo de interés institucional guardado como pendiente de revisión."
    );
  } catch (error) {
    technicalError("suspicious-create", error);

    $("#suspiciousCreateMessage").textContent =
      error?.message === "invalid-image"
        ? "Solo puedes adjuntar archivos de imagen."
        : error?.message === "invalid-image-size"
          ? "Una de las fotografías no pudo procesarse correctamente."
          : cleanError(error, "No fue posible guardar el antecedente.");
  } finally {
    setBusy(submitButton, false);
  }
});
