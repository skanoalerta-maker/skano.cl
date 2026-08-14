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
  authorizeOperationsSession,
  hasPermission,
  normalizePlate
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
      )

  });


/* =========================================================
   ESTADO
   ========================================================= */

const state = {

  profile: null,

  user: null,

  vehicles: [],

  requests: [],

  selectedVehicle: null,

  selectedRequest: null,

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
    adminResult
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


  const staffProfile =
    staffSnap?.exists()
      ? staffSnap.data()
      : null;


  const adminProfile =
    adminSnap?.exists()
      ? adminSnap.data()
      : null;


  return {

    staffProfile,

    adminProfile

  };
}


/* =========================================================
   CONSTRUIR PERFIL DE SESIÓN
   ========================================================= */

function buildSessionProfile(
  staffProfile,
  adminProfile
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

      status:
        "active"

    };

  }


  return staffProfile;
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
      adminProfile
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
        adminProfile
      );


    if (!authorized) {

      await invalidate();

      return;

    }


    const profile =
      buildSessionProfile(
        staffProfile,
        adminProfile
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
        : Promise.resolve()

    ]);

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
   VEHÍCULOS
   ========================================================= */

async function loadVehicles() {

  if (
    !permission(
      "vehicles_read"
    )
  ) {

    state.vehicles =
      [];


    $("#vehiclesLoading").hidden =
      false;


    $("#vehiclesLoading").textContent =
      "No tienes permiso para consultar vehículos.";


    return;

  }


  $("#vehiclesLoading").hidden =
    false;


  $("#vehiclesLoading").textContent =
    "Cargando vehículos…";


  try {

    const snap =
      await getDocs(
        query(
          collection(
            db,
            "stolen_vehicles"
          ),
          limit(
            250
          )
        )
      );


    state.vehicles =
      snap.docs.map(
        item => ({
          id:
            item.id,

          ...item.data()
        })
      );


    const activeCount =
      state.vehicles.filter(
        vehicle =>

          vehicle.active !==
            false &&

          vehicle.status !==
            "inactive"

      ).length;


    $("#activeVehiclesCount").textContent =
      String(
        activeCount
      );


    renderVehicles();

  } catch (error) {

    technicalError(
      "vehicles-read",
      error
    );


    $("#vehiclesLoading").hidden =
      false;


    $("#vehiclesLoading").textContent =
      "No fue posible cargar los vehículos.";

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

  const term =
    normalizePlate(
      $("#vehicleSearch")
        .value
    );


  const filter =
    $("#vehicleFilter")
      .value;


  const rows =
    state.vehicles.filter(
      vehicle => {

        const plate =
          normalizePlate(

            vehicle.plate ||

            vehicle.plate_normalized ||

            vehicle.id

          );


        const matchesTerm =
          !term ||
          plate.includes(
            term
          );


        const isActive =

          vehicle.active !==
            false &&

          vehicle.status !==
            "inactive";


        const matchesFilter =

          filter ===
            "all" ||

          (
            filter ===
              "active"
              ? isActive
              : !isActive
          );


        return (
          matchesTerm &&
          matchesFilter
        );

      }
    );


  $("#vehiclesLoading").hidden =
    true;


  $("#vehiclesEmpty").hidden =
    rows.length >
    0;


  const body =
    $("#vehiclesTable tbody");


  body.replaceChildren(
    ...rows.map(
      vehicle => {

        const tr =
          document.createElement(
            "tr"
          );


        const plate =
          normalizePlate(

            vehicle.plate ||

            vehicle.plate_normalized ||

            vehicle.id

          );


        const active =

          vehicle.active !==
            false &&

          vehicle.status !==
            "inactive";


        tr.innerHTML =
          `
            <td data-label="PPU">

              <b class="plate">
                ${escapeHtml(
                  plate
                )}
              </b>

            </td>


            <td data-label="Vehículo">

              <b>

                ${escapeHtml(
                  vehicle.brand ||
                  vehicle.marca ||
                  "—"
                )}

              </b>


              <small>

                ${escapeHtml(
                  vehicle.model ||
                  vehicle.modelo ||
                  ""
                )}

              </small>

            </td>


            <td data-label="Año / Color">

              ${escapeHtml(
                vehicle.year ||
                vehicle.ano ||
                "—"
              )}

              ·

              ${escapeHtml(
                vehicle.color ||
                "—"
              )}

            </td>


            <td data-label="Estado">

              <span
                class="pill ${
                  active
                    ? "on"
                    : "off"
                }"
              >

                ${
                  active
                    ? "ACTIVO"
                    : "INACTIVO"
                }

              </span>

            </td>


            <td data-label="Fecha">

              ${safeDate(

                vehicle.created_at ||

                vehicle.reported_at ||

                vehicle.updated_at

              )}

            </td>


            <td data-label="Origen">

              ${escapeHtml(

                vehicle.source ||

                vehicle.origin ||

                vehicle.fuente ||

                "—"

              )}

            </td>


            <td data-label="Acción"></td>
          `;


        if (
          active &&

          permission(
            "vehicles_deactivate"
          )
        ) {

          const button =
            document.createElement(
              "button"
            );


          button.className =
            "text-button danger-text";


          button.textContent =
            "DAR DE BAJA";


          button.addEventListener(
            "click",
            () => {

              openDeactivate(
                vehicle
              );

            }
          );


          tr.lastElementChild.append(
            button
          );

        }


        return tr;

      }
    )
  );
}


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

async function decideRequest(
  decision
) {

  if (
    !permission(
      "institutional_requests_review"
    )
  ) {

    notice(
      "No tienes permiso para procesar acreditaciones.",
      "error"
    );

    return;

  }


  if (
    !state.selectedRequest
  ) {

    notice(
      "No existe una solicitud seleccionada.",
      "error"
    );

    return;

  }


  const approve =
    decision ===
    "approve";


  const confirmed =
    confirm(
      `${
        approve
          ? "Aprobar"
          : "Rechazar"
      } esta solicitud institucional?`
    );


  if (
    !confirmed
  ) {

    return;

  }


  const approveButton =
    $("#approveButton");


  const rejectButton =
    $("#rejectButton");


  setBusy(
    approveButton,
    true,
    "APROBANDO…"
  );


  setBusy(
    rejectButton,
    true,
    "RECHAZANDO…"
  );


  try {

    const result =
      await callables
        .reviewRequest({

          uid:

            state
              .selectedRequest
              .uid ||

            state
              .selectedRequest
              .id,

          decision

        });


    if (
      !result.data?.ok
    ) {

      throw new Error(
        "Respuesta inesperada"
      );

    }


    $("#requestDialog").close();


    state.selectedRequest =
      null;


    notice(
      `Solicitud ${
        approve
          ? "aprobada"
          : "rechazada"
      } correctamente.`
    );


    await loadRequests();

  } catch (error) {

    technicalError(
      "request-review",
      error
    );


    $("#requestMessage").textContent =
      cleanError(
        error,
        "No fue posible procesar la acreditación."
      );

  } finally {

    setBusy(
      approveButton,
      false
    );


    setBusy(
      rejectButton,
      false
    );

  }
}


/* =========================================================
   BOTONES APROBAR / RECHAZAR
   ========================================================= */

$("#approveButton").addEventListener(
  "click",
  () => {

    decideRequest(
      "approve"
    );

  }
);


$("#rejectButton").addEventListener(
  "click",
  () => {

    decideRequest(
      "reject"
    );

  }
);


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
        adminProfile
      } =
        await readAuthorizationProfiles(
          user
        );


      const authorized =
        authorizeOperationsSession(
          token.claims,
          staffProfile,
          adminProfile
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
          adminProfile
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
