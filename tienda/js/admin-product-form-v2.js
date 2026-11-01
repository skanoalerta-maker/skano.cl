'use strict';
import {app} from './store-firebase.js';
import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
import {getStorage, ref, uploadBytes} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js';

const functions = getFunctions(app, 'us-central1');
const storage = getStorage(app);
const create = httpsCallable(functions, 'createStoreProductDraft');
const update = httpsCallable(functions, 'updateStoreProductDraft');
const saveMedia = httpsCallable(functions, 'saveStoreProductMedia');
const categoryApi=httpsCallable(functions,'listStoreCategories');
const escape = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowedTypes = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};

export async function mountProductDraftForm(host, onSaved) {
  if (!host) return;
  host.replaceChildren();
  host.textContent='Cargando categorías reales…';
  let categories=[];
  try {
    const r=await categoryApi();
    categories=(r.data?.categories||[]).filter(c=>c.active===true&&typeof c.id==='string'&&typeof c.prefix==='string'&&/^[A-Z]{2,5}$/.test(c.prefix)).map(c=>[c.id,c.name+' · '+c.prefix]);
  } catch(e) {host.textContent='No se pudieron consultar las categorías de Firebase: '+(e.message||e.code);return;}
  if(!categories.length){host.textContent='No hay categorías activas con prefijo. Crea una desde Administración > Categorías.';return;}

 const panel=document.createElement('section');panel.className='panel';
 panel.innerHTML=`<h3>Registrar artículo — borrador real</h3><p>Hasta cuatro imágenes desde tu PC. Las fotografías se comprueban automáticamente al publicar.</p>
 <form id="skano-real-product-create">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px">
   <label>Nombre del artículo<input name="name" maxlength="120" required></label>
   <label>Categoría<select name="category" required><option value="" selected disabled>Selecciona una categoría</option>${categories.map(([v,n])=>`<option value="${v}">${escape(n)}</option>`).join('')}</select></label>
   <label>Marca<input name="brand" maxlength="100" required></label>
   <label>Modelo<input name="model" maxlength="100" required></label>
   <label>Precio de venta (CLP)<input name="price" type="number" min="1" step="1" required></label>
   <label>Costo proveedor (privado, CLP)<input name="cost" type="number" min="0" step="1" required></label>
   <label>Proveedor privado<select name="supplier"><option>Dropi</option><option>FlashDrop</option><option>Mercado Libre</option><option>Otro</option></select></label>
   <label>SKU del proveedor<input name="supplierSku" maxlength="120" required></label>
  </div>
  <label>Descripción comercial<textarea name="description" maxlength="1500" rows="4" required></textarea></label>
  <label>Ficha técnica (hasta 6000 caracteres)<textarea name="technicalSpecs" maxlength="6000" rows="4" placeholder="Pega aquí las especificaciones técnicas"></textarea></label>
  <div style="margin:16px 0"><label>Fotografías (1 a 4; JPEG, PNG o WebP; máximo 5 MB cada una)<input id="skano-images" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label>
  <div id="skano-photos-preview" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:12px"></div></div>
  <p id="skano-margin" style="font-weight:600"></p>
  <button class="button" type="submit">Guardar borrador con fotografías</button>
  <p id="skano-photo-status" role="status" aria-live="polite"></p>
 </form>`;
 host.append(panel);
 const form=panel.querySelector('form');const preview=panel.querySelector('#skano-photos-preview');
 const input=panel.querySelector('#skano-images');const status=panel.querySelector('#skano-photo-status');
 const button=form.querySelector('button[type=submit]');const margin=panel.querySelector('#skano-margin');
 let images=[];let cover=0;let urls=[];
 function refresh() {
  urls.forEach(u=>URL.revokeObjectURL(u));urls=[];preview.replaceChildren();
  images.forEach((file,i)=>{
   const u=URL.createObjectURL(file);urls.push(u);
   const item=document.createElement('label');item.style.cssText='border:1px solid #cdd9e9;border-radius:10px;padding:9px;display:block';
   const img=document.createElement('img');img.src=u;img.alt=`Vista previa ${i+1}`;img.style.cssText='width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px';
   const radio=document.createElement('input');radio.type='radio';radio.name='skanoCover';radio.checked=i===cover;radio.addEventListener('change',()=>{cover=i;});
   const label=document.createElement('span');label.textContent=' Portada';
   const fileName=document.createElement('small');fileName.style.display='block';fileName.textContent=file.name;
   item.append(img,radio,label,fileName);preview.append(item);
  });
 }
 input.addEventListener('change',()=>{
  const selected=Array.from(input.files||[]);
  if(selected.length<1||selected.length>4){status.textContent='Selecciona entre 1 y 4 imágenes.';images=[];refresh();return;}
  for(const f of selected){if(!allowedTypes[f.type]||f.size>5*1024*1024||f.size===0){status.textContent='Solo JPEG, PNG o WebP de hasta 5 MB por fotografía.';images=[];refresh();return;}}
  images=selected;cover=0;status.textContent=`${images.length} fotografía(s) lista(s). Elige la portada.`;refresh();
 });
 function recalc(){const p=Number(form.elements.price.value),c=Number(form.elements.cost.value);margin.textContent=Number.isFinite(p)&&Number.isFinite(c)&&p>0&&c>=0?`Margen bruto estimado: $${(p-c).toLocaleString('es-CL')} (antes de gastos e impuestos)`:'';}
 form.elements.price.addEventListener('input',recalc);form.elements.cost.addEventListener('input',recalc);
 let creationUncertain=false;
 form.addEventListener('submit',async e=>{
  e.preventDefault();e.stopPropagation();
  if(creationUncertain||button.disabled)return;
  if(!form.reportValidity())return;
  if(images.length<1||images.length>4){status.textContent='Debes seleccionar de 1 a 4 fotografías válidas.';return;}
  const price=Number(form.elements.price.value),cost=Number(form.elements.cost.value);
  if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(cost)||cost<0){status.textContent='Precio y costo deben ser enteros válidos.';return;}
  creationUncertain=true;button.disabled=true;status.textContent='Creando borrador privado…';let created=null;
  try {
   const r=await create({name:form.elements.name.value.trim(),category:form.elements.category.value,
    supplier:form.elements.supplier.value,supplierSku:form.elements.supplierSku.value.trim(),price,cost});
   created=r.data;
   if(!created?.productId)throw new Error('Firebase no devolvió el ID. Verifica Firestore antes de volver a intentar.');
   await update({productId:created.productId,brand:form.elements.brand.value.trim(),model:form.elements.model.value.trim(),
    description:form.elements.description.value.trim(),imageUrl:'',price,cost});
   const paths=[];
   for(let i=0;i<images.length;i++){
    const file=images[i];const ext=allowedTypes[file.type];
    const path=`store_product_images/${created.productId}/photo_${i+1}.${ext}`;
    status.textContent=`Subiendo fotografía ${i+1} de ${images.length}…`;
    await uploadBytes(ref(storage,path),file,{contentType:file.type,customMetadata:{productId:created.productId}});
    paths.push(path);
   }
   status.textContent='Vinculando fotografías con el producto…';
   await saveMedia({productId:created.productId,paths,coverIndex:cover,technicalSpecs:form.elements.technicalSpecs.value.trim()});
   status.textContent=`Borrador ${created.productCode || created.productId} guardado con ${paths.length} foto(s). NO publicado. Recarga la lista para verlo.`;
   creationUncertain=false;form.reset();images=[];cover=0;refresh();recalc();
   if(typeof onSaved==='function') await onSaved();
  }catch(err){
   const detail=err?.message||err?.code||String(err);
   status.textContent=created?.productId
    ? `El borrador ${created.productCode||created.productId} YA EXISTE, pero no se terminó de guardar: ${detail}. NO vuelvas a presionar Guardar; revisa el artículo antes de reintentar.`
    : `No se pudo confirmar la creación: ${detail}. Revisa la lista antes de iniciar otro registro.`;
  }finally{button.disabled=creationUncertain;}
 });
}