'use strict';
import {app} from './store-firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
const archive = httpsCallable(getFunctions(app,'us-central1'),'archiveStoreProductDraft');
const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installStoreProductExtras(products,refresh){
  const area=document.getElementById('skano-products-table');
  if(!area)return;
  area.addEventListener('click',async e=>{
    const button=e.target.closest('button[data-skano-extra]');
    if(!button||!area.contains(button))return;
    e.preventDefault();e.stopPropagation();
    const product=products.find(p=>p.id===button.dataset.productId);
    if(!product)return;
    const action=button.dataset.skanoExtra;
    if(action==='photos'){
      const current=document.getElementById('skano-photo-details');current?.remove();
      const panel=document.createElement('section');panel.id='skano-photo-details';panel.className='panel';
      panel.style.marginTop='16px';
      const title=document.createElement('h3');title.textContent='Fotografías · '+(product.productCode||product.name);
      panel.append(title);
      const photos=Array.isArray(product.images)?product.images.filter(x=>x&&typeof x.url==='string'&&x.url.startsWith('https://')):[];
      if(!photos.length){
        const msg=document.createElement('p');msg.textContent='No hay fotografías asociadas a este borrador en Firestore. Puede que el guardado anterior se haya interrumpido. No significa que estén eliminadas de Storage.';panel.append(msg);
      }else{
        const gallery=document.createElement('div');gallery.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px';
        photos.forEach((img,i)=>{
          const cell=document.createElement('div');cell.style.cssText='border:1px solid #d6e4f5;border-radius:10px;padding:8px';
          const pic=document.createElement('img');pic.src=img.url;pic.alt='Fotografía '+(i+1);pic.loading='lazy';pic.referrerPolicy='no-referrer';pic.style.cssText='width:100%;height:145px;object-fit:contain';
          const label=document.createElement('p');label.textContent=i===product.coverIndex?'Portada · Foto '+(i+1):'Foto '+(i+1);
          cell.append(pic,label);gallery.append(cell);
        });panel.append(gallery);
      }
      const close=document.createElement('button');close.type='button';close.textContent='Cerrar fotografías';close.addEventListener('click',()=>panel.remove());panel.append(close);
      area.after(panel);panel.scrollIntoView({block:'nearest',behavior:'smooth'});
      return;
    }
    if(action==='archive'){
      if(product.publicationStatus!=='draft'){alert('Solo se pueden eliminar borradores.');return;}
      if(!confirm('¿Eliminar de la lista el borrador '+(product.productCode||product.name)+'? Se archivará sin borrar sus fotos ni reutilizar su código.'))return;
      button.disabled=true;
      const s=document.getElementById('skano-real-status');
      try{await archive({productId:product.id});if(s)s.textContent='Borrador archivado. No se han borrado fotos ni reutilizado códigos.';await refresh();}
      catch(err){if(s)s.textContent='No se pudo eliminar: '+(err.message||err.code);button.disabled=false;}
    }
  });
}