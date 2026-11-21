/* SKANO · Menú «Plataformas» (página principal). Sin dependencias. */
(() => {
  "use strict";
  const toggle = document.getElementById("platformsToggle");
  const menu = document.getElementById("platformsMenu");
  const nav = document.getElementById("mainNav");
  const menuButton = document.getElementById("menuButton");
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== toggle) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Al elegir un destino, cerrar el submenú y (en celular) el menú principal.
  nav?.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    setOpen(false);
    if (nav.classList.contains("open")) {
      nav.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
      menuButton?.setAttribute("aria-label", "Abrir menú");
    }
  });
})();
