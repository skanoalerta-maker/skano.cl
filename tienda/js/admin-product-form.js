'use strict';
import {app} from './store-firebase.js';
import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';

const functions = getFunctions(app, 'us-central1');
const create = httpsCallable(functions, 'createStoreProductDraft');
const update = httpsCallable(functions, 'updateStoreProductDraft');
const categories = [
  ['camaras','Cámaras de seguridad · CAM'],
  ['alarmas','Alarmas · ALA'],
  ['panico','Botones de pánico · PAN'],
  ['gps','GPS vehicular · GPS'],
  ['audio','Altavoces y sirenas · AUD'],
  ['sensores','Sensores · SEN'],
];
const currency = n => '$' + Number(n || 0).toLocaleString('es-CL');

export function mountProductDraftForm(host, onSaved) {
  if (!host) return;
  const box = document.createElement('div');
  box.className = 'panel';
  const heading = document.createElement('h3');
  heading.textContent = 'Registrar un artículo — borrador real';
  const help = document.createElement('p');
  help.textContent = 'Guarda un producto privado en Firebase. No se publica ni se vende hasta completar y verificar fotografías, stock y publicación.';
  const form = document.createElement('form');
  form.id = 'skano-real-product-create';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px';
  const fields = {};
  function field(name,label,type='text',required=true,maxLength=0) {
    const wrap=document.createElement('label');wrap.textContent=label;
    const el=document.createElement('input');el.name=name;el.type=type;el.required=required;
    if(maxLength)el.maxLength=maxLength;
    if(type==='number'){el.min=name==='cost'?'0':'1';el.step='1';el.inputMode='numeric';}
    wrap.append(el);grid.append(wrap);fields[name]=el;return el;
  }
  field('name','Nombre del artículo','text',true,120);
  const categoryWrap=document.createElement('label');categoryWrap.textContent='Categoría';
  const categorySelect=document.createElement('select');categorySelect.name='category';categorySelect.required=true;
  for(const [id,name] of categories){const opt=document.createElement('option');opt.value=id;opt.textContent=name;categorySelect.append(opt);}
  categoryWrap.append(categorySelect);grid.append(categoryWrap);fields.category=categorySelect;
  field('brand','Marca','text',true,100);
  field('model','Modelo','text',true,100);
  field('price','Precio de venta (CLP)','number');
  field('cost','Costo del proveedor (privado, CLP)','number');
  const supplierWrap=document.createElement('label');supplierWrap.textContent='Proveedor privado';
  const supplierSelect=document.createElement('select');supplierSelect.name='supplier';supplierSelect.required=true;
  for(const name of ['Dropi','FlashDrop','Mercado Libre','Otro']){const opt=document.createElement('option');opt.value=name;opt.textContent=name;supplierSelect.append(opt);}
  supplierWrap.append(supplierSelect);grid.append(supplierWrap);fields.supplier=supplierSelect;
  field('supplierSku','SKU o referencia del proveedor','text',true,120);
  form.append(grid);
  const descLabel=document.createElement('label');descLabel.textContent='Descripción comercial (visible cuando se publique)';
  const description=document.createElement('textarea');description.name='description';description.rows=4;description.maxLength=1500;description.required=true;
  description.placeholder='Descripción del artículo, funciones y ventajas. Máximo 1500 caracteres.';
  descLabel.append(description);form.append(descLabel);fields.description=description;
  const pending=document.createElement('p');pending.textContent='Fotografías (hasta 4) y ficha técnica estructurada: pendientes de integración segura. Los productos guardados permanecen privados.';
  const pricePreview=document.createElement('p');pricePreview.style.fontWeight='600';
  const recalc=()=>{const p=Number(fields.price.value),c=Number(fields.cost.value);pricePreview.textContent=(Number.isFinite(p)&&Number.isFinite(c)&&p>0&&c>=0)?`Margen bruto estimado: ${currency(p-c)} (sin comisiones, impuestos ni despacho)`:'Completa precio y costo para estimar tu margen.';};
  fields.price.addEventListener('input',recalc);fields.cost.addEventListener('input',recalc);recalc();
  const submit=document.createElement('button');submit.className='button';submit.type='submit';submit.textContent='Guardar borrador real';
  const msg=document.createElement('p');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
  form.append(pending,pricePreview,submit,msg);box.append(heading,help,form);host.append(box);
  form.addEventListener('submit',async event=>{
    event.preventDefault();event.stopPropagation();
    if(!form.reportValidity())return;
    const price=Number(fields.price.value),cost=Number(fields.cost.value);
    if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(cost)||cost<0){msg.textContent='Los precios y costos deben ser números enteros válidos.';return;}
    submit.disabled=true;msg.textContent='Guardando borrador en Firebase…';
    let created=null;
    try {
      const r=await create({
        name:fields.name.value.trim(),category:fields.category.value,
        supplier:fields.supplier.value,supplierSku:fields.supplierSku.value.trim(),price,cost
      });
      created=r.data;
      if(!created?.productId)throw new Error('El servidor no devolvió un ID de producto. Verifica Firestore antes de reintentar.');
      await update({productId:created.productId,brand:fields.brand.value.trim(),model:fields.model.value.trim(),description:fields.description.value.trim(),imageUrl:'',price,cost});
      msg.textContent=`Borrador guardado: ${created.productCode || created.productId}. No está publicado.`;
      form.reset();recalc();
      if(typeof onSaved==='function')await onSaved();
    }catch(e){
      msg.textContent=created?.productId
        ? `El borrador ${created.productCode || created.productId} se creó, pero no se completó su ficha: ${e.message || e.code}. No presiones Guardar nuevamente; revisa el borrador.`
        : `No se pudo guardar: ${e.message || e.code}`;
    }finally{submit.disabled=false;}
  });
}