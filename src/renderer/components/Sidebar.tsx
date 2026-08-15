import type { CollectionSummary } from '@core/database/db'
import type { Profile } from '@core/models/profile'
import type { FeatureFlags } from '@core/models/features'
import { imageIcon } from '@core/models/imageRef'
import CollectionBar from './CollectionBar'
import { Logotipo } from './Logo'
import {
  IconAdd,
  IconCollection,
  IconHome,
  IconLoans,
  IconSearch,
  IconSettings,
  IconSetlists,
  IconWishlist
} from './Icons'

/** Las secciones que viven en el menú. No incluye sub-páginas ni tareas. */
export type Section = 'home' | 'collection' | 'setlists' | 'wishlist' | 'loans'

interface SidebarProps {
  profile: Profile
  onSignOut: () => void

  collections: CollectionSummary[]
  activeCollectionId: number
  onSwitchCollection: (collectionId: number) => void
  onCollectionsChanged: (activeIdHint?: number) => void

  /** Qué sección está abierta. Null cuando se está en una tarea o en ajustes. */
  section: Section | null
  onNavigate: (section: Section) => void

  counts: {
    albums: number
    setlists: number
    wishlist: number
    loans: number
  }

  features: FeatureFlags
  onAdd: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  settingsActive: boolean
}

/**
 * El menú principal, siempre visible.
 *
 * Antes la navegación estaba repartida entre la cabecera, el pie, el final
 * del scroll del inicio y la cabecera de cada pantalla, con ocho etiquetas
 * distintas para "volver". Aquí están las cinco secciones reales, en el mismo
 * sitio en todas las pantallas, marcando siempre dónde estás.
 *
 * El perfil y la colección van juntos arriba porque responden a la misma
 * pregunta —de quién y de cuál colección estamos hablando— y antes eran dos
 * mecanismos separados en la misma cabecera.
 */
function Sidebar({
  profile,
  onSignOut,
  collections,
  activeCollectionId,
  onSwitchCollection,
  onCollectionsChanged,
  section,
  onNavigate,
  counts,
  features,
  onAdd,
  onOpenSettings,
  onOpenSearch,
  settingsActive
}: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Menú principal">
      {/*
        La marca, una sola vez y arriba del todo.

        No es decoración ni un botón: es lo que contesta «¿en qué programa
        estoy?» de un vistazo. Va sobre el perfil porque la app contiene a la
        persona, no al revés.
      */}
      <div className="sidebar-marca">
        <Logotipo alto={22} />
      </div>

      <div className="sidebar-identity">
        <button
          className="profile-block"
          onClick={onSignOut}
          title="Cambiar de perfil"
        >
          <span className="profile-block-emoji" aria-hidden="true">
            {imageIcon(profile.image ?? null) ?? profile.emoji}
          </span>
          <span className="profile-text">
            <span className="profile-name">{profile.name}</span>
            <span className="profile-switch">Cambiar de perfil</span>
          </span>
        </button>

        <CollectionBar
          collections={collections}
          activeId={activeCollectionId}
          onSwitch={onSwitchCollection}
          onChanged={onCollectionsChanged}
        />
      </div>

      <button className="sidebar-search" onClick={onOpenSearch}>
        <IconSearch size={16} />
        <span>Buscar</span>
        <kbd className="sidebar-kbd">Ctrl K</kbd>
      </button>

      <ul className="sidebar-nav">
        <NavItem
          icon={<IconHome />}
          label="Inicio"
          active={section === 'home'}
          onClick={() => onNavigate('home')}
        />
        <NavItem
          icon={<IconCollection />}
          label="Colección"
          badge={counts.albums}
          active={section === 'collection'}
          onClick={() => onNavigate('collection')}
        />
        {features.setlists && (
          <NavItem
            icon={<IconSetlists />}
            label="Setlists"
            badge={counts.setlists}
            active={section === 'setlists'}
            onClick={() => onNavigate('setlists')}
          />
        )}
        {features.wishlist && (
          <NavItem
            icon={<IconWishlist />}
            label="Deseos"
            badge={counts.wishlist}
            active={section === 'wishlist'}
            onClick={() => onNavigate('wishlist')}
          />
        )}
        {features.loans && (
          <NavItem
            icon={<IconLoans />}
            label="Préstamos"
            badge={counts.loans}
            alert={counts.loans > 0}
            active={section === 'loans'}
            onClick={() => onNavigate('loans')}
          />
        )}
      </ul>

      <div className="sidebar-foot">
        <button className="sidebar-add" onClick={onAdd}>
          <IconAdd size={18} />
          <span>Agregar disco</span>
        </button>
        <button
          className={`sidebar-item sidebar-settings${settingsActive ? ' active' : ''}`}
          onClick={onOpenSettings}
        >
          <IconSettings />
          <span className="sidebar-label">Configuración</span>
        </button>
      </div>
    </nav>
  )
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  badge?: number
  alert?: boolean
  active: boolean
  onClick: () => void
}

function NavItem({ icon, label, badge, alert, active, onClick }: NavItemProps) {
  return (
    <li>
      <button
        className={`sidebar-item${active ? ' active' : ''}`}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        <span className="sidebar-label">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`sidebar-badge${alert ? ' alert' : ''} numeric`}>{badge}</span>
        )}
      </button>
    </li>
  )
}

export default Sidebar
