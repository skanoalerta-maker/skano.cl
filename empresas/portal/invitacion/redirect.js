// Lleva el token de invitación al portal SIN enviarlo al servidor: viaja
// solo en el fragmento (#), que el navegador no incluye en las solicitudes.
(function () {
  var m = String(location.hash || "").match(/^#t=([A-Za-z0-9_-]{40,60})$/);
  location.replace("/empresas/portal/" + (m ? "#/invitacion/" + m[1] : ""));
})();
