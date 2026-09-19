/* Página comercial: demostraciones estáticas, sin consultas ni escrituras Firebase. */
const header = document.getElementById('header');
const menuButton = document.getElementById('menuButton');
const mainNav = document.getElementById('mainNav');
function setMenu(open) {
  mainNav.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});
window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 10), { passive: true });
document.getElementById('year').textContent = String(new Date().getFullYear());

const form = document.getElementById('neighborhoodForm');
form.querySelector('button[type="submit"]').disabled = false;
const labels = {
  full_name: 'Nombre completo', email: 'Correo', phone: 'Teléfono', region: 'Región',
  comuna: 'Comuna', community_type: 'Tipo de comunidad', community_name: 'Nombre del sector o comunidad',
  estimated_homes: 'Cantidad aproximada de viviendas', vehicle_access_points: 'Accesos vehiculares',
  has_cameras: '¿Cuentan con cámaras?', has_connectivity: '¿Existe internet en los accesos?', message: 'Necesidades de la comunidad'
};
const answers = { yes: 'Sí', no: 'No', unknown: 'No sabemos' };
form.addEventListener('submit', event => {
  event.preventDefault();
  for (const input of form.querySelectorAll('input:not([type="checkbox"]), textarea[name]')) input.value = input.value.trim();
  const phone = form.elements.namedItem('phone');
  phone.setCustomValidity(phone.value.replace(/\D/g, '').length >= 8 ? '' : 'Ingresa un teléfono con al menos 8 dígitos.');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const lines = Object.entries(labels).map(([key, label]) => {
    const raw = String(data.get(key) || '');
    const value = key === 'has_cameras' || key === 'has_connectivity' ? answers[raw] : raw;
    return `${label}: ${value || 'Sin especificar'}`;
  });
  lines.splice(lines.length - 1, 0, `Servicios de interés: ${data.getAll('requested_services').join(', ') || 'Por definir'}`);
  const body = `Hola equipo SKANO,\nQuiero solicitar una evaluación de Mi Barrio Seguro.\n\n${lines.join('\n')}\n`;
  const mailto = `mailto:skano.oficial@gmail.com?subject=${encodeURIComponent('Evaluación Mi Barrio Seguro')}&body=${encodeURIComponent(body)}`;
  document.getElementById('emailPreview').value = body;
  document.getElementById('emailFallback').hidden = false;
  document.getElementById('openEmail').href = mailto;
  document.getElementById('requestStatus').textContent = 'Solicitud preparada. Revisa y envía el correo para completar el envío. No se ha guardado en una base de datos.';
  window.location.href = mailto;
});
form.elements.namedItem('phone').addEventListener('input', event => event.target.setCustomValidity(''));
