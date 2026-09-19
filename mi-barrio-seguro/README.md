# Mi Barrio Seguro

Página comercial interna de skano.cl: `/mi-barrio-seguro/`.

## Arquitectura revisada

El repositorio de skano.cl es el worktree `skano-repo`, cuyo remoto es
`https://github.com/skanoalerta-maker/skano.cl.git` y cuyo CNAME es `skano.cl`.
Es un sitio HTML/CSS/JS estático, con páginas internas por directorio. La portada
usa `professional.css` y `professional.js`; no tiene un sistema de componentes.
La aplicación Next/Vinext situada en el directorio padre es otro proyecto.

La nueva página reutiliza CSS corporativo, logo, cabecera y estructura del pie.
`barrio.css` contiene los estilos nuevos y no se carga en la portada. El JS propio
implementa el mismo menú y evita ejecutar la lógica de videos/galería de portada.
No se incorporaron dependencias. Los cambios preexistentes de `professional.js`,
el portal y los videos se conservaron.

## Archivos

- Modificado: `index.html` del repositorio: enlace en menú principal y pie.
- Nuevo: `mi-barrio-seguro/index.html`: contenido, SEO y formulario.
- Nuevo: `mi-barrio-seguro/barrio.css`: presentación y responsive.
- Nuevo: `mi-barrio-seguro/barrio.js`: navegación y preparación de correo.
- Nuevo: `assets/mi-barrio-seguro/lectura-demo.svg`: mockup vectorial local.
- Nuevo: `mi-barrio-seguro/README.md`: esta documentación.

## Probar localmente

Desde el directorio padre:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory skano-repo
```

Abrir `http://127.0.0.1:8765/mi-barrio-seguro/` y la portada en
`http://127.0.0.1:8765/`. No requiere npm build.

```powershell
node --check skano-repo/mi-barrio-seguro/barrio.js
git -C skano-repo diff --check
```

## Formulario y Firebase pendiente

El formulario prepara un `mailto:` a `skano.oficial@gmail.com`, coherente con el
contacto corporativo existente. No envía automáticamente, no guarda datos en el
navegador ni Firestore y no anuncia una recepción confirmada. Muestra el resumen
para copiarlo si el cliente de correo no abre o limita URLs largas. Los usuarios
deben enviar el correo. Se validan campos obligatorios, correo, teléfono con al
menos ocho dígitos, cantidades enteras, rangos, selecciones y longitudes; se recortan
espacios. Sin JavaScript el botón queda deshabilitado y se ofrece contacto por correo.

El portal de operaciones configura el proyecto `skano-app-e734d`, pero las reglas
Firestore y el código de sus Cloud Functions no están en esta copia. El formulario
antiguo de empresas contiene credenciales placeholder. La configuración de hosting
del directorio `firebase-portal-deploy` no incluye reglas de Firestore y corresponde
a otra carpeta de publicación. No se modificó ninguna de estas integraciones.

Antes de activar `neighborhood_service_requests`, revisar reglas reales y preparar
una recepción segura, preferiblemente una Cloud Function con validación del lado
servidor, límites de solicitudes y protección contra abuso. Esta necesidad se informó
antes de implementar; no se creó ni desplegó una función ni se habilitaron escrituras
anónimas. El acceso de lectura/administración debe quedar limitado a roles autorizados.

Contrato propuesto para dicha recepción:

| Campo | Tipo / límite |
| --- | --- |
| full_name | string, 3–100 caracteres |
| email | email válido, máximo 160 |
| phone | string, 8–24 caracteres, mínimo 8 dígitos |
| region | región de la lista permitida |
| comuna | string, 2–100 |
| community_type | opción permitida |
| community_name | string, 2–120 |
| estimated_homes | entero, 0–100000 |
| vehicle_access_points | entero, 1–1000 |
| has_cameras | boolean, convertir yes/no de la UI |
| has_connectivity | enum yes/no/unknown |
| requested_services | lista de opciones permitidas, máximo 8, sin duplicados |
| message | string opcional, máximo 2000 |
| status | `new`, asignado por servidor |
| created_at | timestamp de servidor |

Rechazar campos extra; no confiar en validación del navegador. Tras incorporar la
recepción, probar éxito, errores, abuso y permisos con emuladores antes de publicar.

## Validación realizada

- Sintaxis JavaScript y diff sin errores de formato.
- IDs únicos, un H1 por página y enlaces, anchors y assets locales existentes.
- Contenido de todas las secciones de la portada idéntico al original.
- Navegador: página nueva sin errores JavaScript; menú móvil abre y cierra al navegar.
- Anchos 320, 390, 768, 1024 y 1440 px sin desbordamiento horizontal del contenido.
- Formulario vacío inválido; formulario completo con datos ficticios válido;
  preparación de correo y resumen con los campos seleccionados, sin enviar mensajes.
- Casos de validación negativa y retorno desde la portada comprobados en navegador.
- Mockups estáticos: no consultan patentes, almacenan antecedentes ni activan alertas.

## Publicación

No se realizó deploy, push ni cambio de hosting. La carpeta es estática y no necesita
compilación. Al aprobar la publicación, incluir el HTML de portada actualizado, la
carpeta `mi-barrio-seguro` y el SVG nuevo junto a los assets existentes. Confirmar primero
qué canal de hosting sirve actualmente skano.cl: el CNAME/remoto identifican el sitio,
pero este checkout no contiene un workflow de publicación que permita asegurar su
destino operativo. No publicar las copias de staging del directorio padre por accidente.
