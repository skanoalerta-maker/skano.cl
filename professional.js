const header=document.getElementById('header');
const menuButton=document.getElementById('menuButton');
const mainNav=document.getElementById('mainNav');
window.addEventListener('scroll',()=>header?.classList.toggle('scrolled',window.scrollY>10),{passive:true});
menuButton?.addEventListener('click',()=>{const open=mainNav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú')});
mainNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{mainNav.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){mainNav?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}});
document.getElementById('year').textContent=String(new Date().getFullYear());
const form=document.getElementById('contactForm');
form?.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);const subject=encodeURIComponent('Contacto corporativo desde skano.cl');const body=encodeURIComponent(`Nombre: ${data.get('name')}\nCorreo: ${data.get('email')}\n\nMensaje:\n${data.get('message')}`);document.getElementById('formStatus').textContent='Abriendo tu aplicación de correo para completar el envío…';window.location.href=`mailto:skano.oficial@gmail.com?subject=${subject}&body=${body}`});

/* Para agregar o quitar lecturas, edita únicamente esta lista. */
const skanoReadings=[
  {src:'/assets/lecturas-skano/lectura-01.jpg',alt:'Demostración visual de tecnología SKANO',label:'LECTURA SKANO'},
  {src:'/assets/lecturas-skano/lectura-02.jpg',alt:'Tecnología SKANO aplicada a seguridad vehicular',label:'DETECCIÓN REAL'},
  {src:'/assets/lecturas-skano/lectura-03.jpg',alt:'Operación de tecnología SKANO en terreno',label:'TECNOLOGÍA EN TERRENO'},
  {src:'/assets/lecturas-skano/lectura-04.jpg',alt:'Demostración del sistema vehicular SKANO',label:'LECTURA SKANO'},
  {src:'/assets/lecturas-skano/lectura-05.jpg',alt:'Tecnología de detección de SKANO',label:'TECNOLOGÍA EN TERRENO'}
];
const readingsTrack=document.getElementById('readingsTrack');
if(readingsTrack&&skanoReadings.length){
  const renderReading=(reading,isClone=false)=>{const figure=document.createElement('figure');figure.className='reading-card';if(isClone)figure.setAttribute('aria-hidden','true');const image=document.createElement('img');image.src=reading.src;image.alt=isClone?'':reading.alt;image.loading='lazy';image.decoding='async';image.width=1200;image.height=750;const label=document.createElement('figcaption');label.className='reading-label';label.textContent=reading.label;figure.append(image,label);return figure};
  const fragment=document.createDocumentFragment();
  skanoReadings.forEach(reading=>fragment.append(renderReading(reading)));
  skanoReadings.forEach(reading=>fragment.append(renderReading(reading,true)));
  readingsTrack.append(fragment);
  readingsTrack.style.setProperty('--speed',`${Math.max(34,skanoReadings.length*7)}s`);
}

const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(element=>revealObserver.observe(element));

/* Recupera los iconos vectoriales originales de la comunidad SKANO. */
const officialSocialIcons={
  tiktok:'<svg viewBox="0 0 24 24"><path d="M16.6 5.1c.8.9 1.8 1.5 3 1.7v3.1c-1.4-.1-2.7-.5-3.9-1.3v6.2c0 3-2.4 5.4-5.4 5.4s-5.4-2.4-5.4-5.4 2.4-5.4 5.4-5.4c.4 0 .8 0 1.1.1v3.3c-.3-.1-.7-.2-1.1-.2-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2V3.8h3c.2.5.5.9 1.1 1.3z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24"><path d="M14.2 8.2V6.7c0-.7.5-.9.9-.9h2.2V2.2L14.2 2c-3.4 0-4.2 2.1-4.2 4.3v1.9H7.3V12H10v10h4.1V12h3.1l.5-3.8h-3.5z"/></svg>',
  group:'<svg viewBox="0 0 24 24"><path d="M8.8 11.2a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm6.6.4a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.8 13.1c-3.1 0-5.8 1.6-5.8 3.7V20h11.6v-3.2c0-2.1-2.7-3.7-5.8-3.7zm6.6.4c-.5 0-1 .1-1.5.2 1.4.9 2.3 2 2.3 3.3V20H21v-2.8c0-2-2.5-3.7-5.6-3.7z"/></svg>',
  youtube:'<svg viewBox="0 0 24 24"><path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4s-3.8 0-6.7.2c-.4.1-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.8v1.7c0 1.8.2 3.6.2 3.6s.2 1.5.8 2.1c.8.8 1.9.8 2.4.9 1.8.2 6.4.2 6.4.2s3.8 0 6.7-.2c.4-.1 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.8.2-3.6v-1.7c0-1.8-.2-3.6-.2-3.6zM10.1 14.8V8.6l5.9 3.1-5.9 3.1z"/></svg>',
  twitch:'<svg viewBox="0 0 24 24"><path d="M4.2 3 3 6.1v13.1h4.5V21h2.6l1.8-1.8h3.5L21 13.6V3H4.2zm14.6 9.6-3.2 3.2h-4.1l-1.8 1.8v-1.8H6.1V5.2h12.7v7.4zM15.6 8h1.8v5.1h-1.8V8zm-4.6 0h1.8v5.1H11V8z"/></svg>',
  whats:'<svg viewBox="0 0 24 24"><path d="M12 2.2A9.7 9.7 0 0 0 3.8 17l-1 4.8 4.9-1A9.7 9.7 0 1 0 12 2.2zm0 17.6c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-2.9.6.6-2.8-.2-.3A7.8 7.8 0 1 1 12 19.8zm4.4-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.1 1.6.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.2-.3-.2-.5-.3z"/></svg>'
};
Object.entries(officialSocialIcons).forEach(([network,icon])=>{const target=document.querySelector(`.social-grid .${network} .social-icon`);if(target)target.innerHTML=icon});
const portalIcons=[['.web-panel .portal-main:nth-of-type(1) .portal-icon','🔐'],['.web-panel .portal-download span','📱'],['.web-panel .portal-soon span','🍎']];
portalIcons.forEach(([selector,icon])=>{const target=document.querySelector(selector);if(target)target.textContent=icon});

/* Escena vial en movimiento. */
const ecosystemSection=document.querySelector('.ecosystem');
if(ecosystemSection){
  const trafficSection=document.createElement('section');
  trafficSection.className='traffic-network';
  trafficSection.setAttribute('aria-labelledby','traffic-title');
  trafficSection.innerHTML=`<div class="traffic-glow"></div><div class="shell traffic-layout"><div class="traffic-copy reveal visible"><span class="eyebrow cyan">ECOSISTEMA EN MOVIMIENTO</span><h2 id="traffic-title">UNA RED QUE<br><em>NO SE DETIENE</em></h2><p>Vehículos, tecnología y colaboración avanzando al mismo tiempo. Una representación visual de la visión conectada de SKANO.</p><div class="traffic-status"><i></i><span>FLUJO VEHICULAR ACTIVO</span></div></div><div class="traffic-scene" aria-hidden="true"><div class="road road-a"><div class="lane lane-forward"><i style="--delay:-2s;--speed:10s;--car:#21d8ed"></i><i style="--delay:-6s;--speed:12s;--car:#fff"></i><i style="--delay:-10s;--speed:14s;--car:#1689ff"></i></div><div class="lane lane-reverse"><i style="--delay:-1s;--speed:13s;--car:#ffcf54"></i><i style="--delay:-7s;--speed:11s;--car:#fff"></i><i style="--delay:-9s;--speed:15s;--car:#29d8ed"></i></div></div><div class="road road-b"><div class="lane lane-forward"><i style="--delay:-3s;--speed:13s;--car:#fff"></i><i style="--delay:-8s;--speed:10s;--car:#21d8ed"></i><i style="--delay:-11s;--speed:16s;--car:#1689ff"></i></div><div class="lane lane-reverse"><i style="--delay:-4s;--speed:12s;--car:#ffcf54"></i><i style="--delay:-9s;--speed:14s;--car:#fff"></i><i style="--delay:-12s;--speed:11s;--car:#29d8ed"></i></div></div><div class="traffic-core"><img src="/img/skano-logo.png" alt=""><span>SKANO</span><small>RED CONECTADA</small></div><span class="signal signal-a"></span><span class="signal signal-b"></span><span class="signal signal-c"></span></div></div>`;
  ecosystemSection.insertAdjacentElement('afterend',trafficSection);
}
