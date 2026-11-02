import {economicsText} from './product-economics.mjs';
import {privatePhoto} from './admin-media-editor.js';
"use strict";
import {app} from './store-firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
const f=getFunctions(app,'us-central1');
const edit=httpsCallable(f,'editStoreProductDetails');
const verify=httpsCallable(f,'verifyStoreProduct');
const publish=httpsCallable(f,'publishStoreProduct');
const unpublish=httpsCallable(f,'unpublishStoreProduct');
const history=httpsCallable(f,'listStoreProductHistory');
const stock=httpsCallable(f,'setStoreProductStock');
const loadCategories=httpsCallable(f,'listStoreCategories');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(v)=>String(v??'');
export function installStoreDraftActions(products,onUpdated){
 const table=document.getElementById('skano-products-table');if(!table)return;
 table.querySelectorAll('[data-store-action]').forEach(button=>{
  button.addEventListener('click',()=>{
   const p=products.find(x=>x.id===button.dataset.productId);
   if(!p)return;
   if(button.dataset.storeAction==='edit')showEditor(p,table,onUpdated);
   if(button.dataset.storeAction==='verify-image')showVerification(p,'image',table,onUpdated);
   if(button.dataset.storeAction==='unpublish'&&confirm('¿Retirar del catálogo y volver a borrador?')){unpublish({productId:p.id}).then(onUpdated).catch(e=>message(table,e.message));}
   if(button.dataset.storeAction==='history'){history({productId:p.id}).then(r=>{const panel=panelFor(table);const h=document.createElement('h3');h.textContent='Historial del producto';panel.append(h);for(const event of r.data.events){const line=document.createElement('p');line.textContent=`${event.at||''} · ${event.action} · ${JSON.stringify(event.details)}`;panel.append(line);}if(!r.data.events.length)panel.append('Sin eventos registrados desde la incorporación del historial.');}).catch(e=>message(table,e.message));}
   if(button.dataset.storeAction==='stock')showStock(p,table,onUpdated);
   if(button.dataset.storeAction==='publish')publishDraft(p,table,onUpdated);
  });
 });
}
function message(table,txt){let n=document.getElementById('skano-draft-action-status');if(!n){n=document.createElement('p');n.id='skano-draft-action-status';n.setAttribute('role','status');table.before(n);}n.textContent=txt;}
function panelFor(table){let panel=document.getElementById('skano-draft-editor');if(!panel){panel=document.createElement('section');panel.id='skano-draft-editor';panel.className='panel';table.before(panel);}panel.replaceChildren();return panel;}
async function showEditor(p,table,onUpdated){
 const container=panelFor(table);
 container.textContent='Consultando categorías activas…';
 let categories;
 try{const r=await loadCategories();categories=(r.data?.categories||[]).filter(c=>c.active===true);}
 catch{if(container.isConnected)container.textContent='No se pudieron cargar las categorías. Vuelve a abrir Editar.';return;}
 if(!container.isConnected)return;
 if(!categories.length){container.textContent='No hay categorías activas. Crea o activa una antes de editar.';return;}
 const fields=[['name','Nombre',120],['brand','Marca',100],['model','Modelo',100],['supplier','Proveedor privado',100],['supplierSku','SKU proveedor',120]];
 const fieldHtml=fields.map(([key,label,max])=>`<label>${label}<input name="${key}" value="${escape(p[key])}" maxlength="${max}" ${key==='supplierSku'?'':'required'}></label>`).join('');
 const current=categories.some(c=>c.id===p.category);
 const opts=(!current?'<option value="" selected disabled>Selecciona una categoría activa</option>':'')+categories.map(c=>`<option value="${escape(c.id)}" ${c.id===p.category?'selected':''}>${escape(c.name)}</option>`).join('');
 container.innerHTML=`<h3>Editar borrador ${escape(p.productCode||p.id)}</h3><p>Selecciona una categoría activa. Se conserva el código existente y las fotografías se comprueban al publicar.</p><form id="skano-edit-existing"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${fieldHtml}<label>Categoría<select name="category" required>${opts}</select></label><label>Precio venta CLP<input name="price" type="number" min="1" step="1" value="${Number(p.price)||0}" required></label><label>Costo privado CLP<input name="cost" type="number" min="0" step="1" value="${Number(p.cost)||0}" required></label></div><label>Tratamiento del costo<select name="costTaxMode"><option value="unknown">Por confirmar</option><option value="gross">Incluye IVA 19%</option><option value="net">Neto, sin IVA</option></select></label><p class="cost-estimate"></p><label>Descripción comercial<textarea name="description" maxlength="1500" rows="4" required>${escape(p.description)}</textarea></label><label>Ficha técnica<textarea name="technicalSpecs" maxlength="6000" rows="5">${escape(p.technicalSpecs)}</textarea></label><button class="button" type="submit">Guardar cambios de este borrador</button> <button type="button" id="skano-close-edit">Cerrar</button><p role="status"></p></form>`;
 container.querySelector('#skano-close-edit').onclick=()=>container.remove();
 const form=container.querySelector('form');form.elements.costTaxMode.value=p.costTaxMode||'unknown';const estimate=()=>{container.querySelector('.cost-estimate').textContent=economicsText(Number(form.elements.price.value),Number(form.elements.cost.value),form.elements.costTaxMode.value);};form.addEventListener('input',estimate);estimate();form.addEventListener('submit',async e=>{
  e.preventDefault();e.stopPropagation();if(!form.reportValidity())return;
  const d=new FormData(form);const value=k=>text(d.get(k)).trim();const button=form.querySelector('[type=submit]');const info=form.querySelector('[role=status]');
  const payload={productId:p.id,costTaxMode:value('costTaxMode'),name:value('name'),category:value('category'),brand:value('brand'),model:value('model'),supplier:value('supplier'),supplierSku:value('supplierSku'),description:value('description'),technicalSpecs:value('technicalSpecs'),price:Number(value('price')),cost:Number(value('cost'))};
  if(payload.category!==p.category&&!confirm(`Se cambiará la categoría conservando el código ${p.productCode}. ¿Continuar?`))return;
  button.disabled=true;info.textContent='Guardando en Firebase…';
  try{const r=await edit(payload);info.textContent=`Guardado: ${r.data.productCode}. Ya puedes intentar publicar cuando los datos estén completos.`;if(typeof onUpdated==='function')await onUpdated();}
  catch(err){info.textContent='No se pudo editar: '+(err.message||err.code);}
  finally{button.disabled=false;}
 });
 container.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function showVerification(p,type,table,onUpdated){
 const container=panelFor(table);
 if(type==='image'&&!p.imageUrl){container.innerHTML='<h3>Faltan fotografías</h3><p>Este borrador no tiene imagen principal asociada. No se puede verificar ni publicar.</p>';return;}
 const label=type==='image'?'Revisar fotografías':'Confirmar disponibilidad con proveedor';
 container.innerHTML=`<h3>${label}: ${escape(p.productCode)}</h3><p>${type==='image'?'Confirma que las fotografías pertenecen realmente a este artículo.':'Confirma que consultaste la disponibilidad actual del proveedor.'}</p><form><label>Nota de comprobación<textarea name="note" minlength="10" maxlength="500" required placeholder="Describe qué comprobaste (al menos 10 caracteres)"></textarea></label><label style="display:block"><input type="checkbox" name="confirmed" required> Confirmo que comprobé la información</label><button class="button" type="submit">Registrar verificación</button><p role="status"></p></form>`;
 const gallery=document.createElement('div');container.prepend(gallery);for(const photo of p.images||[]){const img=document.createElement('img');img.alt='Fotografía que se aprobará';img.style.cssText='width:150px;height:150px;object-fit:contain';gallery.append(img);try{img.src=await privatePhoto(p.id,photo);}catch{img.alt='No se pudo cargar. No apruebes sin revisar.';}}
 const form=container.querySelector('form');form.addEventListener('submit',async e=>{
  e.preventDefault();e.stopPropagation();if(!form.reportValidity())return;
  const b=form.querySelector('button');b.disabled=true;const info=form.querySelector('[role=status]');info.textContent='Verificando…';
  try{await verify({productId:p.id,verificationType:type,note:form.elements.note.value.trim(),confirmed:true});info.textContent='Verificación registrada.';if(typeof onUpdated==='function')await onUpdated();}
  catch(err){info.textContent='No se verificó: '+(err.message||err.code);}
  finally{b.disabled=false;}
 });container.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function publishDraft(p,table,onUpdated){
 if(p.publicationStatus!=='draft')return;
 if(!p.imageUrl){message(table,`No se publica ${p.productCode}: no hay imagen principal asociada al borrador.`);return;}
 if(!confirm(`¿Publicar ${p.productCode} en el catálogo público SKANO STORE?`))return;
 message(table,'Publicando…');
 try{await publish({productId:p.id});message(table,`Publicado: ${p.productCode}.`);if(typeof onUpdated==='function')await onUpdated();}
 catch(err){message(table,'Publicación rechazada: '+(err.message||err.code));}
}
function showStock(p,table,onUpdated){
 const panel=panelFor(table);panel.innerHTML='<h3>Existencias verificadas</h3><form><label>Cantidad disponible real<input name="quantity" type="number" min="0" max="1000000" step="1" required></label><label>Comprobación con proveedor<textarea name="note" minlength="10" maxlength="500" required></textarea></label><button class="button">Guardar disponibilidad</button><p role="status"></p></form>';
 const form=panel.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await stock({productId:p.id,quantity:Number(form.elements.quantity.value),note:form.elements.note.value.trim()});await onUpdated();}catch(e){form.querySelector('[role=status]').textContent=e.message;}finally{b.disabled=false;}};
}
