// Informational estimates, never used to authorize checkout or issue tax documents.
export function estimateEconomics(price,cost,costTaxMode='unknown') {
 if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(cost)||cost<0)return null;
 const netSale=Math.round(price*100/119),vat=price-netSale;
 const netCost=costTaxMode==='gross'?Math.round(cost*100/119):costTaxMode==='net'?cost:null;
 const margin=netCost===null?null:netSale-netCost;
 return {netSale,vat,netCost,margin,marginPercent:margin===null?null:100*margin/netSale};
}
export function economicsText(price,cost,mode) {
 const e=estimateEconomics(price,cost,mode);if(!e)return '';
 const money=n=>'$'+n.toLocaleString('es-CL');
 return `Venta neta estimada: ${money(e.netSale)} · IVA incluido (19%): ${money(e.vat)}. `+(e.margin===null?'Indica si el costo incluye IVA para estimar el margen.':`Margen sobre venta neta: ${money(e.margin)} (${e.marginPercent.toFixed(1)}%). Antes de comisiones, despacho y otros gastos; no determina crédito fiscal.`);
}
