/* SKANO · menú de las páginas informativas (sin dependencias). */
(() => {
  "use strict";
  const button = document.getElementById("sklToggle");
  const menu = document.getElementById("sklMenu");
  if (!button || !menu) return;
  const set = (open) => {
    menu.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  };
  button.addEventListener("click", () => set(!menu.classList.contains("open")));
  menu.addEventListener("click", (event) => { if (event.target.closest("a")) set(false); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") set(false); });
})();
