// =====================================================================
// SKANO EMPRESAS — Panel SUPERADMIN (empresas.skano.cl/admin/ o /empresas/admin/)
// Conectado EXCLUSIVAMENTE a los emuladores locales (proyecto demo-*).
// Toda autorización ocurre en el backend; la interfaz solo presenta.
// Nunca se usa innerHTML con datos: todo el contenido va por textContent.
// =====================================================================

import * as C from "./admin-core.mjs?v=20261121-1";
import { bootFirebase, signInWithSecondFactor, handleMfaRequired, signInErrorText } from "../judicial-firebase.mjs?v=20261122-2";

const $ = (id) => document.getElementById(id);
const SCREENS = ["envBlocked", "loading", "login", "app"];

function screen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

screen("loading");

// Entorno: emuladores en 127.0.0.1; en un dominio publicado, solo con la
// configuración del proyecto Judicial completa (judicial-env.mjs) y App Check.
const FBX = await bootFirebase("skano-judicial-admin");
if (!FBX) {
  screen("envBlocked");
  throw new Error("SKANO admin: entorno no habilitado");
}
const { auth, functions } = FBX;
if (FBX.env.stage === "emulator" && $("envTag")) {
  $("envTag").lastChild.textContent = " ENTORNO DE PRUEBAS · EMULADORES LOCALES";
}
const { onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, signOut } = FBX.A;
const { httpsCallable } = FBX.F;

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

const pill = (value, label) => el("span", { class: `pill ${C.pillClass(value)}` }, label);
const td = (label, ...content) => el("td", { "data-label": label }, ...content);

let toastTimer;
function toast(text, isError = false) {
  const t = $("toast");
  t.textContent = text;
  t.className = `toast${isError ? " error" : ""}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5200);
}

async function api(name, data = {}) {
  try {
    const res = await httpsCallable(functions, name)(data);
    return res.data;
  } catch (err) {
    const reason = err?.details?.reason;
    if (reason === "mfa-required") {
      const text = await handleMfaRequired(FBX);
      $("loginMessage").textContent = text;
      throw Object.assign(new Error(text), { code: "skano/mfa-required" });
    }
    if (["session-revoked", "user-disabled"].includes(reason) || err?.code === "functions/unauthenticated") {
      await signOut(auth);
      $("loginMessage").textContent = C.errorMessage(err);
    }
    throw err;
  }
}

function bar(used, quota) {
  const b = el("div", { class: `bar ${C.quotaLevel(used, quota)}` }, el("i"));
  b.firstChild.style.setProperty("width", `${C.quotaPercent(used, quota)}%`);
  return b;
}

function quotaBlock(label, m) {
  return el("div", { class: "quota" },
    el("header", {}, el("b", {}, label), el("span", { class: "mini" }, `${C.formatNumber(m.used)} / ${C.formatNumber(m.quota)}`)),
    bar(m.used, m.quota),
    el("small", {}, m.over_quota ? "Uso sobre el cupo: nuevas publicaciones bloqueadas" : `${C.formatNumber(m.available ?? Math.max(0, m.quota - m.used))} disponibles`));
}

// ------------------------------------------------------------ diálogos

function bindDialogClose(dialog) {
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dialog.close()));
}
["companyDialog", "contractDialog", "actionDialog"].forEach((id) => bindDialogClose($(id)));

function formValues(form) {
  const values = {};
  for (const elx of form.elements) {
    if (!elx.name) continue;
    values[elx.name] = elx.type === "checkbox" ? elx.checked : elx.value;
  }
  return values;
}

async function submitWith(form, fn) {
  const msg = form.querySelector("[data-message]");
  const btn = form.querySelector("[type=submit]");
  msg.textContent = "";
  btn.disabled = true;
  try {
    await fn(msg);
  } catch (err) {
    msg.textContent = C.errorMessage(err);
  } finally {
    btn.disabled = false;
  }
}

let actionHandler = null;
function openAction({ eyebrow = "CONFIRMAR", title, text = "", fields = [], submit = "CONFIRMAR", danger = false, onSubmit }) {
  const d = $("actionDialog");
  const form = $("actionForm");
  form.reset();
  form.querySelector("[data-eyebrow]").textContent = eyebrow;
  form.querySelector("[data-title]").textContent = title;
  form.querySelector("[data-text]").textContent = text;
  form.querySelector("[data-message]").textContent = "";
  const btn = form.querySelector("[data-submit]");
  btn.textContent = submit;
  btn.className = danger ? "danger" : "primary";
  const box = form.querySelector("[data-fields]");
  box.replaceChildren(...fields.map((f) => {
    let input;
    if (f.type === "select") {
      input = el("select", { name: f.name }, ...f.options.map(([v, l]) => el("option", { value: v, selected: v === f.value }, l)));
    } else {
      input = el("input", { name: f.name, type: f.type || "text", value: f.value ?? "", inputmode: f.inputmode, min: f.min });
    }
    return el("label", {}, f.label, input);
  }));
  actionHandler = onSubmit;
  d.showModal();
}

$("actionForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  submitWith(form, async (msg) => {
    const values = formValues(form);
    if (String(values.reason || "").trim().length < 5) { msg.textContent = "Debes indicar el motivo (mínimo 5 caracteres)."; return; }
    await actionHandler(values);
    $("actionDialog").close();
  });
});

// ------------------------------------------------------------ navegación

const TITLES = { overview: "RESUMEN DE LA PLATAFORMA", companies: "EMPRESAS", company: "DETALLE DE EMPRESA", audit: "HISTORIAL DE ACTIVIDAD" };

function navigate(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view || (view === "company" && n.dataset.view === "companies")));
  $("topTitle").textContent = TITLES[view];
  $("sidebar").classList.remove("open");
  if (view === "overview") loadOverview();
  if (view === "companies") loadCompanies(true);
  if (view === "audit") loadAudit();
}

document.querySelectorAll(".nav-item").forEach((n) => n.addEventListener("click", () => navigate(n.dataset.view)));
$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("backBtn").addEventListener("click", () => navigate("companies"));

// ------------------------------------------------------------ resumen

async function loadOverview() {
  try {
    const m = await api("adminPlatformMetrics");
    const kpi = (value, label, tone = "") => el("div", { class: `kpi ${tone}` }, el("strong", {}, C.formatNumber(value)), el("span", {}, label));
    $("kpis").replaceChildren(
      kpi(m.companies.total, "EMPRESAS REGISTRADAS"),
      kpi(m.companies.active, "EMPRESAS ACTIVAS", "ok"),
      kpi(m.companies.suspended, "SUSPENDIDAS", "warn"),
      kpi(m.companies.disabled, "DESHABILITADAS", "bad"),
      kpi(m.contracts.active, "CONTRATOS VIGENTES", "ok"),
      kpi(m.contracts.expiring_30_days, "VENCEN EN 30 DÍAS", m.contracts.expiring_30_days ? "warn" : ""),
      kpi(m.members_active, "USUARIOS ACTIVOS"),
    );
    $("quotaSummary").replaceChildren(
      quotaBlock("Embargos", m.quotas.judicial),
      quotaBlock("Encargos (registros empresariales)", m.quotas.theft),
    );
    $("contractSummary").replaceChildren(el("dl", { class: "facts" },
      el("div", {}, el("dt", {}, "VIGENTES"), el("dd", {}, C.formatNumber(m.contracts.active))),
      el("div", {}, el("dt", {}, "POR VENCER (30 DÍAS)"), el("dd", {}, C.formatNumber(m.contracts.expiring_30_days))),
      el("div", {}, el("dt", {}, "ACTUALIZADO"), el("dd", {}, C.formatDateTime(m.generated_at_ms))),
    ));
  } catch (err) {
    toast(C.errorMessage(err), true);
  }
}

// ------------------------------------------------------------ empresas

const listState = { items: [], cursor: null };

let companiesSeq = 0;
async function loadCompanies(reset) {
  const my = ++companiesSeq;
  if (reset) { listState.items = []; listState.cursor = null; }
  const body = $("companiesBody");
  if (reset) body.replaceChildren(el("tr", {}, el("td", { colspan: 8, class: "empty" }, "Cargando…")));
  try {
    const res = await api("adminListCompanies", { status: $("statusFilter").value || undefined, cursor: listState.cursor || undefined, limit: 25 });
    if (my !== companiesSeq) return;
    listState.items.push(...res.items);
    listState.cursor = res.next_cursor;
    renderCompanies();
  } catch (err) {
    if (my !== companiesSeq) return;
    body.replaceChildren(el("tr", {}, el("td", { colspan: 8, class: "empty" }, C.errorMessage(err))));
  }
}

function moduleCell(contract, m) {
  const mod = contract?.modules?.[m];
  if (!mod || !mod.enabled) return el("span", { class: "pill off" }, "—");
  return el("span", { class: "mini" }, `${C.formatNumber(mod.used)} / ${C.formatNumber(mod.quota)}`);
}

function renderCompanies() {
  const rows = listState.items.map((c) => el("tr", {},
    td("Empresa", el("b", {}, c.trade_name), el("small", {}, c.legal_name)),
    td("RUT", C.formatRut(c.rut)),
    td("Estado", pill(c.status, C.COMPANY_STATUS_LABEL[c.status] || c.status)),
    td("Contrato", pill(c.contract?.state || "NONE", C.CONTRACT_STATE_LABEL[c.contract?.state || "NONE"])),
    td("Vence", c.contract ? C.formatDate(c.contract.ends_at_ms) : "—"),
    td("Embargos", moduleCell(c.contract, "judicial")),
    td("Encargos", moduleCell(c.contract, "theft")),
    td("", el("button", { class: "secondary small", type: "button", onclick: () => openCompany(c.company_id) }, "VER")),
  ));
  $("companiesBody").replaceChildren(...(rows.length ? rows : [el("tr", {}, el("td", { colspan: 8, class: "empty" }, "No hay empresas registradas."))]));
  $("companiesCount").textContent = `${listState.items.length} empresa(s)`;
  $("moreCompaniesBtn").hidden = !listState.cursor;
}

$("statusFilter").addEventListener("change", () => loadCompanies(true));
$("moreCompaniesBtn").addEventListener("click", () => loadCompanies(false));

$("newCompanyBtn").addEventListener("click", () => {
  $("companyForm").reset();
  $("companyForm").querySelector("[data-message]").textContent = "";
  $("companyDialog").showModal();
});

$("companyForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  submitWith(form, async (msg) => {
    const { errors, payload } = C.buildCompanyPayload(formValues(form));
    if (errors.length) { msg.textContent = errors.join("\n"); return; }
    const res = await api("adminCreateCompany", payload);
    $("companyDialog").close();
    toast("Empresa creada.");
    await openCompany(res.company_id);
  });
});

// ------------------------------------------------------------ detalle

let currentCompanyId = null;

async function openCompany(companyId) {
  currentCompanyId = companyId;
  navigate("company");
  const box = $("companyDetail");
  box.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  try {
    renderCompany(await api("adminGetCompany", { company_id: companyId }));
  } catch (err) {
    box.replaceChildren(el("p", { class: "message" }, C.errorMessage(err)));
  }
}

const reload = () => openCompany(currentCompanyId);

function companyStatusActions(c) {
  const set = (status, label, danger = false) => el("button", {
    class: danger ? "danger small" : "secondary small", type: "button",
    onclick: () => openAction({
      eyebrow: "ESTADO DE EMPRESA", title: `${label}: ${c.trade_name}`, danger, submit: label.toUpperCase(),
      text: status === "DISABLED" ? "Los usuarios de la empresa perderán el acceso. Los registros no se eliminan." : status === "SUSPENDED" ? "La empresa conservará solo acceso de lectura." : "",
      onSubmit: async (v) => { await api("adminSetCompanyStatus", { company_id: c.company_id, status, reason: v.reason }); toast("Estado actualizado."); await reload(); },
    }),
  }, label.toUpperCase());
  const out = [];
  if (c.status !== "ACTIVE") out.push(set("ACTIVE", "Reactivar"));
  if (c.status === "ACTIVE") out.push(set("SUSPENDED", "Suspender"));
  if (c.status !== "DISABLED") out.push(set("DISABLED", "Deshabilitar", true));
  return out;
}

function contractCard(detail) {
  const c = detail.company;
  const k = detail.contract;
  const card = el("article", { class: "card" });
  const canCreate = !k || ["EXPIRED", "CANCELLED"].includes(k.state);
  card.append(el("div", { class: "card-head" },
    el("h2", {}, "Contrato y cupos"),
    pill(k?.state || "NONE", C.CONTRACT_STATE_LABEL[k?.state || "NONE"])));

  if (!k) {
    card.append(el("p", { class: "muted" }, "La empresa no tiene contrato. Sin contrato no puede usar ningún módulo."));
  } else {
    card.append(el("dl", { class: "facts" },
      el("div", {}, el("dt", {}, "INICIO"), el("dd", {}, C.formatDate(k.starts_at_ms))),
      el("div", {}, el("dt", {}, "TÉRMINO"), el("dd", {}, C.formatDate(k.ends_at_ms))),
      el("div", {}, el("dt", {}, "DÍAS RESTANTES"), el("dd", {}, k.state === "ACTIVE" ? C.formatNumber(k.days_remaining) : "—")),
      el("div", {}, el("dt", {}, "ALERTAS POR DETECCIÓN"), el("dd", {}, "Deshabilitadas · base legal pendiente")),
    ));
    for (const m of ["judicial", "theft"]) {
      const mod = k.modules[m];
      const cancelled = k.state === "CANCELLED";
      card.append(el("div", { class: "module-row" },
        el("div", { class: "card-head" }, el("b", {}, C.MODULE_LABEL[m]), pill(mod.enabled ? "on" : "off", mod.enabled ? "ACTIVO" : "SUSPENDIDO")),
        quotaBlock("Cupo", mod),
        cancelled ? null : el("div", { class: "btn-row" },
          el("button", { class: "secondary small", type: "button", onclick: () => openAction({
            eyebrow: "CUPOS", title: `Cupo de ${C.MODULE_LABEL[m]}`, submit: "GUARDAR CUPO",
            text: `En uso: ${C.formatNumber(mod.used)}. Una reducción nunca elimina vehículos; solo bloquea nuevas publicaciones.`,
            fields: [{ name: "quota", label: "Nuevo cupo", type: "number", min: 0, value: mod.quota }],
            onSubmit: async (v) => {
              const plan = await api("adminUpdateQuota", { contract_id: k.id, module: m, quota: Number(v.quota), reason: v.reason });
              toast(plan.over_quota ? "Cupo reducido bajo el uso actual: nuevas publicaciones bloqueadas." : "Cupo actualizado.");
              await reload();
            },
          }) }, "CAMBIAR CUPO"),
          el("button", { class: "secondary small", type: "button", onclick: () => openAction({
            eyebrow: "MÓDULOS", title: `${mod.enabled ? "Suspender" : "Activar"} ${C.MODULE_LABEL[m]}`, submit: mod.enabled ? "SUSPENDER" : "ACTIVAR",
            onSubmit: async (v) => { await api("adminSetModule", { contract_id: k.id, module: m, enabled: !mod.enabled, reason: v.reason }); toast("Módulo actualizado."); await reload(); },
          }) }, mod.enabled ? "SUSPENDER MÓDULO" : "ACTIVAR MÓDULO"),
        ),
      ));
    }
    if (k.state !== "CANCELLED") {
      card.append(el("div", { class: "btn-row" },
        el("button", { class: "primary small", type: "button", onclick: () => openAction({
          eyebrow: "RENOVACIÓN", title: "Renovar vigencia", submit: "RENOVAR",
          text: k.state === "EXPIRED" ? "El contrato está vencido: el nuevo período comienza hoy y los registros vencidos deberán reverificarse." : "La vigencia se extiende desde la fecha de término actual.",
          fields: [{ name: "months", label: "Extensión", type: "select", value: "12", options: [["1", "1 mes"], ["2", "2 meses"], ["3", "3 meses"], ["6", "6 meses"], ["12", "12 meses"], ["24", "24 meses"]] }],
          onSubmit: async (v) => { await api("adminRenewContract", { contract_id: k.id, months: Number(v.months), reason: v.reason }); toast("Contrato renovado."); await reload(); },
        }) }, "RENOVAR"),
        k.status === "SUSPENDED"
          ? el("button", { class: "secondary small", type: "button", onclick: () => openAction({
            title: "Reactivar contrato", submit: "REACTIVAR",
            onSubmit: async (v) => { await api("adminSetContractStatus", { contract_id: k.id, status: "ACTIVE", reason: v.reason }); toast("Contrato reactivado."); await reload(); },
          }) }, "REACTIVAR")
          : el("button", { class: "secondary small", type: "button", onclick: () => openAction({
            title: "Suspender contrato", submit: "SUSPENDER", text: "Se detienen las funciones comerciales hasta reactivar.",
            onSubmit: async (v) => { await api("adminSetContractStatus", { contract_id: k.id, status: "SUSPENDED", reason: v.reason }); toast("Contrato suspendido."); await reload(); },
          }) }, "SUSPENDER"),
        el("button", { class: "danger small", type: "button", onclick: () => openAction({
          title: "Cancelar contrato", submit: "CANCELAR CONTRATO", danger: true,
          text: "La cancelación es definitiva para este contrato. No elimina registros ni afecta encargos policiales oficiales.",
          onSubmit: async (v) => { await api("adminSetContractStatus", { contract_id: k.id, status: "CANCELLED", reason: v.reason }); toast("Contrato cancelado."); await reload(); },
        }) }, "CANCELAR"),
      ));
    }
  }
  if (canCreate && c.status !== "DISABLED") {
    card.append(el("div", { class: "btn-row" }, el("button", { class: "primary small", type: "button", onclick: () => openContractDialog(c.company_id) }, "NUEVO CONTRATO")));
  }
  return card;
}

function membersList(members) {
  return el("ul", { class: "timeline", dataset: { membersList: "1" } }, ...(members.length
    ? members.map((m) => el("li", {}, el("b", {}, m.email), el("span", {}, `${C.ROLE_LABEL[m.role] || m.role} · ${m.status === "ACTIVE" ? "Activo" : "Deshabilitado"}`)))
    : [el("li", {}, el("span", {}, "Sin usuarios. Invita a un administrador de la empresa."))]));
}

function membersCard(detail) {
  const c = detail.company;
  const list = membersList(detail.members);
  const input = el("input", { type: "email", placeholder: "correo@empresa.cl", "aria-label": "Correo del administrador" });
  const result = el("div");
  const invite = el("button", { class: "primary small", type: "button", onclick: async () => {
    invite.disabled = true;
    result.replaceChildren();
    try {
      const r = await api("adminInviteCompanyAdmin", { company_id: c.company_id, email: input.value });
      input.value = "";
      const inviteUrl = r.invite_url ? C.localizeInviteUrl(r.invite_url, location.origin, FBX.env.hosts) : "";
      result.replaceChildren(el("div", { class: "invite-box" },
        `Invitación creada para ${r.email} (vence ${C.formatDate(r.expires_at_ms)}).`,
        r.delivery === "email" ? el("div", {}, `Enviamos el enlace por correo a ${r.email}.`) : null,
        inviteUrl ? el("div", {}, "Comparte este enlace solo con la persona invitada: ", el("code", {}, C.inviteLinkForDisplay(inviteUrl)), " ",
          el("button", { class: "link", type: "button", onclick: async () => { await navigator.clipboard.writeText(inviteUrl); toast("Enlace copiado."); } }, "Copiar enlace completo")) : null));
      await reloadSoft();
    } catch (err) {
      result.replaceChildren(el("p", { class: "message" }, C.errorMessage(err)));
    } finally {
      invite.disabled = false;
    }
  } }, "INVITAR ADMINISTRADOR");
  return el("article", { class: "card" },
    el("div", { class: "card-head" }, el("h2", {}, "Usuarios de la empresa"), el("span", { class: "muted" }, `${detail.members.length}`)),
    list,
    c.status === "ACTIVE" ? el("div", { class: "btn-row" }, input, invite) : el("p", { class: "muted" }, "La empresa debe estar activa para invitar usuarios."),
    result);
}

async function reloadSoft() {
  try {
    const detail = await api("adminGetCompany", { company_id: currentCompanyId });
    const list = document.querySelector("[data-members-list]");
    if (list) list.replaceWith(membersList(detail.members));
  } catch (_) { /* la vista completa se recarga en la próxima acción */ }
}

function renderCompany(detail) {
  const c = detail.company;
  const people = (list) => (list?.length ? list.map((p) => [p.name, p.email, p.phone].filter(Boolean).join(" · ")).join("\n") : "—");
  const members = membersCard(detail);
  $("companyDetail").replaceChildren(
    el("div", { class: "detail-head" },
      el("div", {}, el("p", { class: "eyebrow" }, "EMPRESA"), el("h1", {}, c.trade_name, el("small", {}, `${c.legal_name} · RUT ${C.formatRut(c.rut)}`))),
      el("div", { class: "actions" }, pill(c.status, C.COMPANY_STATUS_LABEL[c.status]), ...companyStatusActions(c))),
    el("div", { class: "detail-grid" },
      el("div", { class: "stack" }, contractCard(detail), members),
      el("div", { class: "stack" },
        el("article", { class: "card" }, el("h2", {}, "Datos de la empresa"), el("dl", { class: "facts" },
          el("div", {}, el("dt", {}, "CORREO PRINCIPAL"), el("dd", {}, c.primary_email)),
          el("div", {}, el("dt", {}, "REPRESENTANTES"), el("dd", {}, people(c.representatives))),
          el("div", {}, el("dt", {}, "CONTACTOS"), el("dd", {}, people(c.contacts))),
          el("div", {}, el("dt", {}, "REGISTRADA"), el("dd", {}, C.formatDate(c.created_at_ms))),
          el("div", {}, el("dt", {}, "ID"), el("dd", {}, el("code", {}, c.company_id))),
        )),
        el("article", { class: "card" }, el("h2", {}, "Eventos del contrato"), el("ul", { class: "timeline" }, ...(detail.contract_events.length
          ? detail.contract_events.map((e) => el("li", {}, el("b", {}, C.contractEventLabel(e.type)), el("span", {}, `${C.formatDateTime(e.at_ms)}${e.reason ? ` · ${e.reason}` : ""}`)))
          : [el("li", {}, el("span", {}, "Sin eventos."))]))),
        el("article", { class: "card" }, el("h2", {}, "Actividad reciente"), el("ul", { class: "timeline" }, ...(detail.audit.length
          ? detail.audit.map((a) => el("li", {}, el("b", {}, C.auditLabel(a.action)), el("span", {}, `${C.formatDateTime(a.at_ms)} · ${a.actor_role}${a.reason ? ` · ${a.reason}` : ""}`)))
          : [el("li", {}, el("span", {}, "Sin actividad."))]))),
      )),
  );
}

// ------------------------------------------------------------ contrato

function openContractDialog(companyId) {
  const form = $("contractForm");
  form.reset();
  form.elements.company_id.value = companyId;
  const today = new Date();
  form.elements.starts_at.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  form.querySelector("[data-custom]").hidden = true;
  form.querySelector("[data-message]").textContent = "";
  $("contractDialog").showModal();
}

$("contractForm").elements.duration.addEventListener("change", (ev) => {
  $("contractForm").querySelector("[data-custom]").hidden = ev.target.value !== "custom";
});

$("contractForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  submitWith(form, async (msg) => {
    const { errors, payload } = C.buildContractPayload(formValues(form));
    if (errors.length) { msg.textContent = errors.join("\n"); return; }
    await api("adminCreateContract", payload);
    $("contractDialog").close();
    toast("Contrato creado.");
    await reload();
  });
});

// ------------------------------------------------------------ auditoría

async function loadAudit() {
  const body = $("auditBody");
  body.replaceChildren(el("tr", {}, el("td", { colspan: 5, class: "empty" }, "Cargando…")));
  try {
    const companyId = $("auditCompany").value.trim();
    const res = await api("adminListAudit", { company_id: companyId || undefined, limit: 100 });
    body.replaceChildren(...(res.items.length ? res.items.map((a) => el("tr", {},
      td("Fecha", C.formatDateTime(a.at_ms)),
      td("Acción", C.auditLabel(a.action)),
      td("Empresa", a.company_id ? el("code", {}, a.company_id) : "—"),
      td("Actor", a.actor_role, el("small", {}, a.actor_uid)),
      td("Motivo", a.reason || "—"),
    )) : [el("tr", {}, el("td", { colspan: 5, class: "empty" }, "Sin registros."))]));
  } catch (err) {
    body.replaceChildren(el("tr", {}, el("td", { colspan: 5, class: "empty" }, C.errorMessage(err))));
  }
}
$("auditBtn").addEventListener("click", loadAudit);

// ------------------------------------------------------------ sesión

$("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = $("loginMessage");
  msg.textContent = "";
  const btn = ev.currentTarget.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    await signInWithSecondFactor(FBX, $("loginEmail").value.trim(), $("loginPassword").value);
  } catch (err) {
    msg.textContent = signInErrorText(err);
  } finally {
    btn.disabled = false;
    $("loginPassword").value = "";
  }
});

$("forgotBtn").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) { $("loginMessage").textContent = "Ingresa tu correo para recuperar la contraseña."; return; }
  try { await sendPasswordResetEmail(auth, email); } catch (_) { /* respuesta uniforme */ }
  $("loginMessage").textContent = "Si el correo está registrado, recibirás instrucciones.";
});

$("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) { screen("login"); return; }
  screen("loading");
  $("loadingText").textContent = "Validando permisos de superadministración…";
  try {
    if (!user.emailVerified) {
      await sendEmailVerification(user).catch(() => {});
      await signOut(auth);
      $("loginMessage").textContent = "Debes verificar tu correo. Te enviamos un enlace de verificación.";
      return;
    }
    const me = await api("meListMemberships");
    if (!me.is_platform_admin) {
      await signOut(auth);
      $("loginMessage").textContent = "Tu cuenta no tiene acceso de superadministración.";
      return;
    }
    $("sessionEmail").textContent = user.email;
    screen("app");
    navigate("overview");
  } catch (err) {
    await signOut(auth).catch(() => {});
    $("loginMessage").textContent = C.errorMessage(err);
  }
});
