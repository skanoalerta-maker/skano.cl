// Checkout y seguimiento de SKANO Store. Solo se monta cuando el servidor indica compras habilitadas.
import {escapeHTML as esc, money} from './core.js';
import {api, auth, STATUS_LABEL} from './orders-client.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const box = (title, body) => `<div class="heading"><span class="eyebrow">SKANO STORE</span><h1>${esc(title)}</h1></div>${body}`;
const err = e => esc(e?.message?.replace(/^.*?:\s*/, '') || 'No pudimos completar la operación. Intenta nuevamente.');
function requestId(payload) {
  const sig = JSON.stringify(payload);
  try {
    const saved = JSON.parse(sessionStorage.getItem('skano-checkout-req') || 'null');
    if (saved?.sig === sig) return saved.id;
    const id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').padEnd(24, 'x').slice(0, 40);
    sessionStorage.setItem('skano-checkout-req', JSON.stringify({sig, id}));
    return id;
  } catch { return (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)).replace(/-/g, '').padEnd(24, 'x').slice(0, 40); }
}
const field = (label, name, attrs = '') => `<label>${esc(label)}<input name="${name}" ${attrs}></label>`;

export async function mountCheckout(root, ctx) {
  const {products, cart, status} = ctx;
  if (!status?.enabled) { root.innerHTML = box('Compra no habilitada', '<div class="panel"><p>Las compras en línea aún no están habilitadas. Puedes explorar el catálogo y guardar tu selección.</p><a class="button" href="#/catalogo">Volver al catálogo</a></div>'); return; }
  if (!cart.length) { root.innerHTML = box('Tu bolsa está vacía', '<div class="panel"><a class="button" href="#/catalogo">Explorar catálogo</a></div>'); return; }
  const user = await new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
  if (!user) { root.innerHTML = box('Inicia sesión para comprar', '<div class="panel"><p>Necesitamos tu cuenta para asociar el pedido y enviarte la confirmación.</p><a class="button" href="#/cuenta">Ingresar o crear cuenta</a></div>'); return; }
  const coverage = status.coverage || {delivery: [], pickup: null};
  const regions = coverage.delivery.map(c => c.region);
  root.innerHTML = box('Finalizar compra', `
  <form id="sk-checkout-form" class="sk-checkout two-col" novalidate>
   <div>
    <section class="panel"><h2>Tus datos</h2>
     ${field('Nombre completo', 'name', 'required autocomplete="name" maxlength="120"')}
     ${field('RUT', 'rut', 'required autocomplete="off" placeholder="12.345.678-5" maxlength="12"')}
     ${field('Teléfono', 'phone', 'required autocomplete="tel" maxlength="20" placeholder="+56 9 1234 5678"')}
     <p class="muted">Correo de la compra: ${esc(user.email || '')}</p></section>
    <section class="panel"><h2>Entrega</h2>
     ${coverage.pickup ? `<label>Método<select name="method"><option value="delivery">Despacho a domicilio</option><option value="pickup">${esc(coverage.pickup)}</option></select></label>` : '<input type="hidden" name="method" value="delivery">'}
     <div data-delivery>
      <label>Región<select name="region" required>${regions.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
      <label>Comuna<input name="commune" required maxlength="100" list="sk-communes" autocomplete="address-level2"></label><datalist id="sk-communes"></datalist>
      ${field('Dirección', 'address', 'required autocomplete="street-address" maxlength="200"')}
      ${field('Depto / referencia (opcional)', 'addressDetail', 'maxlength="200"')}
     </div></section>
    <section class="panel"><h2>Documento</h2>
     <label>Tipo<select name="docType"><option value="boleta">Boleta</option><option value="factura">Factura</option></select></label>
     <div data-company hidden>${field('RUT empresa', 'companyRut', 'maxlength="12"')}${field('Razón social', 'companyName', 'maxlength="150"')}${field('Giro', 'companyActivity', 'maxlength="150"')}${field('Dirección comercial', 'companyAddress', 'maxlength="200"')}</div>
     <p class="muted">El documento tributario se emite a través de un emisor autorizado después del pago.</p></section>
   </div>
   <aside class="panel summary" aria-live="polite"><h2>Resumen</h2><div id="sk-quote"><p class="muted">Completa la entrega y calcula el total final.</p></div>
    <p id="sk-msg" role="alert" class="notice" hidden></p>
    <button class="button" type="button" id="sk-quote-btn">Calcular total</button>
    <button class="button" type="submit" id="sk-pay-btn" hidden>Pagar con Mercado Pago</button>
    <p class="muted">Pagas en el sitio seguro de Mercado Pago. SKANO no guarda datos de tarjeta.</p></aside>
  </form>`);
  const form = root.querySelector('#sk-checkout-form'), msg = root.querySelector('#sk-msg'), quoteBox = root.querySelector('#sk-quote');
  const payBtn = root.querySelector('#sk-pay-btn'), quoteBtn = root.querySelector('#sk-quote-btn');
  const v = n => (form.elements[n]?.value || '').trim();
  const show = t => { msg.hidden = !t; msg.innerHTML = t || ''; };
  const syncCommunes = () => { const c = coverage.delivery.find(x => x.region === v('region')); form.querySelector('#sk-communes').innerHTML = (c?.communes || []).map(x => `<option value="${esc(x)}">`).join(''); };
  const lines = () => cart.map(l => ({productId: l.id, qty: l.qty}));
  const reset = () => { payBtn.hidden = true; quoteBox.innerHTML = '<p class="muted">Datos modificados: vuelve a calcular el total.</p>'; };
  form.addEventListener('input', e => { if (e.target.name === 'region') syncCommunes(); if (e.target.name === 'docType') form.querySelector('[data-company]').hidden = v('docType') !== 'factura'; if (e.target.name === 'method') form.querySelector('[data-delivery]').hidden = v('method') === 'pickup'; reset(); });
  syncCommunes();
  const payload = () => ({
    lines: lines(), method: v('method') === 'pickup' ? 'pickup' : 'delivery',
    customer: {name: v('name'), rut: v('rut'), phone: v('phone')},
    delivery: {region: v('region'), commune: v('commune'), address: v('address'), addressDetail: v('addressDetail')},
    document: v('docType') === 'factura' ? {type: 'factura', company: {rut: v('companyRut'), name: v('companyName'), activity: v('companyActivity'), address: v('companyAddress')}} : {type: 'boleta'}
  });
  quoteBtn.addEventListener('click', async () => {
    show(''); quoteBtn.disabled = true;
    try {
      const p = payload();
      const r = (await api.quote({lines: p.lines, method: p.method, region: p.delivery.region, commune: p.delivery.commune})).data;
      quoteBox.innerHTML = `${r.lines.map(l => `<p>${esc(l.name)} × ${l.qty} <b>${money(l.lineTotal)}</b></p>`).join('')}<hr><p>Subtotal <b>${money(r.subtotal)}</b></p><p>${esc(r.shipping.label)}${r.shipping.etaDays ? ` (${esc(r.shipping.etaDays)} días)` : ''} <b>${money(r.shipping.price)}</b></p><p>Total a pagar <b>${money(r.total)}</b></p>`;
      payBtn.hidden = false;
    } catch (e) { show(err(e)); }
    quoteBtn.disabled = false;
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (payBtn.disabled) return; show(''); payBtn.disabled = true; payBtn.textContent = 'Creando pedido…';
    try {
      const p = payload();
      const r = (await api.create({...p, clientRequestId: requestId(p)})).data;
      if (!r.initPoint || !/^https:\/\/[^\s]+$/.test(r.initPoint)) throw new Error('No se recibió el enlace de pago.');
      location.assign(r.initPoint);
    } catch (e2) { show(err(e2)); payBtn.disabled = false; payBtn.textContent = 'Pagar con Mercado Pago'; }
  });
}

// Seguimiento: nunca confirma pagos; solo muestra lo que el servidor registró.
export async function mountTracking(root, orderId) {
  const user = await new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
  if (!user) { root.innerHTML = box('Seguimiento de pedido', '<div class="panel"><p>Inicia sesión para ver tu pedido.</p><a class="button" href="#/cuenta">Ingresar</a></div>'); return; }
  if (!orderId) { root.innerHTML = box('Mis pedidos', '<div class="panel" id="sk-orders">Cargando…</div>'); try { const {orders} = (await api.myOrders()).data; root.querySelector('#sk-orders').innerHTML = orders.length ? orders.map(o => `<p><a href="#/pedido/${esc(o.orderId)}">${esc(o.orderNumber)}</a> · ${esc(STATUS_LABEL[o.status] || o.status)} · ${money(o.total)}</p>`).join('') : '<p>Aún no tienes pedidos.</p>'; } catch (e) { root.querySelector('#sk-orders').innerHTML = err(e); } return; }
  let tries = 0, timer = null;
  const draw = async () => {
    if (!root.isConnected || !root.querySelector('#sk-order')) return;
    try {
      const o = (await api.getOrder({orderId})).data.order;
      const waiting = o.status === 'pending_payment' && tries < 30;
      root.querySelector('#sk-order').innerHTML = `<h2>Pedido ${esc(o.orderNumber)}</h2><p class="status-pill">${esc(STATUS_LABEL[o.status] || o.status)}</p>
       ${waiting ? '<p class="notice" role="status">Estamos confirmando tu pago con Mercado Pago. Esta página se actualizará sola.</p>' : ''}
       ${o.status === 'payment_review' ? '<p class="notice">Tu pago está en revisión. Te contactaremos a la brevedad.</p>' : ''}
       ${o.lines.map(l => `<p>${esc(l.name)} × ${l.qty} <b>${money(l.lineTotal)}</b></p>`).join('')}<p>Despacho <b>${money(o.shipping.price)}</b></p><p>Total <b>${money(o.total)}</b></p>
       ${o.tracking ? `<p>Transporte: ${esc(o.tracking.carrier)} · Seguimiento: <b>${esc(o.tracking.code)}</b></p>` : ''}
       <a class="button light" href="#/catalogo">Seguir comprando</a>`;
      if (waiting) { tries++; timer = setTimeout(draw, 4000); }
    } catch { root.querySelector('#sk-order').innerHTML = '<p role="alert">No encontramos este pedido en tu cuenta.</p>'; }
  };
  root.innerHTML = box('Seguimiento de pedido', '<div class="panel" id="sk-order">Consultando…</div>');
  window.addEventListener('hashchange', () => clearTimeout(timer), {once: true});
  draw();
}
