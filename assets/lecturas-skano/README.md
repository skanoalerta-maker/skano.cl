# Imágenes de “SKANO EN ACCIÓN”

Esta carpeta contiene las imágenes que aparecen en la cinta de lecturas SKANO.

## Reemplazar las cinco imágenes iniciales

1. Exporta cada fotografía como JPG o WebP, idealmente a 1200 × 750 px.
2. Mantén cada archivo bajo 250 KB cuando sea posible.
3. Reemplaza `lectura-01.jpg` hasta `lectura-05.jpg` conservando los nombres.
4. No publiques patentes, rostros u otros datos identificables sin la autorización correspondiente.

## Agregar o quitar imágenes

Edita la lista `skanoReadings` ubicada al final de `professional.js`. Cada elemento contiene `src`, `alt` y `label`.

La cinta calcula automáticamente su velocidad y admite 5, 10, 15 o más imágenes. No es necesario duplicarlas manualmente: el código crea una segunda serie para producir el loop continuo.
