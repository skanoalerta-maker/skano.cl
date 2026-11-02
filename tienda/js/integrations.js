// Contracts only. No SDK, credentials, network calls, or real authentication.
export class UnavailableIntegration extends Error { constructor(service){super(`${service}: integración no conectada. Solo demostración.`);} }
const offline = name => async () => {throw new UnavailableIntegration(name);};
export const integrations = Object.freeze({auth:{signIn:offline('Firebase Authentication')},database:{save:offline('Firestore')},functions:{invoke:offline('Cloud Functions')},payments:{create:offline('Mercado Pago')},suppliers:{submit:offline('API proveedores')},tax:{issue:offline('DTE')},notifications:{send:offline('Notificaciones')},logistics:{track:offline('Seguimiento logístico')}});
