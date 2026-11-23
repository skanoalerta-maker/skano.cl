// Centro Legal — utilidades compartidas por el panel SUPERADMIN y el Portal
// de Empresas: etiquetas, visor seguro y descarga verificada.
// El visor nunca usa enlaces públicos: el archivo llega por la función
// (Firebase Functions), se verifica su SHA-256 en el navegador y se muestra
// desde un blob local que se libera al cerrar.

export const LEGAL_STATUS_LABEL = Object.freeze({
  NO_EMITIDO: "No emitido",
  PENDIENTE_EMPRESA: "Pendiente de la empresa",
  PENDIENTE_REVISION: "Pendiente de revisión SKANO",
  APROBADO: "Aprobado",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado",
  CORRECCION_SOLICITADA: "Corrección solicitada",
  VENCIDO: "Vencido",
  // Estados del contrato (fila del contrato de servicios)
  BORRADOR: "Contrato en borrador",
  PENDIENTE_FIRMA: "Contrato pendiente de firma",
  SIN_CONTRATO: "Sin contrato",
  SIN_FLUJO: "Contrato anterior al flujo de firma",
  TERMINADO: "Contrato terminado",
});

export const LEGAL_MODE_LABEL = Object.freeze({
  CONTRATO: "Contrato",
  FIRMA: "Firma del representante",
  ACEPTACION: "Aceptación electrónica",
  CARGA: "Documento de la empresa",
});

export const LEGAL_EVENT_LABEL = Object.freeze({
  ISSUED: "Emitido por SKANO",
  SUBMITTED: "Enviado por la empresa",
  ACCEPTED: "Aceptado electrónicamente",
  APPROVED: "Aprobado por SKANO",
  REJECTED: "Rechazado por SKANO",
  CORRECTION_REQUESTED: "Corrección solicitada por SKANO",
  VIEWED: "Visualizado o descargado",
});

export function legalPillClass(status) {
  if (["APROBADO", "ACEPTADO"].includes(status)) return "on";
  if (["PENDIENTE_EMPRESA", "PENDIENTE_REVISION", "BORRADOR", "PENDIENTE_FIRMA", "NO_EMITIDO"].includes(status)) return "pending";
  if (["RECHAZADO", "CORRECCION_SOLICITADA", "VENCIDO", "TERMINADO", "SIN_CONTRATO"].includes(status)) return "bad";
  return "off";
}

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

/** Recibe { content_base64, sha256, content_type, file_name } y devuelve un Blob verificado. */
export async function verifiedBlob(r) {
  const bytes = b64ToBytes(r.content_base64);
  if ((await sha256Hex(bytes)) !== r.sha256) throw new Error("La huella SHA-256 del archivo no coincide. No se mostrará.");
  return new Blob([bytes], { type: r.content_type || "application/octet-stream" });
}

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Visor seguro en un diálogo propio. fetchFile() devuelve la respuesta de
 * la función DOWNLOAD. extra: nodos adicionales al pie (p. ej. aceptar).
 */
export async function openViewer({ el, title, fetchFile, toast, extra = [] }) {
  let dialog = document.getElementById("legalViewer");
  if (!dialog) {
    dialog = el("dialog", { id: "legalViewer", class: "viewer-dialog" });
    document.body.append(dialog);
  }
  const body = el("div", { class: "viewer-body" }, el("p", { class: "muted" }, "Cargando documento…"));
  let url = null;
  const close = () => { dialog.close(); if (url) URL.revokeObjectURL(url); url = null; };
  const downloadBtn = el("button", { class: "secondary small", type: "button", disabled: true }, "DESCARGAR COPIA");
  dialog.replaceChildren(el("div", { class: "modal viewer" },
    el("button", { class: "close", type: "button", "aria-label": "Cerrar", onclick: close }, "×"),
    el("p", { class: "eyebrow" }, "VISOR SEGURO"), el("h2", {}, title),
    body,
    el("div", { class: "btn-row" }, downloadBtn, ...extra, el("button", { class: "ghost small", type: "button", onclick: close }, "CERRAR"))));
  dialog.addEventListener("cancel", () => { if (url) URL.revokeObjectURL(url); url = null; }, { once: true });
  dialog.showModal();
  try {
    const r = await fetchFile();
    const blob = await verifiedBlob(r);
    url = URL.createObjectURL(blob);
    const meta = el("p", { class: "muted small" }, `${r.file_name} · SHA-256 verificado ${String(r.sha256).slice(0, 12)}…`);
    if (String(r.content_type).startsWith("image/")) {
      body.replaceChildren(el("img", { src: url, alt: title, class: "viewer-img" }), meta);
    } else {
      const open = el("button", { class: "link", type: "button", onclick: () => window.open(url, "_blank", "noopener") }, "Abrir en otra pestaña");
      body.replaceChildren(el("iframe", { src: url, title, class: "viewer-frame" }), meta,
        el("p", { class: "muted small" }, "Si tu navegador no muestra el PDF aquí, usa «Abrir en otra pestaña» o «Descargar copia». ", open));
    }
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => saveBlob(blob, r.file_name);
  } catch (err) {
    body.replaceChildren(el("p", { class: "message" }, err?.message || "No se pudo abrir el documento."));
    toast?.(err?.message || "No se pudo abrir el documento.", true);
  }
  return { close };
}

export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
}

export const LEGAL_MAX_BYTES = 6 * 1024 * 1024;
