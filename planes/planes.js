(function(){if(document.body.classList.contains('sk-plans')){initIndividualPlans();return;}const premiumStyles=document.createElement('link');premiumStyles.rel='stylesheet';premiumStyles.href='/planes/premium.css';document.head.append(premiumStyles);
const clp=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const privacyMark=document.querySelector('.privacy>b');if(privacyMark){const logo=document.createElement('img');logo.src='/img/skano-logo.png';logo.alt='Logo SKANO';logo.width=44;logo.height=44;logo.style.cssText='width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 0 10px rgba(34,217,238,.28))';privacyMark.replaceChildren(logo)}
if(!reduced)document.body.animate([{opacity:.94},{opacity:1}],{duration:180,easing:'ease-out'});
document.documentElement.classList.add('motion-ready');
const header=document.querySelector('.top');addEventListener('scroll',()=>header?.classList.toggle('scrolled',scrollY>12),{passive:true});
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add('in-view');observer.unobserve(entry.target)}),{threshold:.12});
document.querySelectorAll('.section-title,.card,.tiers article,.calculator>div,.benefits>div,.company-form>div,.company-form form,.privacy>* ,.stats article,.fleet-list').forEach((el,i)=>{el.classList.add('motion-item');el.style.setProperty('--delay',`${Math.min(i%4,3)*70}ms`);observer.observe(el)});
const rows=['Registro completo del vehículo','PPU + VIN + chasis','Ingreso a base SKANO','Detectable por lectores SKANO','Publicación web pública','Recompensa','Alertas al propietario','Correos por detección','Historial de detecciones','Información de recuperación','Información de comisaría','Seguimiento activo'];
const body=document.querySelector('#comparison');if(body)body.innerHTML=rows.map((x,i)=>`<tr><td>${x}</td><td>${i<4?'✓':'—'}</td><td>✓</td><td>✓</td></tr>`).join('');
const animateValue=(el,to)=>{if(reduced){el.textContent=clp(to);return}const from=Number(el.dataset.value)||0,start=performance.now(),duration=320;el.dataset.value=to;const tick=now=>{const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,3);el.textContent=clp(Math.round(from+(to-from)*ease));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)};
document.querySelectorAll('.price b').forEach(el=>{const value=Number(el.textContent.replace(/\D/g,''));if(!value)return;const o=new IntersectionObserver(es=>{if(es[0].isIntersecting){const original=el.textContent;el.textContent='$0';let start=performance.now();const tick=now=>{const p=Math.min(1,(now-start)/650);el.textContent='$'+Math.round(value*(1-Math.pow(1-p,3))).toLocaleString('es-CL');if(p<1&&!reduced)requestAnimationFrame(tick);else el.textContent=original};tick(start);o.disconnect()}},{threshold:.7});o.observe(el)});
const input=document.querySelector('#fleetCount');if(input){let lastTier='';const render=()=>{const n=Math.max(1,Number(input.value)||1);input.value=n;const t=n>=20?['20 o más vehículos',10990,'business_20_plus']:n>=6?['6 a 19 vehículos',13000,'business_6_19']:['1 a 5 vehículos',16990,'business_1_5'];const result=document.querySelector('.result');if(lastTier&&lastTier!==t[2]){result.classList.remove('tier-changed');void result.offsetWidth;result.classList.add('tier-changed')}lastTier=t[2];document.querySelector('#tierName').textContent=t[0];document.querySelector('#qty').textContent=n;document.querySelector('#unitPrice').textContent=clp(t[1]);animateValue(document.querySelector('#total'),n*t[1]);document.querySelector('#businessCheckout').href=`/checkout/?checkoutType=business&vehicleCount=${n}&pricePerVehicle=${t[1]}&monthlyTotal=${n*t[1]}&planTier=${t[2]}`};input.addEventListener('input',render);document.querySelector('#minus').onclick=()=>{input.value=Math.max(1,+input.value-1);render()};document.querySelector('#plus').onclick=()=>{input.value=+input.value+1;render()};render()}
const searchButton=document.querySelector('.vehicle-search button');searchButton?.addEventListener('click',()=>{const form=searchButton.closest('form');form.classList.remove('scanning');void form.offsetWidth;form.classList.add('scanning');searchButton.textContent='ESCANEANDO';setTimeout(()=>{searchButton.textContent='BUSCAR';form.classList.remove('scanning')},reduced?50:900)});
const out=document.querySelector('#checkoutSummary');if(out){const q=new URLSearchParams(location.search);const business=q.get('checkoutType')==='business';document.querySelector('#checkoutType').textContent=`checkoutType = ${business?'business':'individual'}`;if(business)out.innerHTML=`<dl><div><dt>Plan</dt><dd>${q.get('planTier')}</dd></div><div><dt>Vehículos</dt><dd>${q.get('vehicleCount')}</dd></div><div><dt>Precio por vehículo</dt><dd>${clp(+q.get('pricePerVehicle'))}</dd></div><div><dt>Total mensual</dt><dd>${clp(+q.get('monthlyTotal'))}</dd></div></dl>`}
})();

// Only the individual plans page uses this branch. Shared legacy routes remain unchanged.
function initIndividualPlans() {
  'use strict';
  const plans = Object.freeze({
    unique: { name: 'Búsqueda Única SKANO', amount: '$200.000', message: 'Hola, equipo SKANO. Quiero contratar el Plan Búsqueda Única por $200.000. Ya realicé o realizaré la transferencia bancaria a J-DECH Comercializadora SpA. Deseo enviar mi comprobante y los antecedentes del vehículo para validar mi contratación.' },
    annual: { name: 'Protección Anual', amount: '$120.000', message: 'Hola, equipo SKANO. Quiero contratar el Plan Protección Anual por $120.000. Ya realicé o realizaré la transferencia bancaria a J-DECH Comercializadora SpA. Deseo enviar mi comprobante y los antecedentes del vehículo para activar los 12 meses de protección.' }
  });
  const select = document.querySelector('#sk-plan');
  const copyButton = document.querySelector('#sk-copy');
  const status = document.querySelector('#sk-copy-status');
  const fallback = document.querySelector('#sk-copy-fallback');
  const copyText = document.querySelector('#sk-copy-text');
  const whatsapp = message => 'https://wa.me/56954486171?text=' + encodeURIComponent(message);
  const getPlan = () => plans[select.value] || plans.unique;
  const bankText = () => {
    const plan = getPlan();
    return ['Plan: ' + plan.name, 'Monto: ' + plan.amount + ' CLP',
      'Razón social: J-DECH COMERCIALIZADORA SpA', 'RUT: 77.905.422-5',
      'Banco: Banco de Chile', 'Tipo de cuenta: Cuenta Corriente',
      'Número de cuenta: 2231118702', 'Correo: jdechcomercializadora@gmail.com',
      'Datos preliminares: confirmar con SKANO antes de transferir.',
      'Activación exclusivamente por validación administrativa.'
    ].join('\n');
  };
  const render = () => {
    const plan = getPlan();
    document.querySelector('#sk-selected-name').textContent = plan.name;
    document.querySelector('#sk-amount').textContent = plan.amount + ' CLP';
    document.querySelector('#sk-whatsapp').href = whatsapp(plan.message);
    document.querySelector('#sk-confirm').href = whatsapp('Hola, equipo SKANO. Me interesa ' + plan.name + ' por ' + plan.amount + ' CLP. Antes de transferir, necesito confirmar los datos bancarios, las condiciones aprobadas, la admisión y ' + (select.value === 'unique' ? 'el cupo de lanzamiento.' : 'la activación de los 12 meses.'));
    status.textContent = '';
    fallback.hidden = true;
    copyText.value = bankText();
  };
  select.addEventListener('change', render);
  document.querySelectorAll('.sk-select').forEach(link => link.addEventListener('click', () => {
    if (!Object.prototype.hasOwnProperty.call(plans, link.dataset.plan)) return;
    select.value = link.dataset.plan;
    render();
    document.querySelector('#transfer-title').focus({ preventScroll: true });
  }));
  copyButton.addEventListener('click', async () => {
    // Snapshot the selected plan so feedback remains truthful if selection changes during permission handling.
    const value = bankText();
    const name = getPlan().name;
    copyButton.disabled = true;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      status.textContent = 'Datos de ' + name + ' copiados. Confírmalos con SKANO antes de transferir.';
    } catch {
      fallback.hidden = false;
      copyText.value = value;
      copyText.focus();
      copyText.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual selection remains available. */ }
      status.textContent = copied ? 'Datos de ' + name + ' copiados. Confírmalos con SKANO antes de transferir.' : 'No fue posible copiar automáticamente. El texto está seleccionado: usa la opción Copiar de tu dispositivo.';
      if (copied) { fallback.hidden = true; copyButton.focus(); }
    } finally { copyButton.disabled = false; }
  });
  const rows = [
    ['Precio en CLP', '$0', '$6.990/mes por 6 meses; luego $16.990/mes', '$120.000', '$200.000 lanzamiento; lista propuesta $299.000'],
    ['Duración', 'Mientras el caso esté activo', 'Mensual', '12 meses desde activación', 'Hasta recuperación, con encargo vigente'],
    ['Registro y asociación al propietario', 'Incluido en la modalidad', 'Todo Free', 'Todo Free', 'Registro y gestión; validación de antecedentes'],
    ['Ingreso y detección', 'Al reportarlo; según lectores disponibles', 'Según disponibilidad y protocolo', 'Según disponibilidad y protocolo', 'Funciones de búsqueda y detección disponibles'],
    ['Alertas y correos', 'No incluye premium', 'Sujetos a confirmación operativa', 'Sujetos a confirmación operativa', 'No se comprometen como beneficio independiente'],
    ['Fecha, hora y ubicación', 'No incluye premium', 'Según protocolo y disponibilidad', 'Según protocolo y disponibilidad', 'Según alcance confirmado por SKANO'],
    ['Seguimiento e historial', 'No incluye premium', 'Sujetos a confirmación operativa', 'Sujetos a confirmación operativa', 'No se promete seguimiento premium'],
    ['Publicación web', 'No incluye publicación premium', 'Sin datos personales; por confirmar', 'Sin datos personales; por confirmar', 'Según alcance aprobado; datos protegidos'],
    ['Información de recuperación', 'No incluye premium', 'Según protocolo', 'Según protocolo', 'Según gestión y protocolo del caso'],
    ['Recompensa al reportante', 'No incluye', 'Según reglas vigentes', 'Según reglas vigentes', 'Si SKANO contribuye y se cumple el protocolo'],
    ['Devolución especial de $50.000', 'No contemplada', 'No contemplada', 'No contemplada', 'Recuperación externa; verificación y condiciones pendientes'],
    ['Forma de contratación', 'Flujo de registro existente', 'Checkout de demostración, sin cobro', 'Transferencia + WhatsApp; revisión previa', 'Transferencia + WhatsApp; confirmar cupo'],
    ['Activación automática desde esta página', 'No', 'No', 'No: personal autorizado', 'No: personal autorizado']
  ];
  const body = document.querySelector('#comparison');
  rows.forEach(values => {
    const row = document.createElement('tr');
    values.forEach((value, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  render();
}
