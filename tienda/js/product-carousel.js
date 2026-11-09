// One lifecycle per page render: timers and listeners are removed on navigation.
export function mountCarousels(root, products, photo) {
  const cleanups = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const viewport of root.querySelectorAll('[data-carousel-product]')) {
    const product = products.find(p => p.id === viewport.dataset.carouselProduct);
    if (!product || product.images.length < 2) continue;
    let index = product.coverIndex, paused = reduced.matches, hovering = false;
    const controls = document.createElement('div');
    controls.className = 'product-carousel-controls';
    controls.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:8px;flex-wrap:wrap';
    controls.innerHTML = '<button type="button" aria-label="Fotografía anterior">‹</button><span></span><button type="button" aria-label="Fotografía siguiente">›</button><button type="button"></button>';
    viewport.after(controls);
    const [previous, next, toggle] = controls.querySelectorAll('button');
    for (const button of [previous,next,toggle]) button.style.cssText = 'min-height:44px;min-width:44px;padding:6px 10px';
    const counter = controls.querySelector('span');
    const thumbnails = viewport.id === 'gallery'
      ? [...root.querySelectorAll('[data-gallery]')].filter(b => b.dataset.gallery === product.id) : [];
    function update() {
      counter.textContent = `${index + 1} / ${product.images.length}`;
      toggle.textContent = paused ? 'Reproducir' : 'Pausar';
      toggle.setAttribute('aria-label', paused ? 'Reproducir fotografías' : 'Pausar fotografías');
      thumbnails.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.index) === index)));
    }
    function show(value) {
      index = (value + product.images.length) % product.images.length;
      viewport.innerHTML = photo(product, index);
      update();
    }
    function listen(target, event, callback) {
      target.addEventListener(event, callback);
      cleanups.push(() => target.removeEventListener(event, callback));
    }
    listen(previous, 'click', () => { paused = true; show(index - 1); });
    listen(next, 'click', () => { paused = true; show(index + 1); });
    listen(toggle, 'click', () => { paused = !paused; update(); });
    for (const thumbnail of thumbnails) listen(thumbnail, 'click', () => {
      paused = true; show(Number(thumbnail.dataset.index));
    });
    for (const area of [viewport, controls]) {
      listen(area, 'mouseenter', () => { hovering = true; });
      listen(area, 'mouseleave', () => { hovering = false; });
    }
    listen(reduced, 'change', () => { if (reduced.matches) { paused = true; update(); } });
    const timer = setInterval(() => {
      if (paused || hovering || document.hidden || viewport.contains(document.activeElement) || controls.contains(document.activeElement)) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) show(index + 1);
    }, 4000);
    update();
    cleanups.push(() => { clearInterval(timer); controls.remove(); });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}
