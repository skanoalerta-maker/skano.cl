"use strict";

import {
  auth,
  storeFunctions
} from "./store-firebase.js";

const panel = document.getElementById("admin-panel");
const products = document.getElementById("products");
const message = document.getElementById("message");

if (!panel || !products || !message) {
  throw new Error("Estructura del administrador no encontrada.");
}

const section = document.createElement("section");
section.className = "panel";
section.innerHTML = `
  <h2>Gestionar producto</h2>
  <p class="muted">
    Utiliza el ID de un borrador registrado en SKANO STORE.
    Los productos publicados no se pueden editar desde este formulario.
  </p>

  <label>ID del producto
    <input id="manage-id" maxlength="128"
      placeholder="ID generado por Firebase" required>
  </label>

  <h3>1. Completar ficha comercial</h3>
  <form id="edit-product">
    <div class="grid">
      <label>Costo proveedor (CLP)
        <input name="cost" type="number" min="0" step="1" required>
      </label>
      <label>Precio venta SKANO (CLP)
        <input name="price" type="number" min="1" step="1" required>
      </label>
    </div>
    <p id="profit-preview" class="notice">
      Ingresa el costo y precio para calcular la rentabilidad.
    </p>
    <label>Descripcion
      <textarea name="description" maxlength="1500" required
        rows="9" spellcheck="true"
        placeholder="Pega aqui la descripcion completa del producto. Puedes incluir parrafos y saltos de linea."></textarea>
<small class="muted">Descripcion comercial - maximo 1500 caracteres</small>
    </label>
    <div class="grid">
      <label>Marca
        <input name="brand" maxlength="120">
      </label>
      <label>Modelo
        <input name="model" maxlength="120">
      </label>
    </div>
    <label>URL HTTPS de la fotografia
      <input name="imageUrl" type="url"
        placeholder="https://..." required>
    </label>
    <button type="submit">Guardar ficha comercial</button>
  </form>

  <h3>2. Verificar fotografia</h3>
  <form id="verify-image">
    <label>Observacion de verificacion
      <input name="note" minlength="10" maxlength="500"
        placeholder="Fotografia revisada y autorizada" required>
    </label>
    <label>
      <input name="confirmed" type="checkbox"
        style="display:inline;width:auto" required>
      Confirmo que revise la fotografia y tengo autorizacion para usarla
    </label>
    <button type="submit">Confirmar fotografia</button>
  </form>

  <h3>3. Verificar disponibilidad</h3>
  <form id="verify-stock">
    <label>Observacion de disponibilidad
      <input name="note" minlength="10" maxlength="500"
        placeholder="Proveedor, fecha y evidencia de stock" required>
    </label>
    <label>
      <input name="confirmed" type="checkbox"
        style="display:inline;width:auto" required>
      Confirmo que verifique el stock con el proveedor
    </label>
    <button type="submit">Confirmar stock</button>
  </form>

  <h3>4. Publicar producto</h3>
  <p class="muted">
    Publicar solamente si la ficha, fotografia y disponibilidad
    fueron verificadas.
  </p>
  <button id="publish-product" type="button">
    Publicar en catalogo
  </button>
  <p id="manage-result" role="status" aria-live="polite"></p>
`;

products.closest("section.panel").before(section);

const idInput = document.getElementById("manage-id");
const result = document.getElementById("manage-result");

function setStoreStatus(type, text) {
  const colors = {
    success: "#35d68a",
    error: "#ff626e",
    loading: "#ffca62"
  };

  const symbols = {
    success: "✔",
    error: "✖",
    loading: "⏳"
  };

  result.style.padding = "13px";
  result.style.borderRadius = "9px";
  result.style.border = "1px solid " + colors[type];
  result.style.color = colors[type];
  result.style.fontWeight = "bold";
  result.textContent = symbols[type] + " " + text;
}

const editForm = document.getElementById("edit-product");
const profitPreview = document.getElementById("profit-preview");

function updateProfitPreview() {
  const costText = editForm.elements.namedItem("cost").value;
  const priceText = editForm.elements.namedItem("price").value;

  if (costText === "" || priceText === "") {
    profitPreview.textContent =
      "Ingresa el costo y el precio para calcular la rentabilidad.";
    return;
  }

  const cost = Number(costText);
  const price = Number(priceText);

  if (
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(price) ||
    cost < 0 ||
    price <= 0
  ) {
    profitPreview.textContent = "Montos no validos.";
    return;
  }

  const profit = price - cost;
  const margin = (profit / price) * 100;

  const money = value =>
    "$" + value.toLocaleString("es-CL");

  profitPreview.textContent =
    "Ganancia bruta: " + money(profit) +
    " | Margen bruto: " +
    margin.toLocaleString("es-CL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + "%";
}

editForm.addEventListener("input", updateProfitPreview);

function productId() {
  const value = idInput.value.trim();

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error("Ingresa un ID de producto valido.");
  }

  return value;
}

async function execute(button, action, successText) {
  if (!auth.currentUser) {
    result.textContent = "Debes iniciar sesion.";
    return;
  }

  button.disabled = true;
  setStoreStatus("loading", "Procesando solicitud...");

  try {
    const response = await action();

    if (response.data?.ok !== true) {
      throw new Error("El servidor no confirmo la operacion.");
    }

    setStoreStatus("success", successText);
  } catch (error) {
    setStoreStatus("error", "Operacion no completada: " +
      (error.message || "Error desconocido"));
  } finally {
    button.disabled = false;
  }
}

document.getElementById("edit-product")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);
    const button = form.querySelector("button");

    await execute(button, () =>
      storeFunctions.update({
        productId: productId(),
        description: String(values.get("description")).trim(),
        brand: String(values.get("brand")).trim(),
        model: String(values.get("model")).trim(),
        imageUrl: String(values.get("imageUrl")).trim(),
        cost: Number(values.get("cost")),
        price: Number(values.get("price"))
      }),
      "Ficha actualizada. Debes repetir las verificaciones."
    );
  });

function attachVerification(formId, type, successText) {
  document.getElementById(formId)
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const values = new FormData(form);
      const button = form.querySelector("button");

      await execute(button, () =>
        storeFunctions.verify({
          productId: productId(),
          verificationType: type,
          confirmed: values.get("confirmed") === "on",
          note: String(values.get("note")).trim()
        }),
        successText
      );
    });
}

attachVerification(
  "verify-image",
  "image",
  "Fotografia confirmada por el servidor."
);

attachVerification(
  "verify-stock",
  "stock",
  "Disponibilidad confirmada por el servidor."
);

document.getElementById("publish-product")
  .addEventListener("click", async (event) => {
    let id;

    try {
      id = productId();
    } catch (error) {
      result.textContent = error.message;
      return;
    }

    if (!confirm(
      "¿Publicar el producto " + id +
      "? Comprueba antes la fotografia y el stock."
    )) {
      return;
    }

    await execute(
      event.currentTarget,
      () => storeFunctions.publish({ productId: id }),
      "Producto publicado. Actualiza el listado."
    );
  });
