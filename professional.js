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

/* Mantiene los fondos de video en reproducción continua. */
const keepVideoPlaying=video=>{
  video.loop=true;
  video.muted=true;
  video.defaultMuted=true;
  video.playsInline=true;
  video.autoplay=true;
  const resume=()=>{if(video.paused)video.play().catch(()=>{})};
  video.addEventListener('ended',()=>{video.currentTime=0;resume()});
  video.addEventListener('pause',()=>{if(!document.hidden)resume()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});
  resume();
};

const addBackgroundVideo=(section,src,className)=>{
  if(!section)return;
  const video=document.createElement('video');
  video.className=`section-video ${className}`;
  video.src=src;
  video.preload='metadata';
  video.setAttribute('aria-hidden','true');
  section.prepend(video);
  keepVideoPlaying(video);
};

const trafficSection=document.querySelector('.traffic-network');
const originSection=document.querySelector('.origin');
if(trafficSection&&originSection)originSection.after(trafficSection);
addBackgroundVideo(trafficSection,'/assets/videos/red-skano.mp4','traffic-video');
addBackgroundVideo(document.querySelector('.contact'),'/assets/videos/contacto-skano.mp4','contact-video');
document.querySelectorAll('video:not(.section-video)').forEach(keepVideoPlaying);

const contactTitle=document.querySelector('.contact-copy h2');
if(contactTitle)contactTitle.textContent='CONTÁCTANOS AQUÍ.';
const contactHeading=document.querySelector('.contact-heading');
const contactGrid=document.querySelector('.contact-grid');
if(contactHeading&&contactGrid)contactHeading.after(contactGrid);

const videoStyles=document.createElement('style');
videoStyles.textContent=`
  html,body{width:100%;max-width:100%;overflow-x:clip;background:#06182e}
  .story{background:#fff}
  .traffic-network,.contact{position:relative;background:#06182e;overflow:hidden}
  .section-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none}
  .traffic-network:before{z-index:1;background:linear-gradient(90deg,rgba(3,17,36,.78),rgba(4,31,61,.28))}
  .traffic-network .traffic-glow{display:none}.traffic-network .traffic-layout{z-index:2;grid-template-columns:1fr}.traffic-network .traffic-scene{display:none}
  .contact-backdrop{z-index:1;background:linear-gradient(rgba(3,15,34,.46),rgba(3,17,38,.62));opacity:1}.contact>.shell{z-index:2}
  .contact .contact-grid{background:rgba(5,20,45,.38);border:1px solid rgba(70,205,235,.25);color:#fff}
  .contact form{background:rgba(5,20,45,.52);border:1px solid rgba(70,205,235,.25);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff}
  .contact input,.contact textarea{color:#fff;border-bottom-color:rgba(255,255,255,.3)}
`;
document.head.append(videoStyles);

/* Galería protegida de vehículos detectados, inmediatamente bajo el hero. */
const terrainImages=Array.from({length:8},(_,index)=>`/assets/images/terreno/skano-terreno-${String(index+1).padStart(2,'0')}.webp`);
const terrainGallery=document.createElement('section');
terrainGallery.className='terrain-gallery';
terrainGallery.setAttribute('aria-labelledby','terrain-title');
terrainGallery.innerHTML=`<div class="shell terrain-heading"><span class="eyebrow cyan">OPERACIÓN EN TERRENO</span><h2 id="terrain-title">VEHÍCULOS EN MOVIMIENTO<br><em>DETECTADOS POR SKANO</em></h2><p class="terrain-review">Estas imágenes fueron captadas mediante el lector de patentes de SKANO y procesadas utilizando sus bases de datos, protocolos operativos y sistemas de detección vehicular.</p><p class="terrain-privacy">Patentes pixeladas para proteger la información de los vehículos registrados.</p></div><div class="terrain-viewport"><div class="terrain-track"></div></div>`;
const terrainTrack=terrainGallery.querySelector('.terrain-track');
[...terrainImages,...terrainImages].forEach((src,index)=>{
  const figure=document.createElement('figure');
  if(index>=terrainImages.length)figure.setAttribute('aria-hidden','true');
  const image=document.createElement('img');
  image.src=src;image.alt=index<terrainImages.length?'Vehículo procesado por tecnología SKANO':'';image.loading='lazy';image.decoding='async';
  figure.append(image);terrainTrack.append(figure);
});
document.querySelector('.hero')?.after(terrainGallery);

const terrainStyles=document.createElement('style');
terrainStyles.textContent=`
  .terrain-gallery{padding:90px 0;background:linear-gradient(135deg,#041326,#082b50);color:#fff;overflow:hidden}
  .terrain-heading h2{font-size:clamp(36px,5vw,68px);line-height:1;letter-spacing:-.045em;margin:12px 0 18px}.terrain-heading h2 em{font-style:normal;color:var(--cyan)}.terrain-review{max-width:820px;color:#c5d8e7;font-size:14px;line-height:1.75}.terrain-privacy{color:#68ddeb;font-size:10px;letter-spacing:.04em;margin-top:12px}
  .terrain-viewport{margin-top:40px;overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)}
  .terrain-track{display:flex;gap:18px;width:max-content;animation:terrainFlow 58s linear infinite;will-change:transform}.terrain-track:hover{animation-play-state:paused}
  .terrain-track figure{width:clamp(250px,24vw,370px);height:470px;margin:0;border:1px solid rgba(41,216,237,.25);border-radius:18px;overflow:hidden;background:#06182e;box-shadow:0 18px 45px rgba(0,0,0,.28)}
  .terrain-track img{width:100%;height:100%;object-fit:cover;transition:transform .45s}.terrain-track figure:hover img{transform:scale(1.025)}
  @keyframes terrainFlow{to{transform:translateX(calc(-50% - 9px))}}
  @media(max-width:600px){.terrain-gallery{padding:70px 0}.terrain-track{gap:12px;animation-duration:48s}.terrain-track figure{width:78vw;height:430px}}
  @media(prefers-reduced-motion:reduce){.terrain-track{animation:none;max-width:100vw;overflow-x:auto;scroll-snap-type:x mandatory}.terrain-track figure{scroll-snap-align:center}}
`;
document.head.append(terrainStyles);

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
