const header=document.getElementById('header');
const menuButton=document.getElementById('menuButton');
const mainNav=document.getElementById('mainNav');
window.addEventListener('scroll',()=>header?.classList.toggle('scrolled',window.scrollY>10),{passive:true});
menuButton?.addEventListener('click',()=>{const open=mainNav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú')});
mainNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{mainNav.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){mainNav?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}});
document.getElementById('year').textContent=String(new Date().getFullYear());
const form=document.getElementById('contactForm');
form?.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);const subject=encodeURIComponent('Contacto corporativo desde skano.cl');const body=encodeURIComponent(`Nombre: ${data.get('name')}\nCorreo: ${data.get('email')}\n\nMensaje:\n${data.get('message')}`);document.getElementById('formStatus').textContent='Abriendo tu aplicación de correo para completar el envío…';window.location.href=`mailto:contacto@skano.cl?subject=${subject}&body=${body}`});

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
