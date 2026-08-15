/*
  LA MARCA, EN LOS DOCUMENTOS QUE SALEN DE LA APP.

  Un PDF exportado se manda por correo, se imprime, se enseña al seguro o al
  comprador. Es lo único de Melôfyle que va a ver gente que no tiene la app
  instalada, así que tiene que verse como la app: mismo logotipo, mismo rojo,
  misma mono para los datos de catálogo.

  Antes estos documentos salían en morado, que era el color de una versión
  anterior de la app y ya no existe en ninguna pantalla.

  POR QUÉ EL LOGO VA COMO SVG EN LÍNEA Y NO COMO IMAGEN:

  El PDF se maqueta en HTML y se imprime con Chromium. Un SVG escrito dentro
  del documento no necesita cargarse de ningún sitio —ni de disco ni de red—
  así que no hay forma de que la impresión salga sin logo por una carrera
  entre la carga de la imagen y el momento de imprimir. Además sale nítido a
  cualquier tamaño, que en papel se nota.

  Los trazados son los mismos que usa `Logo.tsx` en la interfaz.
*/

/** El rojo de la marca. El mismo `--accent` de la app. */
export const ROJO = '#fb3d2b'

/** El rojo oscurecido, para texto pequeño. El mismo `--accent-link`. */
export const ROJO_TEXTO = '#b32a19'

/** Casi negro: el color de los marcos y los títulos. */
export const TINTA = '#1e1f23'

const O_ACENTUADA =
  'M347.09,82.43c0,31.06-21.52,44.6-41.82,44.6-22.73,0-40.26-16.66-40.26-43.21,0-28.11,18.4-44.6,41.65-44.6s40.43,17.53,40.43,43.21Zm-66.64,.87c0,18.4,10.59,32.28,25.51,32.28s25.51-13.71,25.51-32.63c0-14.23-7.12-32.28-25.16-32.28s-25.86,16.66-25.86,32.63ZM311.17,4.86l16.66,24.82h-11.8l-10.07-16.49h-.35l-10.06,16.49h-11.28l16.31-24.82h10.59Z'

const LETRAS = [
  'M101.69,73.75c-.87-16.31-1.91-35.92-1.74-50.5h-.52c-3.99,13.71-8.85,28.29-14.75,44.43l-20.65,56.75h-11.45l-18.92-55.71c-5.55-16.49-10.24-31.58-13.54-45.47h-.35c-.35,14.58-1.22,34.19-2.26,51.71l-3.12,50.15H0L8.16,8.16H27.42l19.96,56.57c4.86,14.4,8.85,27.25,11.8,39.39h.52c2.95-11.8,7.12-24.64,12.32-39.39L92.84,8.16h19.26l7.29,116.97h-14.75l-2.95-51.37Z',
  'M151.68,85.9c.35,20.65,13.54,29.15,28.81,29.15,10.93,0,17.53-1.91,23.25-4.34l2.6,10.93c-5.38,2.43-14.58,5.21-27.94,5.21-25.86,0-41.3-17.01-41.3-42.34s14.92-45.29,39.39-45.29c27.42,0,34.71,24.12,34.71,39.57,0,3.12-.35,5.55-.52,7.12h-59Zm44.77-10.93c.17-9.72-3.99-24.82-21.17-24.82-15.44,0-22.21,14.23-23.43,24.82h44.6Z',
  'M230.13,1.91h15.27V125.12h-15.27V1.91Z',
  'M367.92,125.12V52.76h-11.8v-11.63h11.8v-3.99c0-11.8,2.6-22.56,9.72-29.33,5.73-5.55,13.36-7.81,20.48-7.81,5.38,0,10.07,1.22,13.02,2.43l-2.08,11.8c-2.26-1.04-5.38-1.91-9.72-1.91-13.02,0-16.31,11.45-16.31,24.3v4.51h20.31v11.63h-20.31V125.12h-15.1Z',
  'M422.59,41.13l18.4,49.63c1.91,5.55,3.99,12.15,5.38,17.18h.35c1.56-5.03,3.3-11.45,5.38-17.53l16.66-49.29h16.14l-22.91,59.87c-10.93,28.81-18.4,43.56-28.81,52.58-7.46,6.59-14.92,9.2-18.74,9.89l-3.82-12.84c3.82-1.21,8.85-3.64,13.36-7.46,4.17-3.3,9.37-9.2,12.84-17.01,.7-1.56,1.21-2.78,1.21-3.64s-.35-2.08-1.04-3.99l-31.06-77.4h16.66Z',
  'M498.78,1.91h15.27V125.12h-15.27V1.91Z',
  'M548.24,85.9c.35,20.65,13.54,29.15,28.81,29.15,10.93,0,17.53-1.91,23.25-4.34l2.6,10.93c-5.38,2.43-14.58,5.21-27.94,5.21-25.86,0-41.3-17.01-41.3-42.34s14.93-45.29,39.39-45.29c27.42,0,34.71,24.12,34.71,39.57,0,3.12-.35,5.55-.52,7.12h-59.01Zm44.77-10.93c.17-9.72-3.99-24.82-21.17-24.82-15.44,0-22.21,14.23-23.43,24.82h44.6Z'
]

/**
 * El logotipo completo, para la cabecera del documento.
 *
 * @param alto Alto en puntos. El ancho sale por proporción.
 */
export function logotipoSvg(alto = 26): string {
  const letras = LETRAS.map((d) => `<path d="${d}"/>`).join('')
  return `<svg height="${alto}pt" viewBox="0 0 607.76 163.48" xmlns="http://www.w3.org/2000/svg" style="width:auto">
    <g fill="${TINTA}">${letras}</g>
    <path d="${O_ACENTUADA}" fill="${ROJO}"/>
  </svg>`
}

/**
 * De quién es esta colección y cuándo se sacó el documento.
 *
 * Va en el PDF porque estos papeles salen de la app y circulan solos: sin el
 * nombre y la fecha, un listado de discos impreso no dice de quién es ni si
 * está al día, que es justo lo que hace falta saber cuando lo recibe un
 * seguro, un comprador o un familiar.
 */
export interface ContextoDocumento {
  /** El perfil que exporta. */
  perfil: string
  /** La colección de la que salen los datos. */
  coleccion: string
}
