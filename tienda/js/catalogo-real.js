"use strict";

import { app } from "./store-firebase.js";

import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const db = getFirestore(app);
const catalogo = document.getElementById("catalogo");
const estado = document.getElementById("estado");

const money = value =>
  "$" + Number(value).toLocaleString("es-CL");

function crearTarjeta(id, data) {
  const producto = document.createElement("article");
  producto.className = "producto";

  if (typeof data.imageUrl === "string") {
    try {
      const url = new URL(data.imageUrl);
      if (url.protocol === "https:") {
        const imagen = document.createElement("img");
        imagen.src = url.href;
        imagen.alt = String(data.name || "Camara de seguridad");
        imagen.loading = "lazy";
        imagen.className = "foto";
        producto.append(imagen);
      }
    } catch {
      // No mostrar URL de imagen invalida.
    }
  }

  const info = document.createElement("div");
  info.className = "info";

  const nombre = document.createElement("h2");
  nombre.textContent = String(data.name || "Producto");

  const descripcion = document.createElement("p");
  descripcion.textContent = String(data.description || "");

  const precio = document.createElement("p");
  precio.className = "precio";
  precio.textContent = money(data.price);

  const boton = document.createElement("button");
  boton.textContent = "Compra no habilitada";
  boton.disabled = true;

  info.append(nombre, descripcion, precio, boton);
  producto.append(info);

  return producto;
}

async function cargarCatalogo() {
  try {
    const consulta = query(
      collection(db, "store_public_products"),
      where("publicationStatus", "==", "published"),
      limit(24)
    );

    const resultado = await Promise.race([
      getDocs(consulta),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Tiempo de consulta agotado (15 segundos)")),
          15000
        )
      )
    ]);
    catalogo.replaceChildren();

    for (const doc of resultado.docs) {
      const data = doc.data();

      if (
        data.publicationStatus !== "published" ||
        !Number.isSafeInteger(data.price) ||
        data.price <= 0
      ) {
        continue;
      }

      catalogo.append(crearTarjeta(doc.id, data));
    }

    estado.textContent = catalogo.children.length
      ? `${catalogo.children.length} productos publicados`
      : "Todavia no hay productos reales publicados.";

  } catch (error) {
    console.error("Error de catalogo SKANO:", error.code || error.message);

    estado.textContent =
      "No se pudo consultar el catalogo: " +
      (error.code || "Error desconocido");
  }
}

cargarCatalogo();
