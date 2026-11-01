import {escapeHTML} from './core.js';
const photos={
  camaras:['security-collection','camera-outdoor'],
  alarmas:['keypad','security-collection'],
  panico:['wearable','keypad'],
  gps:['navigation','navigation'],
  audio:['speaker','speaker'],
  sensores:['camera','security-collection']
};
const descriptions={camaras:'Cámaras de seguridad',alarmas:'Panel de control de acceso',panico:'Dispositivo wearable',gps:'Navegación vehicular',audio:'Altavoz portátil',sensores:'Sensor de seguridad'};
export function art(category,variant=0){const file=(photos[category]||photos.camaras)[variant?1:0];return `<img class="catalog-photo photo-${file}" src="./assets/${file}.jpg" alt="${escapeHTML(descriptions[category]||'Tecnología de seguridad')}: fotografía de contexto, no corresponde al producto ficticio" loading="lazy" decoding="async" width="640" height="480">`;}
export const icons={
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
 heart:'<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 1 9 8 15 7-6 12-11 8-15Z"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
};
export const icon=name=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.grid}</svg>`;
