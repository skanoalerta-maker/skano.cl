import {app} from './store-firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
const functions=getFunctions(app,'us-central1');
const upload=httpsCallable(functions,'uploadStoreProductImage');
const read=httpsCallable(functions,'readStoreProductImage');
const save=httpsCallable(functions,'saveStoreProductMedia');
export const fileBase64=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('No se pudo leer la foto'));r.onload=()=>resolve(String(r.result).split(',')[1]);r.readAsDataURL(file);});
export async function uploadPhoto(productId,file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<1||file.size>5*1024*1024)throw Error('Solo JPEG, PNG o WebP hasta 5 MB.');
 return (await upload({productId,base64:await fileBase64(file)})).data;
}
function photoPath(photo){if(photo.path)return photo.path;try{return decodeURIComponent(new URL(photo.url).pathname.split('/o/')[1]);}catch{return '';}}
export async function privatePhoto(productId,photo){const {data}=await read({productId,path:photoPath(photo)});return `data:${data.contentType};base64,${data.base64}`;}
export async function mountMediaEditor(host,product,onSaved){
 host.replaceChildren();const title=document.createElement('h3');title.textContent=`Fotografías · ${product.productCode||product.id}`;
 const note=document.createElement('p');note.textContent='Hasta cuatro fotos. Ordena, elige portada o quita fotos y guarda. Los originales retirados se conservan privados para recuperación. Guardar requiere revisar nuevamente antes de publicar.';
 const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px';
 const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.multiple=true;input.setAttribute('aria-label','Agregar fotografías');
 const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Guardar galería';
 const info=document.createElement('p');info.setAttribute('role','status');
 const close=document.createElement('button');close.type='button';close.textContent='Cerrar';close.onclick=()=>host.remove();
 host.append(title,note,input,grid,button,close,info);
 let items=(product.images||[]).map(p=>({...p,path:photoPath(p)})),cover=items[product.coverIndex]||items[0],busy=false;
 async function render(){grid.replaceChildren();for(const [i,item] of items.entries()){
  const cell=document.createElement('div'),img=document.createElement('img');img.alt=`Fotografía ${i+1}`;img.style.cssText='width:100%;height:150px;object-fit:contain';
  const label=document.createElement('p');label.textContent=item===cover?'Portada':`Foto ${i+1}`;
  cell.append(img,label);
  for(const [label,action,disabled] of [ ['Portada',()=>{cover=item;render();},false],['Mover antes',()=>{[items[i-1],items[i]]=[items[i],items[i-1]];render();},i===0],['Quitar',()=>{items=items.filter(x=>x!==item);if(cover===item)cover=items[0];render();},false] ]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled||busy;b.onclick=action;cell.append(b);
  }
  grid.append(cell);
  try{item.preview ||= item.file?await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(item.file);}):await privatePhoto(product.id,item);if(img.isConnected)img.src=item.preview;}
  catch{label.textContent+=' · No se pudo cargar vista previa';}
 }}
 input.onchange=()=>{
  const files=[...input.files];if(items.length+files.length>4){info.textContent='Máximo cuatro fotografías; quita una antes de agregar otra.';return;}
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||!f.size||f.size>5*1024*1024)){info.textContent='Formato o tamaño inválido (máximo 5 MB).';return;}
  items.push(...files.map(file=>({file})));cover ||= items[0];input.value='';render();
 };
 button.onclick=async()=>{
  if(busy)return;
  busy=true;button.disabled=true;input.disabled=true;render();
  try{for(const item of items)if(item.file&&!item.path){info.textContent='Validando y optimizando fotografía…';Object.assign(item,await uploadPhoto(product.id,item.file));}
   await save({productId:product.id,paths:items.map(i=>i.path),coverIndex:Math.max(0,items.indexOf(cover)),technicalSpecs:product.technicalSpecs||'',expectedMediaRevision:product.mediaRevision||0});
   info.textContent='Galería guardada. Debes revisar las fotografías antes de publicar.';await onSaved();host.remove();
  }catch(e){info.textContent=e.message||'No se pudo guardar. Puedes reintentar; no se crea otro producto.';}
  finally{busy=false;button.disabled=false;input.disabled=false;render();}
 };render();
}
