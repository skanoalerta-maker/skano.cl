/* SKANO STORE en la portada: solo muestra productos publicados y disponibles.
   Falla cerrada: si el catálogo no responde o no hay productos, el bloque permanece oculto. */
(function () {
  var section = document.getElementById('skano-store');
  if (!section) return;
  var BASE = 'https://us-central1-skano-store.cloudfunctions.net/';
  var IMG = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/skano-store\.firebasestorage\.app\/o\/[^\s?]+\?alt=media$/;
  var money = function (n) { return '$' + Number(n).toLocaleString('es-CL'); };
  function call(name) {
    var ctrl = new AbortController(), t = setTimeout(function () { ctrl.abort(); }, 8000);
    return fetch(BASE + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}', signal: ctrl.signal, credentials: 'omit' })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (j) { return j && j.result; });
  }
  call('listPublicStoreProducts').then(function (data) {
    if (!data || !Array.isArray(data.products)) return;
    var items = data.products.filter(function (p) {
      return p && typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(p.id) && typeof p.name === 'string' && Number.isSafeInteger(p.price) && p.price > 0 &&
        p.availability !== 'unavailable' && typeof p.imageUrl === 'string' && IMG.test(p.imageUrl);
    }).sort(function (a, b) { return (b.featured === true) - (a.featured === true); }).slice(0, 4);
    if (!items.length) return;
    var live = section.querySelector('[data-store-live]'), list = section.querySelector('[data-store-grid]'); if (!live || !list) return;
    list.textContent = '';
    items.forEach(function (p) {
      var li = document.createElement('li'), a = document.createElement('a'); a.className = 'sk-store-card'; a.href = '/tienda/#/producto/' + encodeURIComponent(p.id);
      var fig = document.createElement('figure'), img = document.createElement('img');
      img.src = p.imageUrl; img.alt = p.name; img.loading = 'lazy'; img.decoding = 'async'; img.width = 400; img.height = 300; img.referrerPolicy = 'no-referrer';
      fig.appendChild(img);
      var d = document.createElement('div'), s = document.createElement('small'), b = document.createElement('b'), pr = document.createElement('span');
      s.textContent = String(p.categoryName || p.brand || 'SKANO Store').slice(0, 40); b.textContent = p.name.slice(0, 90); pr.textContent = money(p.price);
      d.append(s, b, pr); a.append(fig, d); li.appendChild(a); list.appendChild(li);
    });
    live.hidden = false;
    // Solo si el servidor confirma compras habilitadas se reemplaza el aviso de "no habilitadas".
    call('getStoreCheckoutStatus').then(function (st) {
      if (!st || st.enabled !== true) return;
      var note = section.querySelector('[data-store-note]'); if (note) note.lastChild.textContent = 'Compra segura con Mercado Pago.';
      var trust = section.querySelector('[data-store-trust]'); if (trust) trust.hidden = false;
    }).catch(function () {});
  }).catch(function () { /* bloque oculto */ });
})();
