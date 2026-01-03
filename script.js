/* ============================================================
   SKANO CYBER NEON – JS PRO
   ============================================================ */

/* ------------------------------
   MENÚ RESPONSIVO
------------------------------ */
const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.toggle("open");

    // Glow suave al abrir/cerrar
    navToggle.style.boxShadow = navMenu.classList.contains("open")
      ? "0 0 12px rgba(74, 242, 255, 0.6)"
      : "none";
  });

  navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("open");
      navToggle.style.boxShadow = "none";
    });
  });
}

/* ------------------------------
   REVEAL ANIMATIONS (SCROLL)
------------------------------ */
const revealEls = document.querySelectorAll(".reveal-on-scroll");

// Random delay generator (efecto onda futurista)
function randomDelay(min = 0, max = 120) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Añade un pequeño delay para que las tarjetas aparezcan con efecto ola
          setTimeout(() => {
            entry.target.classList.add("revealed");
          }, randomDelay(20, 180));

          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealEls.forEach(el => observer.observe(el));
} else {
  // Fallback si no hay IntersectionObserver
  revealEls.forEach(el => el.classList.add("revealed"));
}

/* ------------------------------
   FORMULARIO DE CONTACTO
------------------------------ */
const contactForm = document.getElementById("contactForm");
const formNote = document.getElementById("formNote");

if (contactForm && formNote) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    formNote.textContent = "Mensaje enviado correctamente. Un asesor te responderá en minutos.";
    formNote.style.color = "#4af2ff";

    // Efecto de iluminación temporal
    formNote.style.textShadow = "0 0 12px rgba(74,242,255,0.8)";
    setTimeout(() => {
      formNote.style.textShadow = "none";
    }, 1500);

    // Reset visual del formulario sin borrar lo escrito
    contactForm.querySelector("button").style.boxShadow =
      "0 0 20px rgba(74,242,255,0.9)";
    setTimeout(() => {
      contactForm.querySelector("button").style.boxShadow = "none";
    }, 900);
  });
}

/* ------------------------------
   TOQUE PRO: Glow a botones en hover
------------------------------ */
const neonButtons = document.querySelectorAll(".btn, .btn-primary, .btn-ghost");

neonButtons.forEach(btn => {
  btn.addEventListener("mousemove", (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;

    btn.style.setProperty("--hover-x", `${x}px`);
  });
});
/* ================= WHATSAPP FLOAT ================= */

.whatsapp-float {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(135deg, #25D366, #1EBE57);
  color: #ffffff;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  z-index: 9999;
  box-shadow: 0 0 20px rgba(37, 211, 102, 0.8);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.whatsapp-float:hover {
  transform: scale(1.08);
  box-shadow: 0 0 32px rgba(37, 211, 102, 1);
}

