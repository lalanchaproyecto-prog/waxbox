/*
  LA MARCA DE MELÔFYLE.

  Este es el logo definitivo, no un marcador de posición. Los trazados salen
  del archivo original de diseño (`Documentos base/Logo`), así que esto es la
  misma forma que el PNG y el SVG que entregó el diseño — no una imitación
  hecha con una tipografía parecida.

  Va como SVG dibujado en código y no como imagen a propósito: se ve nítido en
  cualquier pantalla, pesa cien veces menos que un PNG, y —lo importante— las
  letras usan `currentColor`, así que el logotipo se lee igual sobre cartón
  claro que sobre fondo oscuro sin tener que mantener dos archivos.

  La ô es la única parte que NO sigue al texto: lleva siempre el rojo de la
  marca. Es el punto de color de la identidad, el mismo gesto que el punto
  naranja del referente, y no debe apagarse con el tema.
*/

import { APP_SLOGAN } from '@core/config'

/**
 * El rojo de la marca, tal cual viene del archivo de diseño.
 *
 * Está escrito aquí como valor fijo y no como token de CSS porque es el color
 * DEL LOGO, no del tema: si mañana la app cambiara de acento, la ô tendría que
 * seguir siendo esta.
 */
const ROJO_MARCA = '#fb3d2b'

/*
  El eslogan sale de `config.ts` y no escrito aquí a mano: había dos copias, y
  bastaba con cambiar una para que el arranque y el «Acerca de» dijeran cosas
  distintas.
*/

/**
 * Los trazados de la ô, sacados del logotipo original.
 *
 * Son dos formas en un solo trazado: el anillo de la o (con su contorno
 * interior, que es lo que la deja hueca) y el acento circunflejo de encima.
 */
const O_ACENTUADA =
  'M347.09,82.43c0,31.06-21.52,44.6-41.82,44.6-22.73,0-40.26-16.66-40.26-43.21,0-28.11,18.4-44.6,41.65-44.6s40.43,17.53,40.43,43.21Zm-66.64,.87c0,18.4,10.59,32.28,25.51,32.28s25.51-13.71,25.51-32.63c0-14.23-7.12-32.28-25.16-32.28s-25.86,16.66-25.86,32.63ZM311.17,4.86l16.66,24.82h-11.8l-10.07-16.49h-.35l-10.06,16.49h-11.28l16.31-24.82h10.59Z'

interface IsotipoProps {
  /** Tamaño en píxeles. Cuadrado. */
  size?: number
  className?: string
}

/**
 * El isotipo: la ô sola.
 *
 * Cuando la marca no cabe entera —el menú lateral, el icono del programa, una
 * pestaña— se recorta a su letra distintiva. La ô es lo único del logotipo que
 * no podría pertenecer a ninguna otra palabra, así que es la parte que sigue
 * identificando a Melôfyle cuando se queda sola.
 *
 * El `viewBox` está calculado sobre la caja real del trazado dentro del
 * logotipo completo (x 265,01 · y 4,86 · 82,08 × 122,17), centrada en un
 * cuadrado con aire alrededor. Por eso los números no son redondos: recortan
 * la letra exactamente donde termina la tinta.
 */
export function Isotipo({ size = 32, className }: IsotipoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="227.85 -12.25 156.4 156.4"
      fill="none"
      role="img"
      aria-label="Melôfyle"
    >
      <path d={O_ACENTUADA} fill={ROJO_MARCA} />
    </svg>
  )
}

interface LogotipoProps {
  /** Alto en píxeles. El ancho sale solo, por proporción. */
  alto?: number
  className?: string
}

/**
 * El logotipo completo: la palabra «Melôfyle».
 *
 * Las letras heredan el color del texto de alrededor y la ô se queda roja.
 */
export function Logotipo({ alto = 28, className }: LogotipoProps) {
  return (
    <svg
      className={className}
      height={alto}
      viewBox="0 0 607.76 163.48"
      fill="none"
      role="img"
      aria-label="Melôfyle"
      style={{ width: 'auto' }}
    >
      <g fill="currentColor">
        {/* M */}
        <path d="M101.69,73.75c-.87-16.31-1.91-35.92-1.74-50.5h-.52c-3.99,13.71-8.85,28.29-14.75,44.43l-20.65,56.75h-11.45l-18.92-55.71c-5.55-16.49-10.24-31.58-13.54-45.47h-.35c-.35,14.58-1.22,34.19-2.26,51.71l-3.12,50.15H0L8.16,8.16H27.42l19.96,56.57c4.86,14.4,8.85,27.25,11.8,39.39h.52c2.95-11.8,7.12-24.64,12.32-39.39L92.84,8.16h19.26l7.29,116.97h-14.75l-2.95-51.37Z" />
        {/* e */}
        <path d="M151.68,85.9c.35,20.65,13.54,29.15,28.81,29.15,10.93,0,17.53-1.91,23.25-4.34l2.6,10.93c-5.38,2.43-14.58,5.21-27.94,5.21-25.86,0-41.3-17.01-41.3-42.34s14.92-45.29,39.39-45.29c27.42,0,34.71,24.12,34.71,39.57,0,3.12-.35,5.55-.52,7.12h-59Zm44.77-10.93c.17-9.72-3.99-24.82-21.17-24.82-15.44,0-22.21,14.23-23.43,24.82h44.6Z" />
        {/* l */}
        <path d="M230.13,1.91h15.27V125.12h-15.27V1.91Z" />
        {/* f */}
        <path d="M367.92,125.12V52.76h-11.8v-11.63h11.8v-3.99c0-11.8,2.6-22.56,9.72-29.33,5.73-5.55,13.36-7.81,20.48-7.81,5.38,0,10.07,1.22,13.02,2.43l-2.08,11.8c-2.26-1.04-5.38-1.91-9.72-1.91-13.02,0-16.31,11.45-16.31,24.3v4.51h20.31v11.63h-20.31V125.12h-15.1Z" />
        {/* y */}
        <path d="M422.59,41.13l18.4,49.63c1.91,5.55,3.99,12.15,5.38,17.18h.35c1.56-5.03,3.3-11.45,5.38-17.53l16.66-49.29h16.14l-22.91,59.87c-10.93,28.81-18.4,43.56-28.81,52.58-7.46,6.59-14.92,9.2-18.74,9.89l-3.82-12.84c3.82-1.21,8.85-3.64,13.36-7.46,4.17-3.3,9.37-9.2,12.84-17.01,.7-1.56,1.21-2.78,1.21-3.64s-.35-2.08-1.04-3.99l-31.06-77.4h16.66Z" />
        {/* l */}
        <path d="M498.78,1.91h15.27V125.12h-15.27V1.91Z" />
        {/* e */}
        <path d="M548.24,85.9c.35,20.65,13.54,29.15,28.81,29.15,10.93,0,17.53-1.91,23.25-4.34l2.6,10.93c-5.38,2.43-14.58,5.21-27.94,5.21-25.86,0-41.3-17.01-41.3-42.34s14.93-45.29,39.39-45.29c27.42,0,34.71,24.12,34.71,39.57,0,3.12-.35,5.55-.52,7.12h-59.01Zm44.77-10.93c.17-9.72-3.99-24.82-21.17-24.82-15.44,0-22.21,14.23-23.43,24.82h44.6Z" />
      </g>
      {/* La ô: el punto de color de la marca. No sigue al tema. */}
      <path d={O_ACENTUADA} fill={ROJO_MARCA} />
    </svg>
  )
}

interface LogoCompletoProps {
  /** Si se muestra el eslogan bajo el nombre. */
  conEslogan?: boolean
}

/**
 * Logotipo más eslogan, apilados.
 *
 * Solo aparece en la pantalla de carga del arranque. En el menú de la app va
 * únicamente el isotipo, para no repetir la marca en cada pantalla.
 */
export function LogoCompleto({ conEslogan = true }: LogoCompletoProps) {
  return (
    <div className="logo-completo">
      <Logotipo alto={56} className="logo-completo-marca" />
      {conEslogan && <span className="logo-completo-eslogan">{APP_SLOGAN}</span>}
    </div>
  )
}
