import {app} from './store-firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
import {normalizeCategories,publicCatalog} from './public-catalog.js';
const requestCatalog=httpsCallable(getFunctions(app,'us-central1'),'listPublicStoreProducts',{timeout:12000});
// One server projection from store_public_products. No private collection reads in public routes.
export function observeCatalog(onState){
 let closed=false,busy=false,last='',interval;
 async function refresh(){
  if(closed||busy)return;busy=true;
  try{const r=await requestCatalog();if(closed)return;const categories=normalizeCategories(r.data?.categories||[]),products=publicCatalog(r.data?.products||[],categories);const signature=JSON.stringify({products,categories});if(signature!==last){last=signature;onState({status:'ready',products,categories});}}
  catch{last='';if(!closed)onState({status:'error',products:[],categories:[]});}finally{busy=false;}
 }
 const focused=()=>{if(document.visibilityState==='visible')refresh();};
 onState({status:'loading',products:[],categories:[]});refresh();
 interval=setInterval(focused,30000);document.addEventListener('visibilitychange',focused);window.addEventListener('store-categories-updated',refresh);
 return ()=>{closed=true;clearInterval(interval);document.removeEventListener('visibilitychange',focused);window.removeEventListener('store-categories-updated',refresh);};
}
