// =====================================================================
// SKANO EMPRESAS — Panel SUPERADMIN (empresas.skano.cl/admin/ o /empresas/admin/)
// Conectado EXCLUSIVAMENTE a los emuladores locales (proyecto demo-*).
// Toda autorización ocurre en el backend; la interfaz solo presenta.
// Nunca se usa innerHTML con datos: todo el contenido va por textContent.
// =====================================================================

import * as C from "./admin-core.mjs?v=20261123-1";
import * as LG from "./legal-ui.mjs?v=20261123-1";
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
// Indicador de entorno técnico: se deriva de la configuración real, nunca es fijo.
if ($("envPill")) {
  $("envPill").textContent = C.environmentLabel(FBX.env.stage);
  $("envPill").classList.toggle("prod", FBX.env.stage !== "emulator");
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
["companyDialog", "contractDialog", "termsDialog", "actionDialog"].forEach((id) => bindDialogClose($(id)));

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
let actionReasonMode = "required";
function openAction({ eyebrow = "CONFIRMAR", title, text = "", fields = [], submit = "CONFIRMAR", danger = false, reason = "required", reasonLabel = "Motivo*", onSubmit }) {
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
    if (f.type === "checkbox") {
      return el("label", { class: "check-line span-2" }, el("input", { type: "checkbox", name: f.name }), f.label);
    }
    if (f.type === "select") {
      input = el("select", { name: f.name }, ...f.options.map(([v, l]) => el("option", { value: v, selected: v === f.value }, l)));
    } else {
      input = el("input", { name: f.name, type: f.type || "text", value: f.value ?? "", inputmode: f.inputmode, min: f.min });
    }
    return el("label", {}, f.label, input);
  }));
  actionHandler = onSubmit;
  actionReasonMode = reason;
  const reasonBox = form.elements.reason.closest("label");
  reasonBox.hidden = reason === "none";
  reasonBox.firstChild.textContent = reason === "optional" ? reasonLabel.replace(/\*$/, " (opcional)") : reasonLabel;
  d.showModal();
}

$("actionForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  submitWith(form, async (msg) => {
    const values = formValues(form);
    if (actionReasonMode === "required" && String(values.reason || "").trim().length < 5) { msg.textContent = "Debes indicar el motivo (mínimo 5 caracteres)."; return; }
    if (actionReasonMode === "none") delete values.reason;
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
      kpi(m.contracts.pending_review || 0, "CONTRATOS POR REVISAR", m.contracts.pending_review ? "warn" : ""),
      kpi(m.contracts.test_active || 0, "CONTRATOS DE PRUEBA VIGENTES", ""),
      kpi(m.legal?.pending_review || 0, "DOCUMENTOS LEGALES POR REVISAR", m.legal?.pending_review ? "warn" : ""),
      kpi(m.members_active, "USUARIOS ACTIVOS"),
    );
    $("quotaSummary").replaceChildren(
      quotaBlock("Embargos", m.quotas.judicial),
      quotaBlock("Encargos (registros empresariales)", m.quotas.theft),
    );
    $("contractSummary").replaceChildren(el("dl", { class: "facts" },
      el("div", {}, el("dt", {}, "VIGENTES"), el("dd", {}, C.formatNumber(m.contracts.active))),
      el("div", {}, el("dt", {}, "POR VENCER (30 DÍAS)"), el("dd", {}, C.formatNumber(m.contracts.expiring_30_days))),
      el("div", {}, el("dt", {}, "FIRMADOS POR REVISAR"), el("dd", {}, C.formatNumber(m.contracts.pending_review || 0))),
      el("div", {}, el("dt", {}, "ACTUALIZADO"), el("dd", {}, C.formatDateTime(m.generated_at_ms))),
    ), (m.pending_review || []).length ? el("ul", { class: "file-list" }, ...m.pending_review.map((p) => el("li", {},
      el("span", {}, el("b", {}, p.code || p.contract_id), el("small", {}, `Firmado cargado ${C.formatDateTime(p.signed_uploaded_at_ms)}`)),
      el("button", { class: "primary small", type: "button", onclick: () => openCompany(p.company_id) }, "REVISAR")))) : null,
    (m.legal_pending || []).length ? el("h3", {}, "DOCUMENTOS LEGALES POR REVISAR") : null,
    (m.legal_pending || []).length ? el("ul", { class: "file-list" }, ...m.legal_pending.map((p) => el("li", {},
      el("span", {}, el("b", {}, p.type), el("small", {}, `Empresa ${p.company_id} · enviado ${C.formatDateTime(p.submitted_at_ms)}`)),
      el("button", { class: "primary small", type: "button", onclick: () => openCompany(p.company_id) }, "REVISAR")))) : null);
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
    el("span", { class: "btn-row" },
      k?.test_only ? el("span", { class: "pill test" }, "DE PRUEBA") : null,
      pill(k?.state || "NONE", C.CONTRACT_STATE_LABEL[k?.state || "NONE"]))));

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
    const docFlow = !!k.document_status;
    const canRenew = !docFlow || k.document_status === "VIGENTE";
    if (k.state !== "CANCELLED") {
      card.append(el("div", { class: "btn-row" },
        !canRenew ? null : el("button", { class: "primary small", type: "button", onclick: () => openAction({
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
  if (k?.document_status) card.append(contractDocBox(k));
  if (canCreate && c.status !== "DISABLED") {
    card.append(el("div", { class: "btn-row" }, el("button", { class: "primary small", type: "button", onclick: () => openContractDialog(c.company_id) }, "NUEVO CONTRATO")));
  }
  return card;
}

function removeMember(m) {
  openAction({
    eyebrow: "ELIMINAR USUARIO", title: `Eliminar a ${m.email}`, submit: "ELIMINAR USUARIO", danger: true,
    reasonLabel: "Motivo*",
    text: "Se quita su acceso a esta empresa, se anulan sus invitaciones pendientes y se cierran sus sesiones. Si no pertenece a otra empresa, también se elimina su cuenta de acceso. Los vehículos, importaciones e historial de la empresa se conservan. No se puede deshacer: para volver a darle acceso tendrás que crearlo de nuevo.",
    fields: [{ name: "confirm_email", label: `Escribe el correo para confirmar (${m.email})*` }],
    onSubmit: async (v) => {
      const r = await api("adminRemoveCompanyUser", { company_id: currentCompanyId, uid: m.uid, reason: v.reason, confirm_email: v.confirm_email });
      toast(r.account_deleted ? `${r.email} eliminado (cuenta de acceso borrada).` : `${r.email} eliminado de esta empresa (conserva acceso a otra).`);
      await reload();
    },
  });
}

function membersList(members) {
  return el("ul", { class: "timeline", dataset: { membersList: "1" } }, ...(members.length
    ? members.map((m) => el("li", { class: "member-row" },
      el("span", {}, el("b", {}, m.email), el("span", {}, `${C.ROLE_LABEL[m.role] || m.role} · ${m.status === "ACTIVE" ? "Activo" : "Deshabilitado"}`)),
      el("button", { class: "danger small", type: "button", onclick: () => removeMember(m) }, "ELIMINAR")))
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
  const tempAccess = el("button", { class: "secondary small", type: "button", onclick: () => {
    const email = input.value.trim();
    if (!email) { result.replaceChildren(el("p", { class: "message" }, "Escribe el correo del cliente.")); return; }
    openAction({
      eyebrow: "ACCESO CON CLAVE TEMPORAL", title: `Crear acceso para ${email}`, submit: "CREAR CLAVE TEMPORAL", reason: "none",
      text: "Se crea la cuenta como administrador de la empresa con una clave provisoria de 16 caracteres, válida por 7 días. La verás una sola vez: entrégala al cliente por un canal privado (en persona o por teléfono), nunca junto al correo. Si la cuenta aún no usó su clave temporal, esto genera una nueva.",
      onSubmit: async () => {
        const r = await api("adminCreateCompanyAccess", { company_id: c.company_id, email });
        input.value = "";
        const pw = el("code", { class: "temp-pw" }, r.temporary_password);
        result.replaceChildren(el("div", { class: "invite-box temp-box" },
          el("b", {}, r.regenerated ? "Nueva clave temporal generada" : "Acceso creado"),
          el("div", {}, `Correo: ${r.email} · Rol: ${C.ROLE_LABEL[r.role] || r.role} · Vence: ${C.formatDateTime(r.expires_at_ms)}`),
          el("div", {}, "Clave temporal: ", pw, " ",
            el("button", { class: "link", type: "button", onclick: async () => { await navigator.clipboard.writeText(r.temporary_password); toast("Clave copiada."); } }, "Copiar")),
          el("div", { class: "muted" }, "Esta clave no se vuelve a mostrar. El cliente ingresa en el Portal de Empresas con su correo y esta clave; el portal le pedirá crear su propia clave."),
          el("button", { class: "link", type: "button", onclick: (ev) => { ev.currentTarget.closest(".temp-box").remove(); } }, "Ocultar")));
        toast("Acceso con clave temporal creado.");
        await reloadSoft();
      },
    });
  } }, "CLAVE TEMPORAL");
  return el("article", { class: "card" },
    el("div", { class: "card-head" }, el("h2", {}, "Usuarios de la empresa"), el("span", { class: "muted" }, `${detail.members.length}`)),
    list,
    c.status === "ACTIVE" ? el("div", { class: "btn-row" }, input, invite, tempAccess) : el("p", { class: "muted" }, "La empresa debe estar activa para invitar usuarios."),
    c.status === "ACTIVE" ? el("p", { class: "form-note" }, "INVITAR envía un enlace para que el cliente cree su clave. CLAVE TEMPORAL crea la cuenta con una clave provisoria que tú entregas; en su primer ingreso el cliente debe cambiarla, verificar su correo y configurar el doble factor.") : null,
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
      el("div", { class: "stack" }, contractCard(detail), legalCard(c), members),
      el("div", { class: "stack" },
        el("article", { class: "card" }, el("h2", {}, "Datos de la empresa"), el("dl", { class: "facts" },
          el("div", {}, el("dt", {}, "CORREO PRINCIPAL"), el("dd", {}, c.primary_email)),
          el("div", {}, el("dt", {}, "REPRESENTANTES"), el("dd", {}, people(c.representatives))),
          el("div", {}, el("dt", {}, "CONTACTOS"), el("dd", {}, people(c.contacts))),
          el("div", {}, el("dt", {}, "REGISTRADA"), el("dd", {}, C.formatDate(c.created_at_ms))),
          el("div", {}, el("dt", {}, "ID"), el("dd", {}, el("code", {}, c.company_id))),
        )),
        portfolioCard(c),
        el("article", { class: "card" }, el("h2", {}, "Eventos del contrato"), el("ul", { class: "timeline" }, ...(detail.contract_events.length
          ? detail.contract_events.map((e) => el("li", {}, el("b", {}, C.contractEventLabel(e.type)), el("span", {}, `${C.formatDateTime(e.at_ms)}${e.reason ? ` · ${e.reason}` : ""}`)))
          : [el("li", {}, el("span", {}, "Sin eventos."))]))),
        el("article", { class: "card" }, el("h2", {}, "Actividad reciente"), el("ul", { class: "timeline" }, ...(detail.audit.length
          ? detail.audit.map((a) => el("li", {}, el("b", {}, C.auditLabel(a.action)), el("span", {}, `${C.formatDateTime(a.at_ms)} · ${a.actor_role}${a.reason ? ` · ${a.reason}` : ""}`)))
          : [el("li", {}, el("span", {}, "Sin actividad."))]))),
      )),
  );
}

// ------------------------------------------------------------ centro legal

function legalCard(c) {
  const card = el("article", { class: "card" }, el("h2", {}, "Centro Legal y cumplimiento"), el("p", { class: "muted" }, "Cargando…"));
  api("adminLegalAction", { action: "LIST", company_id: c.company_id }).then((r) => {
    const fmt = (ms) => (ms ? C.formatDateTime(ms) : "—");
    card.replaceChildren(
      el("div", { class: "card-head" }, el("h2", {}, "Centro Legal y cumplimiento"),
        el("span", { class: `pill ${r.ready ? "on" : "pending"}` }, r.ready ? "Habilitada legalmente" : "Habilitación legal pendiente")),
      r.ready ? null : el("p", { class: "muted small" }, `Falta: ${r.missing.join(", ")}.`),
      el("p", { class: "legal-note" }, "Plantillas en borrador, pendientes de revisión por abogado chileno. Un contrato real no se aprueba sin la documentación exigida."),
      el("ul", { class: "file-list" }, ...r.items.map((d) => {
        const actions = [];
        if (d.mode === "CONTRATO") {
          actions.push(el("span", { class: "muted small" }, "Ver tarjeta del contrato"));
        } else {
          if (d.mode !== "CARGA" && d.status !== "PENDIENTE_REVISION") {
            actions.push(el("button", { class: "secondary small", type: "button", onclick: () => issueLegal(c, d) }, d.version ? "EMITIR NUEVA VERSIÓN" : "EMITIR"));
          }
          if (d.status === "PENDIENTE_REVISION") actions.push(el("button", { class: "primary small", type: "button", onclick: () => reviewLegal(c, d) }, "REVISAR"));
          if (d.version || d.status !== "NO_EMITIDO") actions.push(el("button", { class: "link", type: "button", onclick: () => legalHistory(c, d) }, "Ver / historial"));
        }
        return el("li", {},
          el("span", {}, el("b", {}, `${d.title}${d.required ? " *" : ""}`),
            el("small", {}, `${LG.LEGAL_MODE_LABEL[d.mode]} · v${d.version || 0} · enviado ${fmt(d.submitted_at_ms)} · vence ${fmt(d.expires_at_ms)}`),
            d.acceptance ? el("small", {}, `Aceptado por ${d.acceptance.email || d.acceptance.uid} · ${fmt(d.acceptance.at_ms)} · SHA-256 ${C.shortHash(d.acceptance.sha256)}`) : null,
            d.review?.reason ? el("small", {}, `Motivo: ${d.review.reason}`) : null),
          el("span", { class: "btn-row" }, el("span", { class: `pill ${LG.legalPillClass(d.status)}` }, LG.LEGAL_STATUS_LABEL[d.status] || d.status), ...actions));
      })),
    );
  }).catch((err) => card.replaceChildren(el("h2", {}, "Centro Legal y cumplimiento"), el("p", { class: "message" }, C.errorMessage(err))));
  return card;
}

const legalFetchAdmin = (fileId) => () => api("adminLegalAction", { action: "DOWNLOAD", file_id: fileId });

function issueLegal(c, d) {
  openAction({
    eyebrow: "CENTRO LEGAL", title: `${d.version ? "Emitir nueva versión" : "Emitir"}: ${d.title}`, submit: "EMITIR PDF",
    reason: "none",
    text: "Se genera el PDF con logotipo, sello de agua, número y versión. Si la empresa tiene contrato DE PRUEBA, lleva además la marca «DOCUMENTO DE PRUEBA — SIN VALIDEZ CONTRACTUAL». La versión anterior queda reemplazada.",
    fields: d.type === "ANEXO_CONTRACTUAL" ? [{ name: "annex_text", label: "Condiciones del anexo*", type: "text" }] : [],
    onSubmit: async (v) => {
      await api("adminLegalAction", { action: "ISSUE", company_id: c.company_id, type: d.type, annex_text: v.annex_text });
      toast("Documento emitido: queda pendiente de la empresa.");
      await reload();
    },
  });
}

async function reviewLegal(c, d) {
  const g = await api("adminLegalAction", { action: "GET", company_id: c.company_id, type: d.type });
  const sub = g.files.find((f) => f.status === "PENDING_REVIEW");
  const decide = (decision) => openAction({
    eyebrow: "REVISIÓN LEGAL", title: `${{ APROBAR: "Aprobar", RECHAZAR: "Rechazar", CORREGIR: "Solicitar corrección" }[decision]}: ${d.title}`,
    submit: { APROBAR: "APROBAR", RECHAZAR: "RECHAZAR", CORREGIR: "SOLICITAR CORRECCIÓN" }[decision], danger: decision !== "APROBAR",
    reason: decision === "APROBAR" ? "optional" : "required", reasonLabel: decision === "APROBAR" ? "Observación*" : "Motivo (lo verá la empresa)*",
    fields: decision === "APROBAR" ? [{ type: "checkbox", name: "confirm_verified", label: "Confirmo que revisé el archivo enviado, su firma y que corresponde a esta empresa." }] : [],
    onSubmit: async (v) => {
      if (decision === "APROBAR" && v.confirm_verified !== true) throw new Error("Marca la confirmación de revisión antes de aprobar.");
      await api("adminLegalAction", { action: "REVIEW", company_id: c.company_id, type: d.type, decision, reason: v.reason || undefined, confirm_verified: v.confirm_verified === true });
      toast("Revisión registrada.");
      await reload();
    },
  });
  const closeViewer = () => document.getElementById("legalViewer")?.close();
  await LG.openViewer({
    el, title: `${d.title} · ${sub ? sub.file_name : ""}`, toast,
    fetchFile: legalFetchAdmin((sub || g.files[0]).file_id),
    extra: [
      el("button", { class: "primary small", type: "button", onclick: () => { closeViewer(); decide("APROBAR"); } }, "APROBAR"),
      el("button", { class: "secondary small", type: "button", onclick: () => { closeViewer(); decide("CORREGIR"); } }, "SOLICITAR CORRECCIÓN"),
      el("button", { class: "danger small", type: "button", onclick: () => { closeViewer(); decide("RECHAZAR"); } }, "RECHAZAR"),
    ],
  });
}

async function legalHistory(c, d) {
  const g = await api("adminLegalAction", { action: "GET", company_id: c.company_id, type: d.type });
  const current = g.files[0];
  if (!current) { toast("Aún no hay archivos."); return; }
  await LG.openViewer({ el, title: `${d.title} · v${current.version}`, fetchFile: legalFetchAdmin(current.file_id), toast });
  document.querySelector("#legalViewer .viewer-body")?.after(el("div", { class: "doc-box" },
    el("h3", {}, "VERSIONES Y ARCHIVOS"),
    el("ul", { class: "file-list" }, ...g.files.map((f) => el("li", {},
      el("span", {}, el("b", {}, `${f.kind} · v${f.version}`), el("small", {}, `${f.file_name} · ${C.formatBytes(f.size)} · ${C.formatDateTime(f.created_at_ms)} · ${f.status}`), el("small", { title: f.sha256 }, `SHA-256 ${C.shortHash(f.sha256)}`)),
      el("button", { class: "link", type: "button", onclick: () => LG.openViewer({ el, title: f.file_name, fetchFile: legalFetchAdmin(f.file_id), toast }) }, "Ver")))),
    el("h3", {}, "HISTORIAL Y EVIDENCIA"),
    el("ul", { class: "timeline" }, ...(g.events.length ? g.events.map((e) => el("li", {}, el("b", {}, LG.LEGAL_EVENT_LABEL[e.type] || e.type),
      el("span", {}, [C.formatDateTime(e.at_ms), C.ROLE_LABEL[e.actor_role] || e.actor_role, e.reason].filter(Boolean).join(" · ")))) : [el("li", {}, el("span", {}, "Sin eventos."))]))));
}

// ------------------------------------------------------------ cartera de la empresa

function portfolioCard(c) {
  const card = el("article", { class: "card" }, el("h2", {}, "Cartera e importaciones"),
    el("p", { class: "muted small" }, "Resumen sin expedientes. La consulta queda registrada."),
    el("button", { class: "secondary small", type: "button", onclick: async (ev) => {
      ev.currentTarget.disabled = true;
      try {
        const r = await api("adminCompanyPortfolio", { company_id: c.company_id });
        card.replaceChildren(el("h2", {}, "Cartera e importaciones"),
          el("dl", { class: "facts compact" }, el("div", {}, el("dt", {}, "VEHÍCULOS"), el("dd", {}, C.formatNumber(r.vehicles_total))),
            ...Object.entries(r.vehicles_by_status).map(([st, n]) => el("div", {}, el("dt", {}, st), el("dd", {}, C.formatNumber(n))))),
          el("h3", {}, "IMPORTACIONES"),
          el("ul", { class: "timeline" }, ...(r.imports.length ? r.imports.slice(0, 20).map((j) => el("li", {}, el("b", {}, j.file_name),
            el("span", {}, `${C.formatDateTime(j.created_at_ms)} · ${j.status} · hoja «${j.sheet_name || "—"}», encabezados fila ${j.header_row} · ${j.summary.committed || 0} importadas · ${j.summary.invalid || 0} inválidas${Object.keys(j.constants || {}).length ? ` · valores fijos: ${Object.keys(j.constants).join(", ")}` : ""}`)))
            : [el("li", {}, el("span", {}, "Sin importaciones."))])),
          el("h3", {}, "VEHÍCULOS (PATENTE Y ESTADO)"),
          el("ul", { class: "timeline" }, ...(r.vehicles.length ? r.vehicles.slice(0, 50).map((x) => el("li", {}, el("b", {}, x.ppu), el("span", {}, `${x.status} · ${x.measure_type || "—"} · ${C.formatDateTime(x.updated_at_ms)}`)))
            : [el("li", {}, el("span", {}, "Sin vehículos."))])));
      } catch (err) { toast(C.errorMessage(err), true); ev.target.disabled = false; }
    } }, "CONSULTAR CARTERA"));
  return card;
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
    const values = formValues(form);
    const { errors, payload } = C.buildContractPayload(values);
    const t = C.buildTermsPayload(values);
    errors.push(...t.errors);
    if (errors.length) { msg.textContent = errors.join("\n"); return; }
    payload.terms = t.terms;
    payload.test_only = values.test_only === true;
    await api("adminCreateContract", payload);
    $("contractDialog").close();
    toast("Borrador de contrato creado. Emite el PDF cuando los datos estén completos.");
    await reload();
  });
});

// ------------------------------------------------------------ documento del contrato

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Descarga un PDF entregado por la función y verifica su huella SHA-256 en el navegador. */
async function downloadContractFile(fnName, fileId) {
  const r = await api(fnName, { file_id: fileId });
  const bytes = b64ToBytes(r.content_base64);
  const hash = await sha256Hex(bytes);
  if (hash !== r.sha256) throw new Error("La huella SHA-256 del archivo descargado no coincide. No se guardó el archivo.");
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = el("a", { href: url, download: r.file_name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`Descargado ${r.file_name} · SHA-256 verificado.`);
}

function fileItem(f, fnName) {
  return el("li", {},
    el("span", {},
      el("b", {}, `${C.FILE_KIND_LABEL[f.kind] || f.kind} · v${f.version}`),
      el("small", {}, `${f.file_name} · ${C.formatBytes(f.size)} · ${C.formatDateTime(f.created_at_ms)}`),
      el("small", { title: f.sha256 }, `SHA-256 ${C.shortHash(f.sha256)}`)),
    el("span", { class: "btn-row" },
      pill(f.status === "APPROVED" || f.status === "ACTIVE" ? "on" : f.status === "REJECTED" ? "EXPIRED" : "pending", C.FILE_STATUS_LABEL[f.status] || f.status),
      el("button", { class: "secondary small", type: "button", onclick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true;
        try { await downloadContractFile(fnName, f.file_id); } catch (err) { toast(C.errorMessage(err), true); } finally { b.disabled = false; }
      } }, "DESCARGAR")));
}

function termsFacts(t) {
  if (!t) return el("p", { class: "muted" }, "Sin datos del contrato.");
  const r = t.representative || {};
  const p = t.price || {};
  return el("dl", { class: "facts" },
    el("div", {}, el("dt", {}, "REPRESENTANTE"), el("dd", {}, [r.name, r.rut ? C.formatRut(r.rut) : "", r.position].filter(Boolean).join(" · ") || "—")),
    el("div", {}, el("dt", {}, "CORREO"), el("dd", {}, r.email || "—")),
    el("div", {}, el("dt", {}, "PLAN"), el("dd", {}, t.plan_name || "—")),
    el("div", {}, el("dt", {}, "PRECIO"), el("dd", {}, p.amount == null ? "—" : `${C.formatMoney(p.amount, p.currency)} ${C.PERIOD_LABEL[p.period] || ""}${p.taxes ? ` · ${p.taxes}` : ""}`)),
  );
}

function contractDocBox(k) {
  const box = el("div", { class: "doc-box" }, el("p", { class: "muted" }, "Cargando documento del contrato…"));
  api("adminContractAction", { action: "GET", contract_id: k.id })
    .then((d) => box.replaceWith(renderDocBox(d)))
    .catch((err) => box.replaceChildren(el("p", { class: "message" }, C.errorMessage(err))));
  return box;
}

function renderDocBox(d) {
  const k = d.contract;
  const ds = k.document_status;
  const id = k.contract_id;
  const act = (data, okText) => async (v) => {
    await api("adminContractAction", { contract_id: id, ...data(v) });
    toast(okText);
    await reload();
  };
  const buttons = [];
  if (["BORRADOR", "PENDIENTE_FIRMA", "RECHAZADO"].includes(ds)) {
    buttons.push(el("button", { class: "secondary small", type: "button", onclick: () => openTermsDialog(id, k.terms) }, "EDITAR DATOS"));
    buttons.push(el("button", { class: "primary small", type: "button", onclick: () => openAction({
      eyebrow: "EMITIR PDF", title: `Emitir contrato ${k.code || ""} v${(k.document_version || 0) + 1}`, submit: "EMITIR PDF", reason: "none",
      text: "Se genera un PDF nuevo con los datos actuales y queda disponible para que el representante lo descargue y firme. Las versiones anteriores quedan reemplazadas. La plantilla está pendiente de revisión jurídica.",
      onSubmit: act(() => ({ action: "ISSUE" }), "PDF emitido: pendiente de firma de la empresa."),
    }) }, ds === "BORRADOR" && !k.document_version ? "EMITIR PDF" : "EMITIR NUEVA VERSIÓN"));
  }
  const approvalBlocked = !k.test_only && !k.template_ready;
  if (ds === "PENDIENTE_REVISION") {
    buttons.push(el("button", { class: "primary small", type: "button", disabled: approvalBlocked, title: approvalBlocked ? "Bloqueado: contrato real con plantilla pendiente" : "", onclick: () => openAction({
      eyebrow: "REVISIÓN", title: "Aprobar contrato firmado", submit: "APROBAR · DEJAR VIGENTE", reason: "optional", reasonLabel: "Observación*",
      text: k.test_only
        ? "Contrato DE PRUEBA: al aprobar queda VIGENTE solo para probar el sistema en esta empresa. Sin validez contractual, sin cobro y sin alertas judiciales."
        : "Al aprobar, el contrato queda VIGENTE y se habilitan los módulos y cupos contratados. Descarga y revisa el PDF firmado antes de aprobar.",
      fields: [{ type: "checkbox", name: "confirm_verified", label: "Confirmo que revisé el PDF firmado, la identidad del firmante y que coincide con la versión emitida." }],
      onSubmit: async (v) => {
        if (v.confirm_verified !== true) throw new Error("Marca la confirmación de revisión antes de aprobar.");
        await act(() => ({ action: "REVIEW", decision: "APROBAR", confirm_verified: true, reason: v.reason || undefined }), "Contrato aprobado: VIGENTE.")(v);
      },
    }) }, "APROBAR"));
    buttons.push(el("button", { class: "danger small", type: "button", onclick: () => openAction({
      eyebrow: "REVISIÓN", title: "Rechazar contrato firmado", submit: "RECHAZAR", danger: true, reasonLabel: "Motivo del rechazo (lo verá la empresa)*",
      text: "La empresa podrá corregir y volver a cargar el PDF firmado.",
      onSubmit: act((v) => ({ action: "REVIEW", decision: "RECHAZAR", reason: v.reason }), "Contrato rechazado."),
    }) }, "RECHAZAR"));
  }
  if (!["TERMINADO"].includes(ds)) {
    buttons.push(el("button", { class: "danger small", type: "button", onclick: () => openAction({
      eyebrow: "TERMINACIÓN", title: "Terminar contrato", submit: "TERMINAR", danger: true,
      text: "El contrato queda TERMINADO y la empresa pierde la habilitación comercial. No se eliminan archivos ni registros.",
      onSubmit: act((v) => ({ action: "TERMINATE", reason: v.reason }), "Contrato terminado."),
    }) }, "TERMINAR"));
  }
  return el("div", { class: "doc-box" },
    el("div", { class: "card-head" },
      el("h3", {}, `DOCUMENTO ${k.code || ""}`),
      el("span", { class: "btn-row" },
        k.test_only ? el("span", { class: "pill test" }, "DE PRUEBA") : null,
        el("span", { class: `pill ${C.docPillClass(ds)}` }, C.DOC_STATUS_LABEL[ds] || ds))),
    k.test_only ? el("p", { class: "test-note" }, "DOCUMENTO DE PRUEBA — SIN VALIDEZ CONTRACTUAL. No activa servicios comerciales reales, no genera cobros ni habilita alertas judiciales.") : null,
    approvalBlocked ? el("p", { class: "legal-note" }, `Contrato real: no puede quedar VIGENTE hasta completar ${(k.template_missing || []).join(", ")}. El bloqueo se aplica en el servidor.`) : null,
    el("dl", { class: "facts" },
      el("div", {}, el("dt", {}, "VERSIÓN EMITIDA"), el("dd", {}, k.document_version ? `v${k.document_version}` : "Sin emitir")),
      el("div", {}, el("dt", {}, "FIRMADO CARGADO"), el("dd", {}, C.formatDateTime(k.signed_uploaded_at_ms))),
      el("div", {}, el("dt", {}, "APROBADO"), el("dd", {}, C.formatDateTime(k.approved_at_ms))),
      el("div", {}, el("dt", {}, "PLANTILLA"), el("dd", {}, k.template_version || "—"))),
    termsFacts(k.terms),
    k.legal_reviewed ? null : el("p", { class: "legal-note" }, "Plantilla en borrador: pendiente de revisión jurídica. No usar con clientes reales hasta su aprobación."),
    k.review?.decision === "RECHAZAR" ? el("p", { class: "legal-note" }, `Último rechazo: ${k.review.reason}`) : null,
    buttons.length ? el("div", { class: "btn-row" }, ...buttons) : null,
    el("h3", {}, "ARCHIVOS"),
    d.files.length ? el("ul", { class: "file-list" }, ...d.files.slice().reverse().map((f) => fileItem(f, "adminDownloadContractFile"))) : el("p", { class: "muted" }, "Sin archivos emitidos."),
    el("h3", {}, "HISTORIAL DEL DOCUMENTO"),
    el("ul", { class: "timeline" }, ...(d.events.length ? d.events.slice().sort((a, b) => b.at_ms - a.at_ms).map((e) => el("li", {},
      el("b", {}, C.contractEventLabel(e.type)),
      el("span", {}, [C.formatDateTime(e.at_ms), C.ROLE_LABEL[e.actor_role] || e.actor_role, e.file ? `${C.FILE_KIND_LABEL[e.file.kind] || e.file.kind} v${e.file.version}` : "", e.reason].filter(Boolean).join(" · "))))
      : [el("li", {}, el("span", {}, "Sin eventos."))])),
  );
}

function openTermsDialog(contractId, terms) {
  const form = $("termsForm");
  form.reset();
  form.elements.contract_id.value = contractId;
  for (const [k, v] of Object.entries(C.termsToFormValues(terms))) if (form.elements[k]) form.elements[k].value = v;
  form.querySelector("[data-message]").textContent = "";
  $("termsDialog").showModal();
}

$("termsForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  submitWith(form, async (msg) => {
    const values = formValues(form);
    const { errors, terms } = C.buildTermsPayload(values);
    if (errors.length) { msg.textContent = errors.join("\n"); return; }
    await api("adminContractAction", { action: "UPDATE_TERMS", contract_id: values.contract_id, terms });
    $("termsDialog").close();
    toast("Datos guardados. El contrato volvió a borrador: emite el PDF nuevamente.");
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
