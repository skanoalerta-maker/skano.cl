"use strict";

import { app, auth } from "./store-firebase.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const functions = getFunctions(app, "us-central1");

const create = httpsCallable(functions, "createStoreCategory");
const list = httpsCallable(functions, "listStoreCategories");
const update = httpsCallable(functions, "updateStoreCategory");

const root = document.createElement("section");
root.id = "skano-category-manager";

root.innerHTML = `
  <div class="skano-cat-panel">
    <div class="skano-cat-header">
      <div>
        <span class="skano-cat-label">SKANO STORE · ADMINISTRACION</span>
        <h2>Gestionar categorias</h2>
        <p>Organiza las secciones comerciales de tu tienda.</p>
      </div>
    </div>
    <form id="skano-cat-create">
      <label for="skano-cat-name">Nueva categoria</label>
      <div class="skano-cat-formrow">
        <input id="skano-cat-name" required minlength="3"
          maxlength="70" placeholder="Ej. Alarmas sonoras">
        <button type="submit">Crear categoria</button>
      </div>
    </form>
    <p id="skano-cat-message" role="status"></p>
    <div id="skano-cat-list"></div>
  </div>
`;

const style = document.createElement("style");

style.textContent = `
  #skano-category-manager {
    max-width: 1150px;
    margin: 30px auto;
    padding: 0 20px 60px;
    color: #ecf4ff;
    font-family: inherit;
  }
  .skano-cat-panel {
    background: linear-gradient(140deg,#101a31,#080e1d);
    border: 1px solid #253e66;
    border-radius: 22px;
    padding: 28px;
    box-shadow: 0 14px 42px #0005;
  }
  .skano-cat-label {
    color: #60a5fa;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .skano-cat-header h2 {
    margin: 9px 0;
    color: #fff;
  }
  .skano-cat-header p {
    color: #a9b9d0;
  }
  #skano-cat-create label {
    display: block;
    margin: 22px 0 9px;
    font-weight: 600;
  }
  .skano-cat-formrow,
  .skano-cat-item {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .skano-cat-formrow input,
  .skano-cat-item input {
    flex: 1 1 220px;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid #34517d;
    border-radius: 10px;
    background: #0b1529;
    color: #fff;
  }
  #skano-category-manager button {
    padding: 11px 15px;
    border: 1px solid #3172db;
    border-radius: 10px;
    background: #1265de;
    color: #fff;
    cursor: pointer;
    font-weight: 600;
  }
  #skano-category-manager button:disabled {
    opacity: .5;
    cursor: wait;
  }
  #skano-cat-message { color: #a7cfff; }
  .skano-cat-item {
    padding: 14px 0;
    border-top: 1px solid #263854;
  }
  .skano-cat-status {
    font-size: 12px;
    color: #a7cfff;
  }
`;

function message(text) {
  root.querySelector("#skano-cat-message").textContent = text;
}

function button(label, action) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.addEventListener("click", action);
  return el;
}

async function refresh() {
  message("Cargando categorias...");

  try {
    const result = await list();
    const categories = result.data.categories || [];

    const container = root.querySelector("#skano-cat-list");
    container.replaceChildren();

    if (!categories.length) {
      message("Todavia no hay categorias registradas.");
      return;
    }

    for (const category of categories) {
      const item = document.createElement("div");
      item.className = "skano-cat-item";

      const input = document.createElement("input");
      input.value = category.name;
      input.maxLength = 70;
      input.setAttribute("aria-label", "Nombre de categoria");

      const status = document.createElement("span");
      status.className = "skano-cat-status";
      status.textContent = category.active
        ? "Activa"
        : "Desactivada";

      const save = button("Guardar nombre", async () => {
        save.disabled = true;

        try {
          await update({
            id: category.id,
            name: input.value
          });

          message("Nombre actualizado.");
          await refresh();
        } catch (error) {
          message(error.message);
        } finally {
          save.disabled = false;
        }
      });

      const toggle = button(
        category.active ? "Desactivar" : "Activar",
        async () => {
          toggle.disabled = true;

          try {
            await update({
              id: category.id,
              active: !category.active
            });

            await refresh();
          } catch (error) {
            message(error.message);
          } finally {
            toggle.disabled = false;
          }
        }
      );

      item.append(input, status, save, toggle);
      container.append(item);
    }

    message(`${categories.length} categorias registradas.`);
  } catch (error) {
    message("No se pudieron cargar las categorias: " + error.message);
  }
}

root.querySelector("#skano-cat-create")
  .addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const input = root.querySelector("#skano-cat-name");
    const submit = form.querySelector("button");

    submit.disabled = true;

    try {
      await create({ name: input.value });
      input.value = "";
      await refresh();
    } catch (error) {
      message(error.message);
    } finally {
      submit.disabled = false;
    }
  });

document.head.append(style);
document.getElementById("admin-panel").append(root);

onAuthStateChanged(auth, user => {
  if (user) {
    root.hidden = false;
    refresh();
  } else {
    root.hidden = true;
  }
});