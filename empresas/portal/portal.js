// =====================================================================
// SKANO EMPRESAS — Portal empresarial (/empresas/portal/)
// Sistema B: vehículos con embargo y medidas judiciales (Firebase
// Judicial). No muestra ni gestiona encargos por robo oficiales.
//
// - Conectado EXCLUSIVAMENTE a emuladores locales (proyecto demo-*).
// - Toda autorización ocurre en el backend; la interfaz solo presenta.
// - Sin innerHTML con datos: todo el contenido va por textContent.
// =====================================================================

import * as C from "./portal-core.mjs?v=20261120-1";

const $ = (id) => document.getElementById(id);
const SCREENS = ["envBlocked", "loading", "login", "verify", "picker", "app"];
const screen = (id) => { for (const s of SCREENS) $(s).hidden = s !== id; };

if (!C.isTestHost(location.hostname)) {
  screen("envBlocked");
  throw new Error("SKANO portal: entorno no permitido");
}
screen("loading");

// ------------------------------------------------------------ invitación
// El token llega en el fragmento; se retira de la URL de inmediato y se
// guarda solo en esta pestaña.
let pendingInvite = C.parseInviteHash(location.hash);
try {
  if (pendingInvite) sessionStorage.setItem("skano_invite", pendingInvite);
  else pendingInvite = C.parseInviteHash(`#t=${sessionStorage.getItem("skano_invite") || ""}`);
} catch (_) { /* almacenamiento no disponible */ }
if (location.hash) history.replaceState(null, "", location.pathname);
const clearInvite = () => { pendingInvite = null; try { sessionStorage.removeItem("skano_invite"); } catch (_) {} };

// ------------------------------------------------------------ Firebase
const FB = "https://www.gstatic.com/firebasejs/12.7.0";
const [{ initializeApp }, A, F] = await Promise.all([
  import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-functions.js`),
]);
const app = initializeApp({ apiKey: C.TEST_ENV.apiKey, authDomain: C.TEST_ENV.authDomain, projectId: C.TEST_ENV.projectId }, "skano-judicial-portal");
const auth = A.getAuth(app);
A.connectAuthEmulator(auth, C.TEST_ENV.authEmulatorUrl, { disableWarnings: true });
await A.setPersistence(auth, A.browserSessionPersistence);
const functions = F.getFunctions(app, C.TEST_ENV.region);
F.connectFunctionsEmulator(functions, C.TEST_ENV.functionsHost, C.TEST_ENV.functionsPort);

// ------------------------------------------------------------ utilidades
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
const pill = (tone, label) => el("span", { class: `pill ${tone}` }, label);
const statusPill = (s) => pill(C.statusTone(s), C.STATUS_LABEL[s] || s);
const td = (label, ...content) => el("td", { "data-label": label }, ...content);
const emptyRow = (cols, text) => el("tr", {}, el("td", { colspan: cols, class: "empty" }, text));

let toastTimer;
function toast(text, isError = false) {
  const t = $("toast");
  t.textContent = text;
  t.className = `toast${isError ? " error" : ""}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5600);
}

const S = { companyId: null, company: null, perms: [], role: null, memberships: [] };

async function api(name, data = {}, { withCompany = true } = {}) {
  try {
    const payload = withCompany ? { company_id: S.companyId, ...data } : data;
    return (await F.httpsCallable(functions, name)(payload)).data;
  } catch (err) {
    const reason = err?.details?.reason;
    if (["session-revoked", "user-disabled"].includes(reason) || err?.code === "functions/unauthenticated") {
      await A.signOut(auth);
      $("loginMessage").textContent = C.errorMessage(err);
    }
    throw err;
  }
}

function errorText(err) {
  const issues = err?.details?.errors;
  if (Array.isArray(issues) && issues.length) return issues.map(C.issueText).join("\n");
  const pub = err?.details?.issues;
  if (Array.isArray(pub) && pub.length) return `No cumple los requisitos de publicación:\n${pub.map((i) => `• ${i.replace(/_/g, " ")}`).join("\n")}`;
  return C.errorMessage(err);
}

function bar(used, quota) {
  const b = el("div", { class: `bar ${C.quotaLevel(used, quota)}` }, el("i"));
  b.firstChild.style.setProperty("width", `${C.quotaPercent(used, quota)}%`);
  return b;
}

function download(name, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const readFileBase64 = (file) => file.arrayBuffer().then(C.arrayBufferToBase64);

// ------------------------------------------------------------ diálogos
document.querySelectorAll("dialog").forEach((d) => d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => d.close())));

let actionHandler = null;
function openAction({ eyebrow = "CONFIRMAR", title, text = "", fields = [], submit = "CONFIRMAR", danger = false, reason = true, onSubmit }) {
  const form = $("actionForm");
  form.reset();
  form.querySelector("[data-eyebrow]").textContent = eyebrow;
  form.querySelector("[data-title]").textContent = title;
  form.querySelector("[data-text]").textContent = text;
  form.querySelector("[data-message]").textContent = "";
  form.querySelector("[data-reason-wrap]").hidden = !reason;
  form.dataset.reason = reason ? "1" : "";
  const btn = form.querySelector("[data-submit]");
  btn.textContent = submit;
  btn.className = danger ? "danger" : "primary";
  form.querySelector("[data-fields]").replaceChildren(...fields.map((f) => fieldInput(f, f.value ?? "")));
  actionHandler = onSubmit;
  $("actionDialog").showModal();
}

$("actionForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const msg = form.querySelector("[data-message]");
  const btn = form.querySelector("[data-submit]");
  const values = Object.fromEntries(new FormData(form).entries());
  if (form.dataset.reason && String(values.reason || "").trim().length < 5) { msg.textContent = "Debes indicar el motivo (mínimo 5 caracteres)."; return; }
  btn.disabled = true;
  msg.textContent = "";
  try {
    await actionHandler(values);
    $("actionDialog").close();
  } catch (err) {
    msg.textContent = errorText(err);
  } finally {
    btn.disabled = false;
  }
});

function fieldInput(f, value = "") {
  let input;
  const common = { name: f.name, id: `f_${f.name}`, maxlength: f.max, placeholder: f.placeholder, inputmode: f.inputmode, "aria-required": f.required ? "true" : null };
  if (f.type === "select") {
    input = el("select", common, ...f.options.map(([v, l]) => el("option", { value: v, selected: String(value) === v }, l)));
  } else if (f.type === "textarea") {
    input = el("textarea", common);
    input.value = value ?? "";
  } else {
    input = el("input", { ...common, type: f.type || "text", min: f.min });
    input.value = value ?? "";
  }
  return el("label", { class: f.wide ? "span-2" : null, dataset: f.showIf ? { showIf: JSON.stringify(f.showIf) } : {} }, el("span", {}, f.label, f.required ? el("span", { class: "req" }, " *") : null), input);
}

// ------------------------------------------------------------ navegación
const TITLES = { home: "INICIO", vehicles: "VEHÍCULOS CON EMBARGO", review: "PENDIENTES DE REVISIÓN", vehicle: "DETALLE DEL VEHÍCULO", import: "IMPORTAR EXCEL", alerts: "ALERTAS Y DETECCIONES", users: "USUARIOS Y PERMISOS", contract: "CONTRATO Y CUPOS", audit: "HISTORIAL DE ACTIVIDAD" };
const LOADERS = {};
let currentView = "home";

function navigate(view, arg) {
  currentView = view;
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  document.querySelectorAll("#nav .nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view || (view === "vehicle" && n.dataset.view === "vehicles")));
  $("topTitle").textContent = TITLES[view];
  $("sidebar").classList.remove("open");
  LOADERS[view]?.(arg);
}

function buildNav() {
  const items = C.visibleMenu(S.perms).map((m) => el("button", { class: "nav-item", type: "button", dataset: { view: m.view }, onclick: () => navigate(m.view) }, el("span", {}, m.icon), m.label));
  if (S.company?.contract?.modules?.theft?.enabled) {
    items.splice(2, 0, el("button", { class: "nav-item soon", type: "button", disabled: true, title: "Módulo en desarrollo (Fase 5)" }, el("span", {}, "▧"), "Vehículos con encargo", el("span", { class: "badge" }, "F5")));
  }
  $("nav").replaceChildren(...items);
}
$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));

function heading(eyebrow, title, ...actions) {
  return el("div", { class: "section-heading" }, el("div", {}, el("p", { class: "eyebrow" }, eyebrow), el("h1", {}, title)), el("div", { class: "actions" }, ...actions));
}

function contractBanner(contract) {
  const b = $("contractBanner");
  if (!contract) { b.textContent = "La empresa no tiene contrato vigente: solo lectura."; b.hidden = false; return; }
  if (contract.state !== "ACTIVE") { b.textContent = `Contrato ${C.CONTRACT_STATE_LABEL[contract.state].toLowerCase()}: altas, importaciones y publicaciones bloqueadas.`; b.hidden = false; return; }
  if (contract.days_remaining <= 30) { b.textContent = `El contrato vence en ${contract.days_remaining} día(s) (${C.formatDate(contract.ends_at_ms)}).`; b.hidden = false; return; }
  b.hidden = true;
}

// ------------------------------------------------------------ inicio
LOADERS.home = async () => {
  const v = $("view-home");
  v.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  try {
    const ov = await api("companyGetOverview");
    S.company = ov;
    contractBanner(ov.contract);
    const k = ov.contract;
    const kpi = (value, label, tone = "") => el("div", { class: `kpi ${tone} ${/^[\d.]+$/.test(String(value)) ? "" : "text"}` }, el("strong", {}, value), el("span", {}, label));
    const vs = ov.vehicles?.by_status || {};
    const kpis = el("div", { class: "kpis" },
      kpi(k ? C.CONTRACT_STATE_LABEL[k.state] : "Sin contrato", "ESTADO CONTRACTUAL", k?.state === "ACTIVE" ? "ok" : "bad"),
      kpi(k ? C.formatDate(k.ends_at_ms) : "—", "VENCIMIENTO", k && k.days_remaining <= 30 ? "warn" : ""),
      ov.vehicles ? kpi(C.formatNumber(ov.vehicles.total), "VEHÍCULOS CON EMBARGO") : null,
      ov.vehicles ? kpi(C.formatNumber((vs.PENDIENTE_REVISION || 0) + (vs.OBSERVADO || 0)), "PENDIENTES / OBSERVADOS", "warn") : null,
      ov.vehicles ? kpi(C.formatNumber(vs.PUBLICADO || 0), "PUBLICADOS", "ok") : null,
      ov.vehicles ? kpi(C.formatNumber(vs.IMPORTADO || 0), "IMPORTADOS SIN REVISAR") : null,
      ov.active_members != null ? kpi(C.formatNumber(ov.active_members), "USUARIOS ACTIVOS") : null,
    );
    const quota = k ? el("article", { class: "card" }, el("h2", {}, "Cupos contratados"),
      ...["judicial", "theft"].filter((m) => k.modules[m].enabled || k.modules[m].quota).map((m) => el("div", { class: "quota" },
        el("header", {}, el("b", {}, m === "judicial" ? "Embargos" : "Encargos (registros empresariales)"), el("span", { class: "mini" }, `${C.formatNumber(k.modules[m].used)} / ${C.formatNumber(k.modules[m].quota)}`)),
        bar(k.modules[m].used, k.modules[m].quota),
        el("small", {}, k.modules[m].enabled ? `${C.formatNumber(k.modules[m].available)} disponibles · consumen cupo: aprobados, publicados y suspendidos` : "Módulo suspendido")))) : null;
    const byStatus = ov.vehicles ? el("article", { class: "card" }, el("h2", {}, "Cartera por estado"), el("dl", { class: "facts compact" },
      ...Object.entries(C.STATUS_LABEL).filter(([s]) => vs[s]).map(([s, l]) => el("div", {}, el("dt", {}, l.toUpperCase()), el("dd", {}, C.formatNumber(vs[s])))),
      ov.vehicles.total ? null : el("div", {}, el("dt", {}, "SIN REGISTROS"), el("dd", {}, "Registra o importa vehículos para comenzar.")))) : null;
    const imports = ov.recent_imports ? el("article", { class: "card" }, el("h2", {}, "Importaciones recientes"),
      el("ul", { class: "timeline" }, ...(ov.recent_imports.length ? ov.recent_imports.map((j) => el("li", {}, el("b", {}, j.file_name),
        el("span", {}, `${C.formatDateTime(j.created_at_ms)} · ${C.IMPORT_STATUS_LABEL[j.status] || j.status} · ${j.summary.committed || 0} importadas · ${j.summary.invalid || 0} inválidas`)))
        : [el("li", {}, el("span", {}, "Sin importaciones."))]))) : null;
    const alerts = C.can(S.perms, "alerts.read") ? el("article", { class: "card" }, el("h2", {}, "Alertas privadas"),
      el("p", { class: "muted" }, ov.alerts_enabled ? "Centro de alertas activo." : "Desactivadas hasta resolver la base legal y las condiciones de tratamiento de datos.")) : null;
    v.replaceChildren(
      heading("EMPRESA", ov.company.trade_name),
      kpis,
      el("div", { class: "grid-2" }, quota, byStatus),
      el("div", { class: "grid-2" }, imports, alerts),
    );
  } catch (err) {
    v.replaceChildren(el("p", { class: "message" }, C.errorMessage(err)));
  }
};

// ------------------------------------------------------------ cartera
function vehicleList(containerId, { fixedStatus = null, title, eyebrow }) {
  const st = { items: [], cursor: null, status: fixedStatus || "", q: "", selected: new Set() };
  const box = $(containerId);
  const body = el("tbody");
  const count = el("span");
  const more = el("button", { class: "secondary", type: "button", hidden: true, onclick: () => load(false) }, "CARGAR MÁS");
  const bulk = el("div", { class: "bulk-bar", hidden: true });
  const search = el("input", { type: "search", placeholder: "Buscar por patente", class: "grow", "aria-label": "Buscar por patente", maxlength: 8 });
  const status = el("select", { "aria-label": "Filtrar por estado", hidden: Boolean(fixedStatus) }, el("option", { value: "" }, "Todos los estados"), ...Object.entries(C.STATUS_LABEL).map(([v, l]) => el("option", { value: v }, l)));
  let timer;
  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { st.q = search.value.trim(); load(true); }, 350); });
  status.addEventListener("change", () => { st.status = status.value; load(true); });
  const canBulk = C.can(S.perms, "vehicles.write");
  const headCheck = el("input", { type: "checkbox", "aria-label": "Seleccionar todos" });
  headCheck.addEventListener("change", () => {
    for (const it of st.items) if (["IMPORTADO", "BORRADOR"].includes(it.status)) { if (headCheck.checked) st.selected.add(it.vehicle_id); else st.selected.delete(it.vehicle_id); }
    render();
  });

  function renderBulk() {
    bulk.hidden = !canBulk || st.selected.size === 0;
    bulk.replaceChildren(`${st.selected.size} seleccionado(s)`, el("button", { class: "primary small", type: "button", onclick: () => openAction({
      eyebrow: "ENVÍO EN LOTE", title: `Enviar ${st.selected.size} registro(s) a revisión`, submit: "ENVIAR A REVISIÓN",
      onSubmit: async (v) => {
        const r = await api("judicialBulkTransition", { vehicle_ids: [...st.selected], to: "PENDIENTE_REVISION", reason: v.reason });
        toast(`${r.ok} enviado(s) a revisión${r.failed ? ` · ${r.failed} con error` : ""}.`, r.failed > 0);
        st.selected.clear();
        await load(true);
      },
    }) }, "ENVIAR A REVISIÓN"), el("button", { class: "link", type: "button", onclick: () => { st.selected.clear(); render(); } }, "Limpiar"));
  }

  function render() {
    body.replaceChildren(...(st.items.length ? st.items.map((v) => {
      const selectable = canBulk && ["IMPORTADO", "BORRADOR"].includes(v.status);
      const cb = el("input", { type: "checkbox", disabled: !selectable, checked: st.selected.has(v.vehicle_id), "aria-label": `Seleccionar ${v.ppu}` });
      cb.addEventListener("change", () => { if (cb.checked) st.selected.add(v.vehicle_id); else st.selected.delete(v.vehicle_id); renderBulk(); });
      return el("tr", {},
        canBulk ? el("td", { class: "check" }, cb) : null,
        td("Patente", el("span", { class: "plate" }, v.ppu)),
        td("Vehículo", [v.brand, v.model, v.year].filter(Boolean).join(" ") || "—"),
        td("Medida", C.MEASURE_LABEL[v.measure_type] || v.measure_type || "—", el("small", {}, C.MEASURE_STATUS_LABEL[v.measure_status] || "")),
        td("Causa", v.case_role || "—", el("small", {}, v.court || "")),
        td("Estado", statusPill(v.status)),
        td("Actualizado", C.formatDateTime(v.updated_at_ms)),
        td("", el("button", { class: "secondary small", type: "button", onclick: () => navigate("vehicle", v.vehicle_id) }, "VER")));
    }) : [emptyRow(8, st.q ? "Sin resultados para esa patente." : "No hay vehículos en esta vista.")]));
    count.textContent = `${st.items.length} registro(s)${st.cursor ? "+" : ""}`;
    more.hidden = !st.cursor;
    renderBulk();
  }

  async function load(reset) {
    if (reset) { st.items = []; st.cursor = null; body.replaceChildren(emptyRow(8, "Cargando…")); }
    try {
      const r = await api("judicialListVehicles", { status: st.status || undefined, q: st.q || undefined, cursor: st.cursor || undefined, limit: 50 });
      st.items.push(...r.items);
      st.cursor = r.next_cursor;
      render();
    } catch (err) {
      body.replaceChildren(emptyRow(8, errorText(err)));
    }
  }

  const actions = [];
  if (!fixedStatus && C.can(S.perms, "vehicles.write")) actions.push(el("button", { class: "primary", type: "button", onclick: () => openVehicleForm() }, "+ REGISTRAR VEHÍCULO"));
  if (!fixedStatus && C.can(S.perms, "imports.run")) actions.push(el("button", { class: "secondary", type: "button", onclick: () => navigate("import") }, "IMPORTAR EXCEL"));
  box.replaceChildren(
    heading(eyebrow, title, ...actions),
    el("div", { class: "filters" }, search, status),
    el("div", { class: "card flush" }, bulk, el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, canBulk ? el("th", { class: "check" }, headCheck) : null, ...["Patente", "Vehículo", "Medida", "Causa", "Estado", "Actualizado", ""].map((h) => el("th", {}, h)))), body)),
    el("div", { class: "table-footer" }, count, more)),
  );
  load(true);
  return { reload: () => load(true), setStatus: (s) => { st.status = s; status.value = s; load(true); } };
}

let vehiclesList = null;
LOADERS.vehicles = (status) => {
  vehiclesList = vehicleList("view-vehicles", { title: "Vehículos con embargo", eyebrow: "CARTERA JUDICIAL" });
  if (status) vehiclesList.setStatus(status);
};
LOADERS.review = () => vehicleList("view-review", { fixedStatus: "PENDIENTE_REVISION", title: "Pendientes de revisión", eyebrow: "REVISIÓN" });

// ------------------------------------------------------------ formulario
let vehicleFormCtx = null;

function openVehicleForm(existing = null) {
  const form = $("vehicleForm");
  form.reset();
  vehicleFormCtx = existing;
  const values = existing?.input || {};
  form.querySelector("[data-title]").textContent = existing ? `Modificar ${existing.vehicle.ppu}` : "Registrar vehículo con embargo";
  form.querySelector("[data-reason]").hidden = !existing;
  form.querySelector("[data-draft]").hidden = Boolean(existing);
  form.querySelector("[data-submit]").textContent = existing ? "GUARDAR CAMBIOS" : "GUARDAR Y ENVIAR A REVISIÓN";
  form.querySelector("[data-note]").textContent = existing && ["APROBADO", "PUBLICADO", "SUSPENDIDO", "EXPIRADO"].includes(existing.vehicle.status)
    ? "Cambiar patente, VIN, medida, vigencia, tribunal o rol devolverá el registro a revisión."
    : "Los campos con * son obligatorios. Los códigos judiciales se guardan exactamente como los escribas.";
  form.querySelector("[data-message]").textContent = "";
  form.querySelector("[data-fields]").replaceChildren(...C.FIELD_SECTIONS.map((sec) => el("fieldset", { class: "form-section" },
    el("legend", {}, sec.title.toUpperCase()),
    el("div", { class: "form-grid three" }, ...sec.fields.map((f) => fieldInput(f, values[f.name] ?? ""))))));
  syncShowIf(form);
  $("vehicleDialog").showModal();
}

function syncShowIf(form) {
  form.querySelectorAll("[data-show-if]").forEach((lab) => {
    const cond = JSON.parse(lab.dataset.showIf);
    lab.hidden = !Object.entries(cond).every(([k, v]) => form.elements[k]?.value === v);
  });
}
$("vehicleForm").addEventListener("change", (ev) => { if (ev.target.name === "measure_type") syncShowIf(ev.currentTarget); });

$("vehicleForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const msg = form.querySelector("[data-message]");
  const submitter = ev.submitter;
  const values = {};
  for (const f of C.ALL_FIELDS) values[f.name] = form.elements[f.name]?.value ?? "";
  if (values.measure_type !== "OTRA") values.measure_other_description = "";
  const errs = C.quickValidate(values);
  if (errs.length) { msg.textContent = errs.join("\n"); return; }
  form.querySelectorAll("[type=submit]").forEach((b) => { b.disabled = true; });
  msg.textContent = "";
  try {
    if (vehicleFormCtx) {
      const changes = C.diffValues(vehicleFormCtx.input, values);
      if (!Object.keys(changes).length) { msg.textContent = "No hay cambios."; return; }
      const reason = form.elements.__reason.value.trim();
      if (reason.length < 5) { msg.textContent = "Indica el motivo de la modificación (mínimo 5 caracteres)."; return; }
      const r = await api("judicialUpdateVehicle", { vehicle_id: vehicleFormCtx.vehicle.vehicle_id, expected_rev: vehicleFormCtx.vehicle.rev, changes, reason });
      $("vehicleDialog").close();
      toast(r.status !== vehicleFormCtx.vehicle.status ? `Cambios guardados. El registro vuelve a ${C.STATUS_LABEL[r.status].toLowerCase()}.` : "Cambios guardados.");
      await LOADERS.vehicle(vehicleFormCtx.vehicle.vehicle_id);
    } else {
      const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => String(v).trim() !== ""));
      const r = await api("judicialCreateVehicle", { fields: clean, submit: submitter?.value === "submit" });
      $("vehicleDialog").close();
      toast(r.warnings?.length ? `Registrado con advertencias: ${r.warnings.map(C.issueText).join("; ")}` : "Vehículo registrado.");
      navigate("vehicle", r.vehicle_id);
    }
  } catch (err) {
    msg.textContent = err?.details?.reason === "stale-version" ? "Otra persona modificó el registro. Cierra y vuelve a abrirlo para ver la versión actual." : errorText(err);
  } finally {
    form.querySelectorAll("[type=submit]").forEach((b) => { b.disabled = false; });
  }
});

// ------------------------------------------------------------ detalle
LOADERS.vehicle = async (vehicleId) => {
  const v = $("view-vehicle");
  v.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  let d;
  try {
    d = await api("judicialGetVehicle", { vehicle_id: vehicleId });
  } catch (err) {
    v.replaceChildren(el("p", { class: "message" }, errorText(err)));
    return;
  }
  const x = d.vehicle;
  const fact = (label, value) => el("div", {}, el("dt", {}, label.toUpperCase()), el("dd", {}, value == null || value === "" ? "—" : value));
  const actions = C.availableActions(x.status, S.perms).map((a) => el("button", { class: `${a.tone} small`, type: "button", onclick: () => openAction({
    eyebrow: "CAMBIO DE ESTADO", title: `${a.label}: ${x.ppu}`, submit: a.label.toUpperCase(), danger: a.tone === "danger",
    text: a.to === "PUBLICADO" ? "Publicar habilita el registro para coincidencias privadas cuando la autorización legal lo permita. Requiere documento acreditativo y verificación reciente."
      : a.to === "RETIRADO" ? "El registro deja de participar en la cartera. No elimina encargos policiales oficiales." : "",
    onSubmit: async (val) => {
      await api("judicialTransitionVehicle", { vehicle_id: x.vehicle_id, to: a.to, expected_rev: x.rev, reason: val.reason });
      toast(`Estado actualizado: ${C.STATUS_LABEL[a.to]}.`);
      await LOADERS.vehicle(x.vehicle_id);
    },
  }) }, a.label.toUpperCase()));
  if (C.canEdit(x.status, S.perms)) actions.unshift(el("button", { class: "secondary small", type: "button", onclick: () => openVehicleForm(d) }, "MODIFICAR"));

  const docs = d.documents == null ? null : el("article", { class: "card" },
    el("div", { class: "card-head" }, el("h2", {}, "Documentos y fotografías"), el("span", { class: "muted" }, String(d.documents.length))),
    el("ul", { class: "doc-list" }, ...(d.documents.length ? d.documents.map((doc) => el("li", {},
      el("div", {}, el("b", {}, C.DOC_KIND_LABEL[doc.kind] || doc.kind), el("small", {}, `${doc.file_name} · ${Math.ceil(doc.size / 1024)} KB · ${C.formatDateTime(doc.uploaded_at_ms)}`)),
      el("button", { class: "link", type: "button", onclick: async () => {
        try {
          const r = await api("judicialGetDocumentUrl", { document_id: doc.document_id });
          window.open(r.url, "_blank", "noopener,noreferrer");
        } catch (err) { toast(errorText(err), true); }
      } }, "Abrir (enlace temporal)")))
      : [el("li", {}, el("span", { class: "muted" }, "Sin documentos. La publicación requiere un documento acreditativo."))])),
    C.can(S.perms, "documents.write") && C.canEdit(x.status, S.perms) ? uploadRow(x) : null);

  const history = el("article", { class: "card" }, el("h2", {}, "Historial del registro"),
    el("ul", { class: "timeline" }, ...d.history.map((h) => {
      let title = "Registro creado";
      if (h.type === "STATUS") title = `${C.STATUS_LABEL[h.from] || h.from} → ${C.STATUS_LABEL[h.to] || h.to}`;
      if (h.type === "EDIT") title = `Modificación${h.status_after !== h.status_before ? ` · vuelve a ${C.STATUS_LABEL[h.status_after]}` : ""}`;
      if (h.type === "FILE_ATTACHED") title = "Archivo agregado";
      if (h.type === "CREATED" && h.source === "import") title = "Creado por importación Excel";
      return el("li", {}, el("b", {}, title), el("span", {}, `${C.formatDateTime(h.at_ms)}${h.reason ? ` · ${h.reason}` : ""}`),
        h.changes ? el("ul", {}, ...h.changes.map((c) => el("li", {}, `${C.FIELD_LABEL[c.field] || c.field.replace(/_ms$/, "")}: ${fmtHist(c.before)} → ${fmtHist(c.after)}`))) : null);
    })));

  v.replaceChildren(
    el("button", { class: "link", type: "button", onclick: () => navigate("vehicles") }, "← Volver a la cartera"),
    el("div", { class: "detail-head" },
      el("div", {}, el("p", { class: "eyebrow" }, "VEHÍCULO CON EMBARGO · SISTEMA B"), el("h1", {}, el("span", { class: "plate" }, x.ppu), el("small", {}, [x.brand, x.model, x.version, x.year, x.color].filter(Boolean).join(" · ") || "Sin datos del vehículo"))),
      el("div", { class: "actions" }, statusPill(x.status), ...actions)),
    el("div", { class: "detail-grid" },
      el("div", { class: "stack" },
        el("article", { class: "card" }, el("h2", {}, "Antecedentes judiciales"), el("dl", { class: "facts compact" },
          fact("Tipo de medida", C.MEASURE_LABEL[x.measure_type] || x.measure_type),
          x.measure_type === "OTRA" ? fact("Descripción", x.measure_other_description) : null,
          fact("Vigencia", C.MEASURE_STATUS_LABEL[x.measure_status] || x.measure_status),
          fact("Tribunal", x.court), fact("Rol / causa", x.case_role), fact("Año causa", x.case_year),
          fact("N° resolución", x.resolution_number), fact("Fecha resolución", x.resolution_date_ms ? C.formatDate(x.resolution_date_ms) : null),
          fact("Inscripción", x.measure_registration_date_ms ? C.formatDate(x.measure_registration_date_ms) : null),
          fact("Mandante / acreedor", x.creditor), fact("Expediente interno", x.internal_case_id), fact("Referencia documental", x.document_reference),
          fact("Última verificación", x.last_verified_at_ms ? C.formatDate(x.last_verified_at_ms) : null), fact("Calidad jurídica", x.company_legal_capacity))),
        el("article", { class: "card" }, el("h2", {}, "Identificación y gestión"), el("dl", { class: "facts compact" },
          fact("VIN / chasis", x.vin), fact("N° motor", x.engine_number), fact("Tipo", x.vehicle_type),
          fact("Responsable", x.responsible), fact("Prioridad", x.priority), fact("Estado interno", x.internal_status),
          fact("Origen", x.source === "import" ? `Importación (fila ${x.import_row})` : "Registro manual"),
          fact("Observaciones", x.observations))),
        docs),
      el("div", { class: "stack" }, history)),
  );
};

function fmtHist(v) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return `${v.length} archivo(s)`;
  if (typeof v === "number" && v > 1e11) return C.formatDate(v);
  return String(v);
}

function uploadRow(x) {
  const kind = el("select", { "aria-label": "Tipo de archivo" }, ...C.DOC_KINDS.map(([v, l]) => el("option", { value: v }, l)));
  const file = el("input", { type: "file", accept: ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg", "aria-label": "Archivo" });
  const msg = el("p", { class: "message" });
  const btn = el("button", { class: "primary small", type: "button", onclick: async () => {
    msg.textContent = "";
    const f = file.files[0];
    const problem = C.checkUpload(f, "doc");
    if (problem) { msg.textContent = problem; return; }
    btn.disabled = true;
    try {
      const r = await api("judicialUploadDocument", { vehicle_id: x.vehicle_id, kind: kind.value, file_name: f.name, content_base64: await readFileBase64(f) });
      toast(r.status !== x.status ? `Documento agregado. El registro vuelve a ${C.STATUS_LABEL[r.status].toLowerCase()}.` : "Archivo agregado.");
      await LOADERS.vehicle(x.vehicle_id);
    } catch (err) {
      msg.textContent = errorText(err);
    } finally {
      btn.disabled = false;
    }
  } }, "SUBIR");
  return el("div", {}, el("div", { class: "upload-row" }, el("label", {}, "Tipo", kind), el("label", {}, "Archivo (PDF, PNG o JPEG · máx. 5 MB)", file), btn), msg);
}

// ------------------------------------------------------------ importador
const IMP = { job: null, rows: [], filter: "INVALID", after: null, file: null, mapping: {} };

LOADERS.import = () => renderImportStart();

function steps(active) {
  const names = ["Archivo", "Revisión y corrección", "Confirmación"];
  return el("div", { class: "steps" }, ...names.map((n, i) => el("div", { class: `step ${i + 1 < active ? "done" : i + 1 === active ? "active" : ""}` }, el("b", {}, String(i + 1)), n.toUpperCase())));
}

function renderImportStart(blocked = null) {
  const v = $("view-import");
  const file = el("input", { type: "file", accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", id: "importFile", "aria-label": "Archivo Excel" });
  const msg = el("p", { class: "message" });
  const btn = el("button", { class: "primary", type: "button" }, "VALIDAR ARCHIVO");
  const zone = el("div", { class: "dropzone" }, el("b", {}, "Arrastra aquí tu archivo .xlsx o selecciónalo"), file, el("small", {}, "Máximo 5.000 filas y 7 MB. Solo se lee la primera hoja."));
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("drag"); if (e.dataTransfer.files[0]) { const dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); file.files = dt.files; } });
  btn.addEventListener("click", async () => {
    msg.textContent = "";
    const f = file.files[0] || IMP.file;
    const problem = C.checkUpload(f, "xlsx");
    if (problem) { msg.textContent = problem; return; }
    IMP.file = f;
    btn.disabled = true;
    btn.textContent = "VALIDANDO…";
    try {
      const r = await api("judicialValidateImport", { file_name: f.name, content_base64: await readFileBase64(f), mapping: Object.keys(IMP.mapping).length ? IMP.mapping : undefined });
      if (r.blocked) { renderImportStart(r); return; }
      IMP.job = r;
      IMP.mapping = {};
      if (r.reused) toast("Este archivo ya había sido validado: se muestra el resultado existente.");
      await renderImportReview();
    } catch (err) {
      msg.textContent = errorText(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "VALIDAR ARCHIVO";
    }
  });

  let mappingBox = null;
  if (blocked) {
    const c = blocked.columns;
    mappingBox = el("article", { class: "card" },
      el("h2", {}, "Asigna las columnas obligatorias"),
      el("p", { class: "muted" }, `No reconocimos estas columnas en «${blocked.file_name}». Indica cuál de tus encabezados corresponde a cada campo.`),
      el("div", { class: "mapping" }, ...c.missing_required.map((field) => {
        const sel = el("select", { "aria-label": `Columna para ${C.FIELD_LABEL[field] || field}` }, el("option", { value: "" }, "Seleccionar columna…"),
          ...c.headers.filter((h) => h && !Object.values(c.mapping).includes(h)).map((h) => el("option", { value: h, selected: IMP.mapping[h] === field }, h)));
        sel.addEventListener("change", () => {
          for (const [h, f] of Object.entries(IMP.mapping)) if (f === field) delete IMP.mapping[h];
          if (sel.value) IMP.mapping[sel.value] = field;
        });
        return el("label", {}, `${C.FIELD_LABEL[field] || field} *`, sel);
      })),
      el("p", { class: "form-note" }, "Vuelve a presionar «Validar archivo» con el mismo archivo."));
  } else {
    IMP.mapping = {};
  }

  v.replaceChildren(
    heading("CARGA MASIVA", "Importar vehículos con embargo"),
    steps(1),
    el("article", { class: "card" },
      el("p", { class: "muted" }, "Las filas válidas se crean en estado «Importado»: nunca se publican automáticamente y no consumen cupo hasta su aprobación. Las inválidas quedan pendientes para corregir."),
      el("div", { class: "btn-row" }, el("a", { class: "secondary small", href: "/empresas/portal/plantillas/skano_plantilla_embargos.xlsx", download: true }, "DESCARGAR PLANTILLA")),
      zone, el("div", { class: "btn-row" }, btn), msg),
    mappingBox,
    importHistory(),
  );
}

function importHistory() {
  const box = el("article", { class: "card" }, el("h2", {}, "Importaciones anteriores"), el("p", { class: "muted" }, "Cargando…"));
  api("judicialListImports").then((r) => {
    box.replaceChildren(el("h2", {}, "Importaciones anteriores"), el("ul", { class: "timeline" }, ...(r.items.length ? r.items.map((j) => el("li", {},
      el("b", {}, j.file_name), el("span", {}, `${C.formatDateTime(j.created_at_ms)} · ${j.status === "COMMITTED" ? "Confirmada" : C.IMPORT_STATUS_LABEL[j.status] || j.status} · ${j.summary.committed || 0} importadas · ${j.summary.invalid || 0} inválidas pendientes`),
      j.summary.invalid > 0 || j.status === "VALIDATED" ? el("button", { class: "link", type: "button", onclick: async () => { IMP.job = { job_id: j.job_id, file_name: j.file_name, summary: j.summary, status: j.status }; await renderImportReview(); } }, "Continuar") : null))
      : [el("li", {}, el("span", {}, "Sin importaciones."))])));
  }).catch(() => box.remove());
  return box;
}

async function renderImportReview() {
  const v = $("view-import");
  const job = IMP.job;
  IMP.rows = [];
  IMP.after = null;
  const chipsBox = el("div", { class: "chips" });
  const body = el("tbody");
  const more = el("button", { class: "secondary", type: "button", hidden: true, onclick: () => loadRows(false) }, "CARGAR MÁS");
  const commitBtn = el("button", { class: "primary", type: "button" });
  const reportBtn = el("button", { class: "secondary", type: "button", onclick: async () => {
    try { const r = await api("judicialImportErrorReport", { job_id: job.job_id }); download(r.file_name, r.csv); } catch (err) { toast(errorText(err), true); }
  } }, "DESCARGAR REPORTE DE ERRORES (CSV)");

  function renderChips() {
    const s = job.summary;
    const chip = (key, label, n, tone) => {
      const b = el("button", { class: `chip ${tone} ${IMP.filter === key ? "selected" : ""}`, type: "button", onclick: () => { IMP.filter = key; renderChips(); loadRows(true); } }, el("strong", {}, C.formatNumber(n)), el("span", {}, label));
      return b;
    };
    chipsBox.replaceChildren(
      chip("INVALID", "INVÁLIDAS", s.invalid, "bad"),
      chip("WARNING", "CON ADVERTENCIAS", s.warning, "warn"),
      chip("VALID", "VÁLIDAS", s.valid, "ok"),
      chip("DUPLICATE_EXISTING", "YA EXISTENTES", s.duplicate_existing, ""),
      chip("COMMITTED", "IMPORTADAS", s.committed || 0, "ok"),
    );
    const n = (s.valid || 0) + (s.warning || 0);
    commitBtn.textContent = n ? `IMPORTAR ${C.formatNumber(n)} FILA(S) VÁLIDA(S)` : "SIN FILAS PARA IMPORTAR";
    commitBtn.disabled = n === 0 || !C.can(S.perms, "imports.run");
  }

  function renderRows() {
    body.replaceChildren(...(IMP.rows.length ? IMP.rows.map((r) => el("tr", {},
      td("Fila", String(r.row)),
      td("Patente", el("span", { class: "plate" }, r.values?.ppu || "—")),
      td("Medida / causa", r.values?.measure_type || "—", el("small", {}, [r.values?.case_role, r.values?.court].filter(Boolean).join(" · "))),
      td("Problemas", r.errors.length ? el("ul", { class: "issues" }, ...r.errors.map((e) => el("li", {}, C.issueText(e)))) : null,
        r.warnings.length ? el("ul", { class: "issues warn" }, ...r.warnings.map((e) => el("li", {}, C.issueText(e)))) : null,
        !r.errors.length && !r.warnings.length ? "—" : null),
      td("", ["INVALID", "WARNING", "DUPLICATE_EXISTING"].includes(r.status) ? el("button", { class: "secondary small", type: "button", onclick: () => fixRow(r) }, "CORREGIR")
        : r.vehicle_id ? el("button", { class: "link", type: "button", onclick: () => navigate("vehicle", r.vehicle_id) }, "Ver") : null)))
      : [emptyRow(5, "No hay filas en esta categoría.")]));
    more.hidden = !IMP.after;
  }

  async function loadRows(reset) {
    if (reset) { IMP.rows = []; IMP.after = null; body.replaceChildren(emptyRow(5, "Cargando…")); }
    try {
      const r = await api("judicialGetImportRows", { job_id: job.job_id, status: IMP.filter, after_row: IMP.after || undefined, limit: 100 });
      job.summary = r.job.summary;
      IMP.rows.push(...r.items);
      IMP.after = r.next_after_row;
      renderChips();
      renderRows();
    } catch (err) {
      body.replaceChildren(emptyRow(5, errorText(err)));
    }
  }

  function fixRow(r) {
    const fields = C.ALL_FIELDS.filter((f) => f.name !== "measure_other_description" && f.type !== "textarea" && (r.values?.[f.name] !== undefined || f.required))
      .map((f) => ({ ...f, type: f.type === "date" || f.type === "select" ? "text" : f.type, value: r.values?.[f.name] ?? "" }));
    openAction({
      eyebrow: `FILA ${r.row}`, title: "Corregir fila", reason: false, submit: "GUARDAR Y VALIDAR",
      text: [...r.errors, ...r.warnings].map(C.issueText).join(" · ") || "Edita los valores de la fila.",
      fields: fields.map((f) => ({ ...f, options: undefined })),
      onSubmit: async (vals) => {
        const values = {};
        for (const f of fields) if (vals[f.name] !== undefined && String(vals[f.name]) !== String(r.values?.[f.name] ?? "")) values[f.name] = vals[f.name];
        const res = await api("judicialFixImportRow", { job_id: job.job_id, row: r.row, values });
        job.summary = res.summary;
        toast(res.row.status === "INVALID" ? `La fila ${r.row} aún tiene errores.` : `Fila ${r.row}: ${C.IMPORT_STATUS_LABEL[res.row.status]}.`, res.row.status === "INVALID");
        await loadRows(true);
      },
    });
  }

  commitBtn.addEventListener("click", () => openAction({
    eyebrow: "CONFIRMAR IMPORTACIÓN", title: commitBtn.textContent.toLowerCase().replace(/^./, (c) => c.toUpperCase()), reason: false, submit: "IMPORTAR",
    text: "Se crearán en estado «Importado». Luego deben enviarse a revisión, aprobarse y publicarse. Las filas inválidas quedarán pendientes.",
    onSubmit: async () => {
      const r = await api("judicialCommitImport", { job_id: job.job_id });
      renderImportDone(r);
    },
  }));

  v.replaceChildren(
    heading("CARGA MASIVA", job.file_name, el("button", { class: "link", type: "button", onclick: () => renderImportStart() }, "Cargar otro archivo")),
    steps(2), chipsBox,
    el("div", { class: "card flush" }, el("div", { class: "table-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ...["Fila", "Patente", "Medida / causa", "Problemas", ""].map((h) => el("th", {}, h)))), body)),
    el("div", { class: "table-footer" }, el("span", {}, "Corrige las filas o descarga el reporte, corrige el Excel y vuelve a cargarlo."), more)),
    el("div", { class: "btn-row" }, reportBtn, commitBtn),
  );
  IMP.filter = (job.summary.invalid || 0) > 0 ? "INVALID" : (job.summary.warning || 0) > 0 ? "WARNING" : "VALID";
  renderChips();
  await loadRows(true);
}

function renderImportDone(r) {
  const v = $("view-import");
  v.replaceChildren(
    heading("CARGA MASIVA", "Importación confirmada"),
    steps(3),
    el("div", { class: "chips" },
      el("div", { class: "chip ok" }, el("strong", {}, C.formatNumber(r.created)), el("span", {}, "CREADOS (IMPORTADO)")),
      el("div", { class: "chip" }, el("strong", {}, C.formatNumber(r.skipped_existing)), el("span", {}, "YA EXISTÍAN")),
      el("div", { class: `chip ${r.summary.invalid ? "bad" : ""}` }, el("strong", {}, C.formatNumber(r.summary.invalid)), el("span", {}, "INVÁLIDAS PENDIENTES"))),
    el("div", { class: "btn-row" },
      el("button", { class: "primary", type: "button", onclick: () => navigate("vehicles", "IMPORTADO") }, "VER IMPORTADOS Y ENVIAR A REVISIÓN"),
      r.summary.invalid ? el("button", { class: "secondary", type: "button", onclick: () => renderImportReview() }, "CORREGIR PENDIENTES") : null,
      el("button", { class: "link", type: "button", onclick: () => renderImportStart() }, "Importar otro archivo")),
  );
}

// ------------------------------------------------------------ alertas
LOADERS.alerts = async () => {
  const v = $("view-alerts");
  v.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  try {
    const r = await api("companyListAlerts");
    const legend = el("div", { class: "state-legend" }, ...r.statuses.map((s) => pill("off", s.replace(/_/g, " "))));
    v.replaceChildren(
      heading("ALERTAS PRIVADAS", "Alertas y detecciones"),
      r.enabled ? el("article", { class: "card" }, el("p", {}, "Sin alertas.")) : el("div", { class: "disabled-card" },
        el("p", { class: "eyebrow" }, "CENTRO DESACTIVADO"),
        el("h2", {}, "Pendiente de autorización legal"),
        el("p", { class: "muted" }, r.message),
        el("p", { class: "muted" }, "Cuando se habilite, cada alerta mostrará solo la última ubicación registrada con su fecha y hora, sin indicar la ubicación actual. Una detección no autoriza intervenir, perseguir ni retener vehículos."),
        el("p", { class: "section-title" }, "ESTADOS PREVISTOS"), legend),
    );
  } catch (err) {
    v.replaceChildren(el("p", { class: "message" }, errorText(err)));
  }
};

// ------------------------------------------------------------ usuarios
LOADERS.users = async () => {
  const v = $("view-users");
  v.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  const manage = C.can(S.perms, "members.manage");
  try {
    const [members, invites] = await Promise.all([api("companyListMembers"), manage ? api("companyListInvitations") : null]);
    const me = auth.currentUser?.uid;
    const rows = members.items.map((m) => el("tr", {},
      td("Usuario", m.email, m.uid === me ? el("small", {}, "Tú") : null),
      td("Rol", C.ROLE_LABEL[m.role] || m.role),
      td("Estado", pill(m.status === "ACTIVE" ? "on" : "off", m.status === "ACTIVE" ? "Activo" : "Deshabilitado")),
      td("", manage && m.uid !== me ? el("div", { class: "btn-row" },
        el("button", { class: "secondary small", type: "button", onclick: () => openAction({
          eyebrow: "ROL", title: `Cambiar rol de ${m.email}`, submit: "CAMBIAR ROL", text: "El usuario deberá volver a iniciar sesión.",
          fields: [{ name: "role", label: "Nuevo rol", type: "select", options: C.ASSIGNABLE_ROLES }],
          onSubmit: async (val) => { await api("companyChangeMemberRole", { uid: m.uid, role: val.role, reason: val.reason }); toast("Rol actualizado."); await LOADERS.users(); },
        }) }, "ROL"),
        el("button", { class: m.status === "ACTIVE" ? "danger small" : "secondary small", type: "button", onclick: () => openAction({
          eyebrow: "ACCESO", title: `${m.status === "ACTIVE" ? "Deshabilitar" : "Reactivar"} a ${m.email}`, danger: m.status === "ACTIVE",
          submit: m.status === "ACTIVE" ? "DESHABILITAR" : "REACTIVAR", text: m.status === "ACTIVE" ? "Se cerrarán sus sesiones en esta empresa." : "",
          onSubmit: async (val) => { await api("companySetMemberStatus", { uid: m.uid, status: m.status === "ACTIVE" ? "DISABLED" : "ACTIVE", reason: val.reason }); toast("Usuario actualizado."); await LOADERS.users(); },
        }) }, m.status === "ACTIVE" ? "DESHABILITAR" : "REACTIVAR")) : null)));

    const inviteCard = manage ? (() => {
      const email = el("input", { type: "email", placeholder: "correo@empresa.cl", "aria-label": "Correo del invitado" });
      const role = el("select", { "aria-label": "Rol" }, ...C.ASSIGNABLE_ROLES.map(([r, l]) => el("option", { value: r }, l)));
      const out = el("div");
      const btn = el("button", { class: "primary small", type: "button", onclick: async () => {
        btn.disabled = true;
        out.replaceChildren();
        try {
          const r = await api("companyInviteMember", { email: email.value, role: role.value });
          email.value = "";
          out.replaceChildren(el("div", { class: "invite-box" }, `Invitación creada para ${r.email} (${C.ROLE_LABEL[r.role]}), vence ${C.formatDate(r.expires_at_ms)}.`,
            r.invite_url ? el("div", {}, "Entorno de pruebas — ", el("button", { class: "link", type: "button", onclick: async () => { await navigator.clipboard.writeText(r.invite_url); toast("Enlace copiado."); } }, "copiar enlace de invitación")) : null));
          await refreshInvites();
        } catch (err) {
          out.replaceChildren(el("p", { class: "message" }, errorText(err)));
        } finally { btn.disabled = false; }
      } }, "INVITAR");
      return el("article", { class: "card" }, el("h2", {}, "Invitar usuario"),
        el("div", { class: "upload-row" }, el("label", {}, "Correo", email), el("label", {}, "Rol", role), btn), out);
    })() : null;

    const invitesBox = el("ul", { class: "timeline" });
    async function refreshInvites() {
      const r = manage ? await api("companyListInvitations") : { items: [] };
      invitesBox.replaceChildren(...(r.items.length ? r.items.map((i) => el("li", {},
        el("b", {}, `${i.email} · ${C.ROLE_LABEL[i.role]}`),
        el("span", {}, i.expired ? "Vencida" : `Vence ${C.formatDate(i.expires_at_ms)}`), " ",
        el("button", { class: "link", type: "button", onclick: async () => { try { await api("companyRevokeInvitation", { invitation_id: i.invitation_id }); toast("Invitación revocada."); await refreshInvites(); } catch (err) { toast(errorText(err), true); } } }, "Revocar")))
        : [el("li", {}, el("span", {}, "Sin invitaciones pendientes."))]));
    }
    if (invites) await refreshInvites();

    v.replaceChildren(
      heading("EQUIPO", "Usuarios y permisos"),
      el("div", { class: "card flush" }, el("div", { class: "table-wrap" }, el("table", {},
        el("thead", {}, el("tr", {}, ...["Usuario", "Rol", "Estado", ""].map((h) => el("th", {}, h)))), el("tbody", {}, ...rows)))),
      manage ? el("div", { class: "grid-2" }, inviteCard, el("article", { class: "card" }, el("h2", {}, "Invitaciones pendientes"), invitesBox)) : null,
    );
  } catch (err) {
    v.replaceChildren(el("p", { class: "message" }, errorText(err)));
  }
};

// ------------------------------------------------------------ contrato
LOADERS.contract = async () => {
  const v = $("view-contract");
  v.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  try {
    const ov = await api("companyGetOverview");
    const k = ov.contract;
    v.replaceChildren(
      heading("CONTRATO", "Contrato y cupos"),
      !k ? el("article", { class: "card" }, el("p", { class: "muted" }, "La empresa no tiene contrato registrado. Contacta a SKANO.")) :
        el("div", { class: "grid-2" },
          el("article", { class: "card" }, el("div", { class: "card-head" }, el("h2", {}, "Vigencia"), pill(k.state === "ACTIVE" ? "on" : "bad", C.CONTRACT_STATE_LABEL[k.state])),
            el("dl", { class: "facts" },
              el("div", {}, el("dt", {}, "INICIO"), el("dd", {}, C.formatDate(k.starts_at_ms))),
              el("div", {}, el("dt", {}, "TÉRMINO"), el("dd", {}, C.formatDate(k.ends_at_ms))),
              el("div", {}, el("dt", {}, "DÍAS RESTANTES"), el("dd", {}, k.state === "ACTIVE" ? C.formatNumber(k.days_remaining) : "—")),
              el("div", {}, el("dt", {}, "ALERTAS POR DETECCIÓN"), el("dd", {}, k.detection_alerts_enabled ? "Activas" : "Desactivadas · base legal pendiente")))),
          el("article", { class: "card" }, el("h2", {}, "Cupos por módulo"), ...["judicial", "theft"].map((m) => el("div", { class: "quota" },
            el("header", {}, el("b", {}, m === "judicial" ? "Embargos" : "Encargos (registros empresariales)"), el("span", { class: "mini" }, `${C.formatNumber(k.modules[m].used)} / ${C.formatNumber(k.modules[m].quota)}`)),
            bar(k.modules[m].used, k.modules[m].quota),
            el("small", {}, !k.modules[m].enabled ? "Módulo no contratado o suspendido" : k.modules[m].over_quota ? "Uso sobre el cupo: nuevas aprobaciones bloqueadas" : `${C.formatNumber(k.modules[m].available)} disponibles`))),
            el("p", { class: "form-note" }, "Consumen cupo los registros aprobados, publicados y suspendidos. Para ampliar el cupo o renovar, contacta a SKANO."))),
    );
  } catch (err) {
    v.replaceChildren(el("p", { class: "message" }, errorText(err)));
  }
};

// ------------------------------------------------------------ auditoría
LOADERS.audit = async () => {
  const v = $("view-audit");
  const body = el("tbody", {}, emptyRow(5, "Cargando…"));
  v.replaceChildren(heading("TRAZABILIDAD", "Historial de actividad"), el("div", { class: "card flush" }, el("div", { class: "table-wrap" }, el("table", {},
    el("thead", {}, el("tr", {}, ...["Fecha", "Acción", "Detalle", "Actor", "Motivo"].map((h) => el("th", {}, h)))), body))));
  try {
    const r = await api("companyListAudit", { limit: 100 });
    body.replaceChildren(...(r.items.length ? r.items.map((a) => el("tr", {},
      td("Fecha", C.formatDateTime(a.at_ms)),
      td("Acción", C.auditLabel(a.action)),
      td("Detalle", a.target?.ppu ? el("span", { class: "plate" }, a.target.ppu) : a.target?.file_name || a.target?.email || "—"),
      td("Actor", C.ROLE_LABEL[a.actor_role] || a.actor_role),
      td("Motivo", a.reason || "—"))) : [emptyRow(5, "Sin actividad registrada.")]));
  } catch (err) {
    body.replaceChildren(emptyRow(5, errorText(err)));
  }
};

// ------------------------------------------------------------ sesión
let authMode = "signin";
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth]").forEach((t) => { t.classList.toggle("active", t.dataset.auth === mode); t.setAttribute("aria-selected", String(t.dataset.auth === mode)); });
  $("confirmWrap").hidden = mode !== "signup";
  $("pwHint").hidden = mode !== "signup";
  $("forgotBtn").hidden = mode === "signup";
  $("loginSubmit").textContent = mode === "signup" ? "CREAR CUENTA" : "INGRESAR";
  $("loginPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("loginMessage").textContent = "";
}
document.querySelectorAll("[data-auth]").forEach((t) => t.addEventListener("click", () => setAuthMode(t.dataset.auth)));

function showLogin() {
  $("inviteBanner").hidden = !pendingInvite;
  $("authTabs").hidden = !pendingInvite;
  if (!pendingInvite) setAuthMode("signin");
  screen("login");
}

$("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = $("loginMessage");
  const email = $("loginEmail").value.trim();
  const pw = $("loginPassword").value;
  msg.textContent = "";
  const btn = $("loginSubmit");
  btn.disabled = true;
  try {
    if (authMode === "signup") {
      if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { msg.textContent = "La contraseña debe tener al menos 10 caracteres, con letras y números."; return; }
      if (pw !== $("loginPassword2").value) { msg.textContent = "Las contraseñas no coinciden."; return; }
      const cred = await A.createUserWithEmailAndPassword(auth, email, pw);
      await A.sendEmailVerification(cred.user).catch(() => {});
    } else {
      await A.signInWithEmailAndPassword(auth, email, pw);
    }
  } catch (err) {
    msg.textContent = err?.code === "auth/email-already-in-use" ? "Ya existe una cuenta con ese correo: usa «Ingresar»." : authMode === "signup" ? "No se pudo crear la cuenta." : "Credenciales inválidas.";
  } finally {
    btn.disabled = false;
    $("loginPassword").value = "";
    $("loginPassword2").value = "";
  }
});

$("forgotBtn").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) { $("loginMessage").textContent = "Ingresa tu correo para recuperar la contraseña."; return; }
  try { await A.sendPasswordResetEmail(auth, email); } catch (_) { /* respuesta uniforme */ }
  $("loginMessage").textContent = "Si el correo está registrado, recibirás instrucciones.";
});

const logout = () => A.signOut(auth);
$("logoutBtn").addEventListener("click", logout);
$("pickerLogout").addEventListener("click", logout);
$("verifyLogout").addEventListener("click", logout);
$("verifyResend").addEventListener("click", async () => {
  try { await A.sendEmailVerification(auth.currentUser); $("verifyMessage").textContent = "Correo reenviado."; } catch (_) { $("verifyMessage").textContent = "Espera un momento antes de reenviar."; }
});
$("verifyContinue").addEventListener("click", async () => {
  await A.reload(auth.currentUser);
  if (!auth.currentUser.emailVerified) { $("verifyMessage").textContent = "Tu correo aún no aparece verificado."; return; }
  await A.getIdToken(auth.currentUser, true);
  await afterLogin(auth.currentUser);
});
$("switchCompany").addEventListener("click", () => showPicker());

function showPicker() {
  const list = $("pickerList");
  if (!S.memberships.length) {
    $("pickerTitle").textContent = "Tu cuenta no pertenece a ninguna empresa";
    list.replaceChildren(el("p", { class: "muted" }, "Solicita una invitación al administrador de tu empresa."),
      S.isPlatform ? el("a", { class: "primary small", href: "/empresas/admin/" }, "IR A SUPERADMINISTRACIÓN") : null);
  } else {
    $("pickerTitle").textContent = "Selecciona una empresa";
    list.replaceChildren(...S.memberships.map((m) => el("button", { class: "picker-item", type: "button", onclick: () => enterCompany(m) },
      el("span", {}, el("b", {}, m.trade_name), el("small", {}, C.ROLE_LABEL[m.role] || m.role)),
      m.company_status === "SUSPENDED" ? pill("pending", "Suspendida") : pill("on", "Activa"))));
  }
  screen("picker");
}

async function enterCompany(m) {
  S.companyId = m.company_id;
  screen("loading");
  $("loadingText").textContent = "Cargando empresa…";
  try {
    const ov = await api("companyGetOverview");
    S.company = ov;
    S.perms = ov.me.permissions;
    S.role = ov.me.role;
    $("sessionCompany").textContent = ov.company.trade_name;
    $("sessionRole").textContent = (C.ROLE_LABEL[S.role] || S.role).toUpperCase();
    $("sessionEmail").textContent = auth.currentUser?.email || "";
    $("switchCompany").hidden = S.memberships.length < 2;
    buildNav();
    contractBanner(ov.contract);
    screen("app");
    navigate("home");
  } catch (err) {
    toast(errorText(err), true);
    showPicker();
  }
}

async function afterLogin(user) {
  screen("loading");
  $("loadingText").textContent = "Validando acceso…";
  if (!user.emailVerified) {
    $("verifyEmail").textContent = user.email;
    $("verifyMessage").textContent = "";
    screen("verify");
    return;
  }
  try {
    if (pendingInvite) {
      try {
        const r = await api("meAcceptInvitation", { token: pendingInvite }, { withCompany: false });
        toast(`Te uniste a la empresa como ${C.ROLE_LABEL[r.role] || r.role}.`);
      } catch (err) {
        toast(err?.details?.reason === "already-exists" ? "Ya perteneces a esa empresa." : "La invitación no es válida, ya fue usada o venció.", true);
      }
      clearInvite();
    }
    const me = await api("meListMemberships", {}, { withCompany: false });
    S.memberships = me.memberships;
    S.isPlatform = me.is_platform_admin;
    if (S.memberships.length === 1) await enterCompany(S.memberships[0]);
    else showPicker();
  } catch (err) {
    await A.signOut(auth).catch(() => {});
    $("loginMessage").textContent = C.errorMessage(err);
  }
}

A.onAuthStateChanged(auth, async (user) => {
  if (!user) {
    Object.assign(S, { companyId: null, company: null, perms: [], role: null, memberships: [] });
    showLogin();
    return;
  }
  await afterLogin(user);
});
