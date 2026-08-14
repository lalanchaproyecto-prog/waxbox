/*
  Íconos de la interfaz.

  Dibujados como SVG y no escritos como emoji a propósito: un emoji lo dibuja
  la fuente del sistema, así que cambia de forma entre Windows 10 y 11, no
  toma el color del tema y no se puede alinear con el texto de al lado. Para
  la navegación —donde el ícono es parte de la estructura y no un adorno— eso
  se nota como falta de acabado.

  Los emoji SÍ se quedan donde son contenido y no estructura: el 💿 de un
  formato es una etiqueta que la persona reconoce de un vistazo, y vive en
  `core/models/formats.ts` junto al resto de la definición del formato.

  Todos comparten caja de 24, trazo de 1.5 y `currentColor`, así que heredan
  el color de donde se pongan y se pueden escalar sin retocar nada.
*/

interface IconProps {
  size?: number
}

function Svg({ size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Inicio: un disco en su funda. */
export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </Svg>
  )
}

/** Colección: la cuadrícula de portadas. */
export function IconCollection(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </Svg>
  )
}

/** Setlists: una lista ordenada. */
export function IconSetlists(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </Svg>
  )
}

/** Deseos: lo que todavía no está en el estante. */
export function IconWishlist(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20.5 4.5 13a4.5 4.5 0 0 1 7.5-4.9A4.5 4.5 0 0 1 19.5 13Z" />
    </Svg>
  )
}

/** Préstamos: un disco que salió de casa. */
export function IconLoans(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 15V3" />
      <path d="m8 6.5 4-3.5 4 3.5" />
    </Svg>
  )
}

/** Agregar. */
export function IconAdd(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

/** Configuración. */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </Svg>
  )
}

/** Buscar. */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  )
}

/** Volver. */
export function IconBack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Svg>
  )
}

/** Vista de cuadrícula: las portadas. */
export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </Svg>
  )
}

/** Vista de tabla: los datos. */
export function IconTable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9.5h18M3 15h18M9 9.5V20" />
    </Svg>
  )
}

/** Quitar, cerrar. */
export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  )
}

/** Renombrar, editar un dato. */
export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  )
}

/** Poner o cambiar una imagen. */
export function IconImage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5-6.5 6.5" />
    </Svg>
  )
}

/** Borrar de verdad: sale de la base, no solo de la vista. */
export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6 7l1 13h10l1-13" />
    </Svg>
  )
}

/** Subir un puesto en una lista ordenada. */
export function IconUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 14 6-6 6 6" />
    </Svg>
  )
}

/** Bajar un puesto. */
export function IconDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 10 6 6 6-6" />
    </Svg>
  )
}

/**
 * El triángulo que indica si algo está desplegado.
 *
 * Es el MISMO ícono en los dos estados y gira con CSS: dos dibujos distintos
 * harían que el ojo tenga que reconocer una forma nueva en vez de seguir un
 * movimiento.
 */
export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  )
}

/** Exportar. */
export function IconExport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M12 3v13" />
      <path d="m7 11 5 5 5-5" />
    </Svg>
  )
}
