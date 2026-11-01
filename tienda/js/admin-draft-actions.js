"use strict";
import {app} from './store-firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
const f=getFunctions(app,'us-central1');
const edit=httpsCallable(f,'editStoreProductDetails');
const verify=httpsCallable(f,'verifyStoreProduct');
const publish=httpsCallable(f,'publishStoreProduct');
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
 container.innerHTML=`<h3>Editar borrador ${escape(p.productCode||p.id)}</h3><p>Selecciona una categoría activa. Se conserva el código existente y las fotografías se comprueban al publicar.</p><form id="skano-edit-existing"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${fieldHtml}<label>Categoría<select name="category" required>${opts}</select></label><label>Precio venta CLP<input name="price" type="number" min="1" step="1" value="${Number(p.price)||0}" required></label><label>Costo privado CLP<input name="cost" type="number" min="0" step="1" value="${Number(p.cost)||0}" required></label></div><label>Descripción comercial<textarea name="description" maxlength="1500" rows="4" required>${escape(p.description)}</textarea></label><label>Ficha técnica<textarea name="technicalSpecs" maxlength="6000" rows="5">${escape(p.technicalSpecs)}</textarea></label><button class="button" type="submit">Guardar cambios de este borrador</button> <button type="button" id="skano-close-edit">Cerrar</button><p role="status"></p></form>`;
 container.querySelector('#skano-close-edit').onclick=()=>container.remove();
 const form=container.querySelector('form');form.addEventListener('submit',async e=>{
  e.preventDefault();e.stopPropagation();if(!form.reportValidity())return;
  const d=new FormData(form);const value=k=>text(d.get(k)).trim();const button=form.querySelector('[type=submit]');const info=form.querySelector('[role=status]');
  const payload={productId:p.id,name:value('name'),category:value('category'),brand:value('brand'),model:value('model'),supplier:value('supplier'),supplierSku:value('supplierSku'),description:value('description'),technicalSpecs:value('technicalSpecs'),price:Number(value('price')),cost:Number(value('cost'))};
  if(payload.category!==p.category&&!confirm(`Se cambiará la categoría conservando el código ${p.productCode}. ¿Continuar?`))return;
  button.disabled=true;info.textContent='Guardando en Firebase…';
  try{const r=await edit(payload);info.textContent=`Guardado: ${r.data.productCode}. Ya puedes intentar publicar cuando los datos estén completos.`;if(typeof onUpdated==='function')await onUpdated();}
  catch(err){info.textContent='No se pudo editar: '+(err.message||err.code);}
  finally{button.disabled=false;}
 });
 container.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function showVerification(p,type,table,onUpdated){
 const container=panelFor(table);
 if(type==='image'&&!p.imageUrl){container.innerHTML='<h3>Faltan fotografías</h3><p>Este borrador no tiene imagen principal asociada. No se puede verificar ni publicar.</p>';return;}
 const label=type==='image'?'Revisar fotografías':'Confirmar disponibilidad con proveedor';
 container.innerHTML=`<h3>${label}: ${escape(p.productCode)}</h3><p>${type==='image'?'Confirma que las fotografías pertenecen realmente a este artículo.':'Confirma que consultaste la disponibilidad actual del proveedor.'}</p><form><label>Nota de comprobación<textarea name="note" minlength="10" maxlength="500" required placeholder="Describe qué comprobaste (al menos 10 caracteres)"></textarea></label><label style="display:block"><input type="checkbox" name="confirmed" required> Confirmo que comprobé la información</label><button class="button" type="submit">Registrar verificación</button><p role="status"></p></form>`;
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
