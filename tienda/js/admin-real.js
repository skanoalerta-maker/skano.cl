'use strict';
import {auth, app} from './store-firebase.js';
import {installStoreDraftActions} from './admin-draft-actions.js?v=20261101-stage1';
import {installStoreProductExtras} from './admin-product-extra.js?v=20261101-stage1';
import {mountProductDraftForm} from './admin-product-form-v2.js?v=20261101-stage1';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
const fn = getFunctions(app, 'us-central1');
const api = {
  categories: httpsCallable(fn, 'listStoreCategories'),
  createCategory: httpsCallable(fn, 'createStoreCategory'),
  updateCategory: httpsCallable(fn, 'updateStoreCategory'),
  products: httpsCallable(fn, 'listStoreProductDrafts'),
};
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null, authorized=false, checkedUid=null, categories=[], products=[], generation=0, renderGeneration=0;
const nav=[['','Resumen'],['productos','Productos'],['categorias','Categorías'],['proveedores','Proveedores'],['pedidos','Pedidos'],['despachos','Despachos'],['clientes','Clientes'],['reportes','Reportes']];
const isAdmin=()=>location.hash==='#/admin'||location.hash.startsWith('#/admin/');
const root=()=>document.getElementById('skano-real-admin');
const status=(txt)=>{const n=document.getElementById('skano-real-status');if(n)n.textContent=txt;};
function adminUrl(section=''){return '#/admin'+(section?'/'+section:'');}
function showEntry(){
 const tools=document.querySelector('.tools');
 let a=document.getElementById('skano-admin-shortcut');
 if(!authorized){a?.remove();return;}
 if(!a && tools){a=document.createElement('a');a.id='skano-admin-shortcut';a.href='#/admin';a.textContent='Administración';tools.append(a);}
}
function table(headers,rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function shell(section,body){
 const r=root();if(!r)return;
 r.innerHTML=`<div class="skano-admin-web-nav"><a href="#/">← Volver a la tienda</a><a href="#/cuenta">Mi cuenta</a></div><div class="admin-heading"><span class="eyebrow">SKANO / ESPACIO DE GESTIÓN</span><h1>Administración SKANO STORE</h1><p>Acceso privado · Catálogo comercial conectado a Firebase</p></div><div class="admin-layout"><aside>${nav.map(([id,label])=>`<a href="${adminUrl(id)}" class="${section===id?'active':''}">${label}</a>`).join('')}</aside><div class="admin-body"><p id="skano-real-status" role="status" aria-live="polite"></p>${body}</div></div>`;
}
async function verify(){
 const request=++generation;
 authorized=false;showEntry();
 if(!user){if(isAdmin())root()&&(root().innerHTML='<div class="panel"><h2>Acceso privado</h2><p>Debes iniciar sesión con tu cuenta administradora.</p><a class="button" href="#/cuenta">Ir a Mi cuenta</a></div>');return false;}
 if(isAdmin())root()&&(root().innerHTML='<div class="panel">Verificando permiso administrativo…</div>');
 try {
   const response=await api.categories();
   if(request!==generation||auth.currentUser?.uid!==user.uid)return false;
   authorized=true;checkedUid=user.uid;categories=response.data?.categories||[];showEntry();return true;
 }catch(e){
   if(request!==generation)return false;
   authorized=false;showEntry();
   if(isAdmin()&&root())root().innerHTML='<div class="panel"><h2>Acceso restringido</h2><p>Esta cuenta no tiene permisos administrativos o el servidor no responde.</p><p class="muted" id="skano-denied"></p></div>';
   const d=document.getElementById('skano-denied');if(d)d.textContent=e.code||e.message;
   return false;
 }
}
async function draw(){
 if(!isAdmin())return;
 if(!authorized||checkedUid!==user?.uid){if(!await verify())return;}
 const parts=location.hash.slice(2).split('/');const section=parts[1]||'';
 const renderId=++renderGeneration, uid=user?.uid, hash=location.hash;
 const current=()=>renderId===renderGeneration&&authorized&&auth.currentUser?.uid===uid&&location.hash===hash;
 if(section==='categorias'){
   shell(section,`<h2>Categorías de la tienda</h2><div class="panel"><form id="skano-category-create"><label>Nueva categoría<input name="name" minlength="3" maxlength="70" required placeholder="Ej. Accesorios vehiculares"></label><label>Prefijo SKU<input name="prefix" pattern="[A-Za-z]{2,5}" maxlength="5" placeholder="Ej. ACC"></label><label>Categoría principal (opcional)<select name="parentId"><option value="">Sin categoría principal</option>${categories.filter(c=>c.active&&!c.parentId).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><button class="button">Crear categoría</button></form></div><div id="skano-categories-table"></div>`);
   document.getElementById('skano-category-create').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await api.createCategory({name:e.target.elements.name.value.trim(),prefix:e.target.elements.prefix.value.trim()||undefined,parentId:e.target.elements.parentId.value||null});await loadCategories();drawCategories();status('Categoría guardada.');e.target.reset();}catch(x){status('Error: '+(x.message||x.code));}finally{b.disabled=false;}});
   await loadCategories();if(!current())return;drawCategories();return;
 }
 if(section==='productos'){
   shell(section,`<div class="section-title"><h2>Productos reales</h2></div><div class="notice">Gestiona los productos reales. Antes de publicar, revisa su categoría, información y fotografías. Las compras permanecen deshabilitadas.</div><div id="skano-real-product-form"></div><div id="skano-products-table">Cargando productos…</div>`);
   mountProductDraftForm(document.getElementById('skano-real-product-form'), async()=>{if(current())await draw();});
   try {const result=await api.products();if(!current())return;products=result.data?.products||[];
   const rows=products.map(p=>[esc(p.productCode||'Sin código'),esc(p.name),esc(p.category),esc(p.brand||'—'),esc(p.model||'—'),'$'+Number(p.price||0).toLocaleString('es-CL'),esc(p.publicationStatus||'draft'),'<button type="button" data-store-action="history" data-product-id="'+esc(p.id)+'">Historial</button> '+(p.publicationStatus==='draft'?'<button type="button" data-store-action="verify-image" data-product-id="'+esc(p.id)+'">Revisar fotos</button> <button type="button" data-store-action="stock" data-product-id="'+esc(p.id)+'">Stock</button> <button type="button" data-store-action="edit" data-product-id="'+esc(p.id)+'">Editar</button>  <button type="button" data-store-action="publish" data-product-id="'+esc(p.id)+'">Publicar</button> <button type="button" data-skano-extra="photos" data-product-id="'+esc(p.id)+'">Fotografías</button> <button type="button" data-skano-extra="archive" data-product-id="'+esc(p.id)+'" style="color:#b42318">Archivar</button>':'<button type="button" data-store-action="unpublish" data-product-id="'+esc(p.id)+'">Despublicar</button> <button type="button" data-skano-extra="photos" data-product-id="'+esc(p.id)+'">Fotografías</button>')]);
   document.getElementById('skano-products-table').innerHTML=rows.length?table(['Código','Artículo','Categoría','Marca','Modelo','Precio','Estado','Acciones'],rows):'<div class="panel">Todavía no hay productos registrados.</div>';
   status(`${products.length} producto(s) consultados.`);
   installStoreDraftActions(products,async()=>{await draw();});
   installStoreProductExtras(products,async()=>{await draw();});
   }catch(e){if(!current())return;status('No se pudieron cargar los productos: '+(e.message||e.code));}return;
 }
 if(section===''){
   let list=[];try{const summary=await api.products();if(!current())return;list=summary.data?.products||[];}catch(e){shell(section,'<p role="alert">No se pudo consultar el resumen. Recarga para reintentar.</p>');return;}
   shell(section,`<h2>Resumen de la tienda</h2><div class="metrics"><div class="panel"><span>Categorías registradas</span><strong>${categories.length}</strong><small>Datos reales</small></div><div class="panel"><span>Productos publicados</span><strong>${list.filter(p=>p.publicationStatus==='published').length}</strong><small>${list.filter(p=>p.publicationStatus==='draft').length} borradores activos (últimos 50)</small></div><div class="panel"><span>Ventas reales</span><strong>—</strong><small>Checkout pendiente</small></div><div class="panel"><span>Pedidos pagados</span><strong>—</strong><small>Sin integración de pedidos</small></div></div><div class="panel"><h3>Administración simplificada</h3><p>Ya puedes consultar los productos y gestionar las categorías reales desde el menú. Las compras y reportes se habilitarán cuando se integren los pedidos.</p><a class="button" href="#/admin/productos">Ver productos</a></div>`);return;
 }
 shell(section,`<h2>${esc(nav.find(x=>x[0]===section)?.[1]||'Sección')}</h2><div class="panel"><p>Esta sección aún no está conectada a datos reales. No se muestran clientes, pedidos ni ventas ficticias.</p></div>`);
}
async function loadCategories(){const r=await api.categories();categories=r.data?.categories||[];}
function drawCategories(){
 const el=document.getElementById('skano-categories-table');if(!el)return;
 el.replaceChildren();
 if(!categories.length){el.textContent='Todavía no hay categorías registradas.';return;}
 const panel=document.createElement('div');panel.className='panel';
 for(const item of categories){
   const row=document.createElement('div');row.className='skano-cat-row';
   const input=document.createElement('input');input.value=item.name;input.maxLength=70;input.setAttribute('aria-label','Nombre de categoría');
   const state=document.createElement('span');state.textContent=(item.active?'Activa':'Desactivada')+(item.parentId?' · Subcategoría':'')+' · '+item.prefix;
   const save=document.createElement('button');save.type='button';save.textContent='Guardar';
   const toggle=document.createElement('button');toggle.type='button';toggle.textContent=item.active?'Desactivar':'Activar';
   save.onclick=async()=>{save.disabled=true;try{await api.updateCategory({id:item.id,name:input.value.trim()});await loadCategories();drawCategories();status('Categoría actualizada.');}catch(e){status('Error: '+(e.message||e.code));}finally{save.disabled=false;}};
   toggle.onclick=async()=>{toggle.disabled=true;try{await api.updateCategory({id:item.id,active:!item.active});await loadCategories();drawCategories();status('Estado actualizado.');}catch(e){status('Error: '+(e.message||e.code));}finally{toggle.disabled=false;}};
   row.append(input,state,save,toggle);panel.append(row);
 }
 el.append(panel);
}
window.addEventListener('hashchange',()=>{if(isAdmin())draw();});
onAuthStateChanged(auth,async u=>{user=u;authorized=false;checkedUid=null;products=[];categories=[];generation++;renderGeneration++;showEntry();if(isAdmin())draw();else if(u){await verify();}});
if(isAdmin())draw();
