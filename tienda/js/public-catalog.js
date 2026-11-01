// Pure public-domain contract. No Firebase, browser globals, or private collection access.
export const EMPTY_CATALOG = 'Próximamente encontrarás aquí nuestros productos de seguridad.';
export const CHECKOUT_ENABLED = false;
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const text = (v,max=1500) => typeof v==='string' ? v.trim().slice(0,max) : '';
export function safeProductImage(value, productId, {privateMedia=false}={}) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.hostname!=='firebasestorage.googleapis.com'||u.port||u.username||u.password||u.hash)return null;
    const match=u.pathname.match(/^\/v0\/b\/(skano-store\.firebasestorage\.app|skano-store\.appspot\.com)\/o\/(.+)$/);
    if(!match||u.searchParams.get('alt')!=='media')return null;
    const path=decodeURIComponent(match[2]);
    const publicPattern=new RegExp(`^store_public_product_images/${productId}/[A-Za-z0-9_-]+/photo_[1-4]\\.(jpg|png|webp)$`);
    const privatePattern=new RegExp(`^store_product_images/${productId}/photo_[1-4]\\.(jpg|png|webp)$`);
    if(!idPattern.test(productId)||!(publicPattern.test(path)||(privateMedia&&privatePattern.test(path))))return null;
    if(!privateMedia&&u.searchParams.has('token'))return null;
    return u.href;
  } catch {return null;}
}
export function normalizeCategories(rows){
  return rows.filter(c=>idPattern.test(c.id)&&text(c.name,70)&&c.active!==false)
    .map(c=>({id:c.id,name:text(c.name,70)})).sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
export function normalizeProduct(id,p,categories){
  if(!idPattern.test(id)||!p||p.publicationStatus!=='published'||p.archived===true||p.imageApproved!==true)return null;
  const category=categories.find(c=>c.id===p.category);
  if(!category||!text(p.name,120)||!text(p.description)||!text(p.productCode,40)||!text(p.brand,100)||!text(p.model,100))return null;
  if(!Number.isSafeInteger(p.price)||p.price<=0||p.price>1000000000)return null;
  const raw=Array.isArray(p.images)?p.images:[];
  if(raw.length<1||raw.length>4||!Number.isInteger(p.coverIndex)||p.coverIndex<0||p.coverIndex>=raw.length)return null;
  const images=raw.map(i=>safeProductImage(typeof i==='string'?i:i?.url,id));
  if(images.some(i=>!i)||new Set(images).size!==images.length||p.imageUrl!==images[p.coverIndex])return null;
  // Explicit projection: never spread a Firestore record into the public view model.
  return {id,name:text(p.name,120),productCode:text(p.productCode,40),category:category.id,categoryName:category.name,
    brand:text(p.brand,100),model:text(p.model,100),price:p.price,description:text(p.description),
    technicalSpecs:text(p.technicalSpecs,6000),images,coverIndex:p.coverIndex,imageUrl:images[p.coverIndex],
    featured:p.featured===true,offer:p.offer===true,
    compatibility:p.compatibility==='verified'?'Verificado':p.compatibility==='independent'?'Independiente':'No verificado',
    availability:p.stockVerified===true&&['available','unavailable'].includes(p.availability)?p.availability:'unknown'};
}
export function publicCatalog(rows,categories){return rows.map(({id,...p})=>normalizeProduct(id,p,categories)).filter(Boolean);}
export function filterProducts(products,params){
  const q=(params.get('q')||'').trim().toLocaleLowerCase('es');
  const max=Number(params.get('max'));
  const list=products.filter(p=>(!params.get('cat')||p.category===params.get('cat'))&&
    (!q||[p.name,p.productCode,p.brand,p.model,p.description].join(' ').toLocaleLowerCase('es').includes(q))&&
    (!params.get('oferta')||p.offer)&&(!params.get('destacados')||p.featured)&&
    (!params.get('brand')||p.brand===params.get('brand'))&&(!params.get('max')||(Number.isFinite(max)&&max>=0&&p.price<=max)));
  if(params.get('sort')==='asc')list.sort((a,b)=>a.price-b.price);
  if(params.get('sort')==='desc')list.sort((a,b)=>b.price-a.price);
  if(params.get('sort')==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  return list;
}
export function reconcileCart(lines,products){
  const unique=new Map();
  for(const l of Array.isArray(lines)?lines:[]){if(products.some(p=>p.id===l?.id&&p.availability!=='unavailable')&&Number.isSafeInteger(l.qty)&&l.qty>0)unique.set(l.id,{id:l.id,qty:Math.min(l.qty,99)});}
  return [...unique.values()];
}
export function subtotal(lines,products){return reconcileCart(lines,products).reduce((sum,l)=>sum+products.find(p=>p.id===l.id).price*l.qty,0);}
export function assertCheckoutDisabled(){throw new Error('Compra no habilitada. No se crean pedidos ni pagos.');}
