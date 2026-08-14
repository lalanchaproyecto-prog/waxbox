import { IconBack } from './Icons'

interface PageHeaderProps {
  title: string
  /** Contexto en una línea: cuántos discos, qué se está filtrando, el estado. */
  subtitle?: string
  /** Las acciones de ESTA pantalla, alineadas a la derecha. */
  actions?: React.ReactNode
  /**
   * Solo para sub-páginas de verdad — la ficha de un disco, el detalle de un
   * setlist. Las secciones del menú NO llevan volver: ya están en el menú, y
   * un "volver" ahí solo agrega una salida que compite con la navegación.
   */
  onBack?: () => void
  backLabel?: string
}

/**
 * La cabecera que llevan todas las pantallas, siempre igual.
 *
 * Antes cada pantalla resolvía su encabezado por su cuenta: el título a veces
 * arriba y a veces después del botón de volver, las acciones a veces en la
 * cabecera y a veces al final del scroll, y ocho etiquetas distintas para
 * "volver". Tener una sola pieza es lo que hace que la app se sienta como una
 * app y no como una colección de pantallas.
 */
function PageHeader({ title, subtitle, actions, onBack, backLabel }: PageHeaderProps) {
  return (
    <header className="page-header">
      {onBack && (
        <button className="page-back" onClick={onBack}>
          <IconBack size={16} />
          <span>{backLabel ?? 'Volver'}</span>
        </button>
      )}

      <div className="page-header-row">
        <div className="page-header-text">
          <h2 className="page-title">{title}</h2>
          {subtitle && <p className="page-subtitle numeric">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  )
}

export default PageHeader
