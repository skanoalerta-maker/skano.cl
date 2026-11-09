// Cliente de pedidos de SKANO Store. No contiene claves ni lógica de precios: todo se valida en el servidor.
import {app, auth} from './store-firebase.js';
import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';
const fn = getFunctions(app, 'us-central1');
export const api = Object.freeze({
  status: httpsCallable(fn, 'getStoreCheckoutStatus'),
  quote: httpsCallable(fn, 'quoteStoreOrder'),
  create: httpsCallable(fn, 'createStoreOrder'),
  getOrder: httpsCallable(fn, 'getMyOrder'),
  myOrders: httpsCallable(fn, 'listMyOrders')
});
// Si el servidor no responde, la compra se considera deshabilitada (falla cerrada).
export async function getCheckoutStatus() {
  try { const r = await api.status(); return r.data?.enabled === true ? r.data : {enabled: false}; }
  catch { return {enabled: false}; }
}
export {auth};
export const STATUS_LABEL = Object.freeze({
  pending_payment: 'Pendiente de pago', paid: 'Pago confirmado', preparing: 'Preparando tu pedido', shipped: 'Despachado',
  delivered: 'Entregado', cancelled: 'Cancelado', expired: 'Vencido', refunded: 'Reembolsado', payment_review: 'Pago en revisión'
});
