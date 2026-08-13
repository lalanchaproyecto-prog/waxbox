/*
  MARCA DE WAXBOX — PROVISIONAL.

  Esto NO es el logo definitivo. Es un marcador de posición dibujado en código
  mientras se define el diseño gráfico de verdad, y está pensado para que
  reemplazarlo sea cambiar solo este archivo: nadie más dibuja la marca.

  Está dibujado como SVG y no como imagen a propósito: se ve nítido en cualquier
  pantalla, se tiñe con el color del tema (usa `currentColor`), no pesa nada en
  el instalador y no hay que mantener una versión clara y otra oscura.

  PARA REEMPLAZARLO POR EL LOGO REAL:
  - Isotipo: cambia el contenido del <svg> de `Isotipo`.
  - Logo completo: cambia `LogoCompleto`, que hoy es el isotipo + el nombre
    escrito con la tipografía de la app.
*/

interface IsotipoProps {
  /** Tamaño en píxeles. Cuadrado. */
  size?: number
  className?: string
}

/**
 * El isotipo: un disco visto de frente.
 *
 * Los círculos concéntricos son los surcos; el centro es la etiqueta. Es lo más
 * genérico posible a propósito — se trata de ocupar el lugar de la marca, no de
 * proponer una.
 */
export function Isotipo({ size = 32, className }: IsotipoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Waxbox"
    >
      {/* El disco */}
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.14" />
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />

      {/* Los surcos */}
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="0.9" opacity="0.32" />
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="0.9" opacity="0.26" />
      <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="0.9" opacity="0.2" />

      {/* La etiqueta del centro */}
      <circle cx="24" cy="24" r="7.5" fill="currentColor" />
      <circle cx="24" cy="24" r="1.6" className="isotipo-hole" />

      {/* El brillo de la luz cayendo sobre el vinilo */}
      <path
        d="M9 15a22 22 0 0 1 16-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  )
}

interface LogoCompletoProps {
  /** Si se muestra el eslogan bajo el nombre. */
  conEslogan?: boolean
}

/**
 * El logo completo: isotipo más nombre.
 *
 * Solo aparece en la pantalla de carga del arranque. En el encabezado de la app
 * va únicamente el isotipo, para no repetir la marca en cada pantalla.
 */
export function LogoCompleto({ conEslogan = true }: LogoCompletoProps) {
  return (
    <div className="logo-completo">
      <Isotipo size={76} className="logo-completo-marca" />
      <div className="logo-completo-texto">
        <span className="logo-completo-nombre">Waxbox</span>
        {conEslogan && <span className="logo-completo-eslogan">Tu música, tu historia.</span>}
      </div>
      <span className="logo-placeholder-nota">logo provisional</span>
    </div>
  )
}
