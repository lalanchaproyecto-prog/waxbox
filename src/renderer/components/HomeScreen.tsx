import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CollectionStats, ActiveLoan } from '@core/database/db'
import type { DashboardData } from '@core/database/dashboard'
import { getFormat } from '@core/models/formats'
import { loanStatus, today } from '@core/models/loan'
import { conditionLabel } from '@core/models/condition'
import PageHeader from './PageHeader'
import type { SmartCriteria, SmartList } from '@core/models/smartList'

interface HomeScreenProps {
  collectionId: number
  collectionName: string
  onOpenAlbum: (albumId: number) => void
  onOpenLoans: () => void
  /** Abre la colección viendo esa lista, con sus condiciones aplicadas. */
  onOpenLista: (lista: SmartList) => void
  onAdd: () => void
}

/**
 * Los módulos del inicio, en el orden que trae de fábrica.
 *
 * El orden por omisión no es arbitrario: arriba lo que se decide a diario
 * (qué escuchar), después lo que pide acción (préstamos, salud), y al final
 * lo que se mira de vez en cuando (compras, décadas).
 */
const MODULOS = [
  { id: 'tonight', label: '¿Qué escucho hoy?' },
  { id: 'racha', label: 'Racha de catalogación' },
  { id: 'olvidados', label: 'No lo escuchas hace tiempo' },
  { id: 'recientes', label: 'Últimas incorporaciones' },
  { id: 'hitos', label: 'Hitos' },
  { id: 'efemerides', label: 'Aniversarios' },
  { id: 'formatos', label: 'Por formato' },
  { id: 'generos', label: 'Géneros' },
  { id: 'decadas', label: 'Por década' },
  { id: 'listas', label: 'Mis listas' },
  { id: 'salud', label: 'Salud de la colección' },
  { id: 'compras', label: 'Dónde compras' }
] as const

type ModuloId = (typeof MODULOS)[number]['id']

/**
 * Traduce los fallos crípticos del puente a algo accionable.
 *
 * "No handler registered" no es un error de la colección ni de los datos: es
 * que el proceso principal de Electron sigue siendo el de antes del cambio.
 * El renderer se recarga solo al guardar un archivo, pero el proceso
 * principal no, así que la ventana queda pidiéndole algo que su mitad
 * de atrás todavía no sabe hacer.
 */
function explicarFallo(mensaje: string): string {
  if (mensaje.includes('No handler registered')) {
    return (
      'La app está a medio actualizar: la ventana ya tiene los paneles nuevos, pero el ' +
      'proceso de fondo todavía es el anterior y no sabe responderlos. Cierra Waxbox por ' +
      'completo y vuelve a abrirla (si la ejecutas con «npm run dev», detén el comando con ' +
      'Ctrl+C y arráncalo otra vez).'
    )
  }
  return mensaje
}

function ordenKey(collectionId: number): string {
  return `waxbox-home-orden-${collectionId}`
}

function cargarOrden(collectionId: number): ModuloId[] {
  const validos = MODULOS.map((m) => m.id)
  try {
    const raw = localStorage.getItem(ordenKey(collectionId))
    if (!raw) return [...validos]
    const guardado = JSON.parse(raw) as string[]
    // Se filtra contra la lista real y se suman los que falten: así, agregar
    // un módulo nuevo en una versión futura no lo deja invisible para quien
    // ya tenía un orden guardado.
    const conocidos = guardado.filter((id): id is ModuloId =>
      (validos as string[]).includes(id)
    )
    const faltantes = validos.filter((id) => !conocidos.includes(id))
    return [...conocidos, ...faltantes]
  } catch {
    return [...validos]
  }
}

function ocultosKey(collectionId: number): string {
  return `waxbox-home-ocultos-${collectionId}`
}

/**
 * Qué paneles decidió NO ver.
 *
 * Se guarda la lista de ocultos y no la de visibles a propósito: así, un
 * panel nuevo en una versión futura aparece por omisión en vez de quedarse
 * escondido para quien ya había guardado su selección.
 */
function cargarOcultos(collectionId: number): ModuloId[] {
  const validos = MODULOS.map((m) => m.id) as string[]
  try {
    const raw = localStorage.getItem(ocultosKey(collectionId))
    if (!raw) return []
    const guardado = JSON.parse(raw) as string[]
    return guardado.filter((id): id is ModuloId => validos.includes(id))
  } catch {
    return []
  }
}

function HomeScreen({
  collectionId,
  collectionName,
  onOpenAlbum,
  onOpenLoans,
  onOpenLista,
  onAdd
}: HomeScreenProps) {
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loans, setLoans] = useState<ActiveLoan[]>([])
  const [errorStats, setErrorStats] = useState<string | null>(null)
  const [errorPaneles, setErrorPaneles] = useState<string | null>(null)
  const [orden, setOrden] = useState<ModuloId[]>(() => cargarOrden(collectionId))
  const [ocultos, setOcultos] = useState<ModuloId[]>(() => cargarOcultos(collectionId))
  const [ordenando, setOrdenando] = useState(false)

  /*
    Cada llamada se resuelve por su cuenta.

    Antes iban las tres juntas en un `Promise.all` y la pantalla no se
    dibujaba hasta tenerlas todas: bastaba con que una fallara para dejar el
    inicio completamente en blanco, sin decir por qué. Ahora los paneles que
    sí tienen datos se muestran igual y el fallo se cuenta donde ocurrió.
  */
  const load = useCallback(async () => {
    const ahora = new Date()

    window.api.collectionStats(collectionId).then((res) => {
      if (res.ok) setStats(res.data)
      else setErrorStats(res.error)
    })

    window.api.activeLoans(collectionId).then((res) => {
      if (res.ok) setLoans(res.data)
    })

    /*
      La comprobación de que el método existe no es paranoia: `dashboardData`
      se agregó al puente después, y una ventana que quedó abierta desde
      antes sigue con el puente viejo cargado. Sin esto, la llamada revienta
      con "no es una función" y se lleva por delante toda la pantalla.
    */
    if (typeof window.api.dashboardData !== 'function') {
      setErrorPaneles(
        'Los paneles nuevos necesitan reiniciar la app: la ventana abierta todavía tiene la versión anterior del puente interno.'
      )
      return
    }

    try {
      const res = await window.api.dashboardData(collectionId, today(), ahora.getFullYear())
      if (res.ok) setData(res.data)
      else setErrorPaneles(res.error)
    } catch (error) {
      setErrorPaneles(explicarFallo(String(error)))
    }
  }, [collectionId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setOrden(cargarOrden(collectionId))
    setOcultos(cargarOcultos(collectionId))
  }, [collectionId])

  function guardarOrden(nuevo: ModuloId[]) {
    setOrden(nuevo)
    localStorage.setItem(ordenKey(collectionId), JSON.stringify(nuevo))
  }

  function alternarVisible(id: ModuloId) {
    const nuevo = ocultos.includes(id) ? ocultos.filter((x) => x !== id) : [...ocultos, id]
    setOcultos(nuevo)
    localStorage.setItem(ocultosKey(collectionId), JSON.stringify(nuevo))
  }

  function mover(id: ModuloId, delta: number) {
    const i = orden.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= orden.length) return
    const copia = [...orden]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    guardarOrden(copia)
  }

  function spin() {
    window.api.collectionStats(collectionId).then((res) => {
      if (res.ok) setStats(res.data)
    })
  }

  const numero = useCallback((valor: number) => valor.toLocaleString('es-CL'), [])

  const atrasados = useMemo(
    () => loans.filter((loan) => loanStatus(loan).tone === 'tarde').length,
    [loans]
  )

  /*
    Solo se espera por los totales, que son lo que decide si hay colección.
    Si además fallan, se dice — antes esto devolvía null y el inicio quedaba
    en blanco sin ninguna explicación.
  */
  if (!stats) {
    if (!errorStats) return null
    return (
      <div className="screen">
        <PageHeader title={collectionName} />
        <div className="empty-state">
          <p className="empty-state-title">No se pudo leer esta colección.</p>
          <p className="empty-state-help">{errorStats}</p>
        </div>
      </div>
    )
  }

  if (stats.totalAlbums === 0) {
    return (
      <div className="screen">
        <PageHeader title={collectionName} />
        <div className="empty-state">
          <p className="empty-state-title">Esta colección está vacía.</p>
          <p className="empty-state-help">
            Agrega tu primer disco, casete o CD. Waxbox completa el año, el sello y el
            tracklist por ti.
          </p>
          <button className="btn btn-primary" onClick={onAdd} style={{ alignSelf: 'flex-start' }}>
            Agregar disco
          </button>
        </div>
      </div>
    )
  }

  /** Cada módulo devuelve su tarjeta, o null si no tiene nada que mostrar. */
  const paneles: Record<ModuloId, React.ReactNode> = {
    tonight: stats.randomAlbum ? (
      <Card key="tonight" id="tonight" ancho titulo="¿Qué escucho hoy?" {...ctl('tonight')}>
        <div className="tonight">
          <div className="tonight-object">
            <div className="ficha-sleeve">
              {stats.randomAlbum.format !== 'casete' && (
                <span className="tonight-disc-wrap" aria-hidden="true">
                  <span className={`disc${stats.randomAlbum.format === 'cd' ? ' disc-cd' : ''}`} />
                </span>
              )}
              {coverSrc(stats.randomAlbum) ? (
                <img
                  className="ficha-cover"
                  src={coverSrc(stats.randomAlbum)!}
                  alt={`Portada de ${stats.randomAlbum.title}`}
                />
              ) : (
                <div className="ficha-cover ficha-cover-missing">
                  <span>Sin portada</span>
                </div>
              )}
            </div>
          </div>
          <div className="tonight-info">
            <p className="tonight-hora">{saludoPorHora()}</p>
            <h4 className="tonight-title">{stats.randomAlbum.title}</h4>
            <p className="tonight-artist">{stats.randomAlbum.artists}</p>
            <p className="tonight-meta numeric">
              {getFormat(stats.randomAlbum.format)?.label ?? stats.randomAlbum.format}
              {stats.randomAlbum.year ? ` · ${stats.randomAlbum.year}` : ''}
              {` · ${stats.randomAlbum.trackCount} ${
                stats.randomAlbum.trackCount === 1 ? 'canción' : 'canciones'
              }`}
            </p>
            <div className="tonight-actions">
              <button
                className="btn btn-primary"
                onClick={() => onOpenAlbum(stats.randomAlbum!.id)}
              >
                Abrir la ficha
              </button>
              <button className="btn btn-ghost" onClick={spin}>
                Otra sugerencia
              </button>
            </div>
          </div>
        </div>
      </Card>
    ) : null,

    racha: data ? (
      <Card key="racha" id="racha" titulo="Racha de catalogación" {...ctl('racha')}>
        <p className="racha-cifra numeric">{data.racha.actual}</p>
        <p className="racha-nota">
          {data.racha.actual === 0
            ? 'Sin racha ahora mismo. Agrega un disco para empezar una.'
            : `${data.racha.actual === 1 ? 'día seguido' : 'días seguidos'} catalogando${
                data.racha.hoyCuenta ? '' : ' — agrega algo hoy para no cortarla'
              }`}
        </p>
        {data.racha.mejor > 0 && (
          <p className="racha-mejor numeric">Tu mejor racha: {data.racha.mejor} días</p>
        )}
      </Card>
    ) : null,

    olvidados:
      data && data.olvidados.length > 0 ? (
        <Card
          key="olvidados"
          id="olvidados"
          titulo="No lo escuchas hace tiempo"
          {...ctl('olvidados')}
        >
          <ul className="mini-list">
            {data.olvidados.map((album) => (
              <li key={album.id}>
                <button className="mini-row" onClick={() => onOpenAlbum(album.id)}>
                  {coverSrc(album) ? (
                    <img className="mini-cover" src={coverSrc(album)!} alt="" loading="lazy" />
                  ) : (
                    <span className="mini-cover mini-cover-empty" aria-hidden="true">
                      {getFormat(album.format)?.icon ?? '🎵'}
                    </span>
                  )}
                  <span className="mini-text">
                    <span className="mini-title">{album.title}</span>
                    <span className="mini-sub">{album.artists}</span>
                  </span>
                  <span className="mini-tag numeric">
                    {album.ultimaEscucha ? fechaCorta(album.ultimaEscucha) : 'Nunca'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null,

    recientes:
      stats.recentAlbums.length > 0 ? (
        <Card
          key="recientes"
          id="recientes"
          ancho
          titulo="Últimas incorporaciones"
          {...ctl('recientes')}
        >
          <div className="home-recent-grid">
            {stats.recentAlbums.map((album) => (
              <button
                key={album.id}
                className="album-card"
                onClick={() => onOpenAlbum(album.id)}
                data-format={album.format}
              >
                <span className="album-card-sleeve">
                  <span className="album-card-disc" aria-hidden="true" />
                  <span className="album-card-cover">
                    {coverSrc(album) ? (
                      <img src={coverSrc(album)!} alt={`Portada de ${album.title}`} loading="lazy" />
                    ) : (
                      <span className="album-card-placeholder" aria-hidden="true">
                        {getFormat(album.format)?.icon ?? '🎵'}
                      </span>
                    )}
                  </span>
                </span>
                <span className="album-card-info">
                  <span className="album-card-title">{album.title}</span>
                  <span className="album-card-artist">{album.artists}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null,

    hitos:
      data && data.hitos.length > 0 ? (
        <Card key="hitos" id="hitos" titulo="Hitos" {...ctl('hitos')}>
          <ul className="hitos">
            {data.hitos.map((hito) => (
              <li key={hito.id} className={`hito${hito.logrado ? '' : ' hito-pendiente'}`}>
                <span className="hito-titulo">{hito.titulo}</span>
                <span className="hito-detalle">{hito.detalle}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null,

    efemerides:
      data && data.efemerides.length > 0 ? (
        <Card key="efemerides" id="efemerides" titulo="Aniversarios este año" {...ctl('efemerides')}>
          <ul className="mini-list">
            {data.efemerides.map((e) => (
              <li key={e.albumId}>
                <button className="mini-row" onClick={() => onOpenAlbum(e.albumId)}>
                  <span className="efemeride-anos numeric">{e.aniversario}</span>
                  <span className="mini-text">
                    <span className="mini-title">{e.title}</span>
                    <span className="mini-sub">
                      {e.artists} · {e.year}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null,

    formatos:
      stats.byFormat.length > 0 ? (
        <Card key="formatos" id="formatos" titulo="Por formato" {...ctl('formatos')}>
          <p className="card-nota">Cada disco tiene un formato, así que suman 100%.</p>
          <ul className="meters">
            {stats.byFormat.map(({ format, count }) => {
              const pct = (count / stats.totalAlbums) * 100
              return (
                <Meter
                  key={format}
                  label={getFormat(format)?.label ?? format}
                  fill={pct}
                  value={`${numero(count)} · ${Math.round(pct)}%`}
                />
              )
            })}
          </ul>
        </Card>
      ) : null,

    generos:
      data && data.generos.length > 0 ? (
        <Card key="generos" id="generos" titulo="Géneros" {...ctl('generos')}>
          <p className="card-nota">
            De cada 100 discos, cuántos son de este género. Un disco puede tener varios, así
            que la suma pasa de 100.
          </p>
          <ul className="meters">
            {data.generos.map((g) => (
              <Meter
                key={g.genre}
                label={g.genre}
                fill={g.pct}
                value={`${Math.round(g.pct)}% · ${numero(g.count)}`}
              />
            ))}
          </ul>
        </Card>
      ) : null,

    decadas:
      data && data.decadas.length > 0 ? (
        <Card key="decadas" id="decadas" ancho titulo="Por década" {...ctl('decadas')}>
          <Decadas datos={data.decadas} />
        </Card>
      ) : null,

    /*
      Listas inteligentes: filtros guardados que se recalculan al mirarlos.

      El número que se ve NO es el de cuando se creó la lista: se cuenta cada
      vez, sobre los discos que hay ahora. Por eso una lista puede crecer sola
      con un disco que compres mañana.
    */
    listas: data ? (
      <Card key="listas" id="listas" titulo="Mis listas" {...ctl('listas')}>
        {data.listas.length === 0 ? (
          <p className="card-nota">
            Todavía no tienes ninguna. En Colección, filtra lo que quieras y pulsa «Guardar
            como lista»: se guardan las condiciones, no los discos, así que la lista se
            mantiene al día sola.
          </p>
        ) : (
          <ul className="mini-list">
            {data.listas.map((lista) => (
              <li key={lista.id}>
                <button className="mini-row" onClick={() => onOpenLista(lista)}>
                  <span className="mini-text">
                    <span className="mini-title">{lista.name}</span>
                    <span className="mini-sub">{describirCriterios(lista.criteria)}</span>
                  </span>
                  <span className="lista-count numeric">{numero(lista.count)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ) : null,

    salud:
      data && data.salud.length > 0 ? (
        <Card key="salud" id="salud" titulo="Salud de la colección" {...ctl('salud')}>
          <p className="card-nota">
            Datos que faltan. No es una lista de errores: se van completando cuando quieras.
          </p>
          <ul className="salud-list">
            {data.salud.map((item) => (
              <li key={item.id} className="salud-item">
                <span className="salud-label">{item.label}</span>
                <span className="salud-count numeric">{numero(item.count)}</span>
                <span className="salud-ejemplos">
                  {item.ejemplos.map((ej, i) => (
                    <span key={ej.id}>
                      {i > 0 && ', '}
                      <button className="btn-link" onClick={() => onOpenAlbum(ej.id)}>
                        {ej.title}
                      </button>
                    </span>
                  ))}
                  {item.count > item.ejemplos.length && ` y ${item.count - item.ejemplos.length} más`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null,

    compras:
      data && data.compras.conRegistro > 0 ? (
        <Card key="compras" id="compras" titulo="Dónde compras" {...ctl('compras')}>
          <p className="card-nota">
            De {numero(data.compras.conRegistro)}{' '}
            {data.compras.conRegistro === 1 ? 'disco con registro' : 'discos con registro'} de
            compra.
          </p>
          {data.compras.porLugar.length > 0 ? (
            <ul className="meters">
              {data.compras.porLugar.map((l) => (
                <Meter
                  key={l.lugar}
                  label={l.lugar}
                  fill={(l.count / data.compras.porLugar[0].count) * 100}
                  value={`${numero(l.count)}`}
                />
              ))}
            </ul>
          ) : (
            <p className="card-nota">Todavía no anotaste dónde compraste ninguno.</p>
          )}
        </Card>
      ) : null
  }

  /** Los controles de personalizar que recibe cada tarjeta. */
  function ctl(id: ModuloId) {
    const visibles = orden.filter((x) => !ocultos.includes(x))
    return {
      ordenando,
      onSubir: () => mover(id, -1),
      onBajar: () => mover(id, 1),
      onOcultar: () => alternarVisible(id),
      primero: visibles.indexOf(id) === 0,
      ultimo: visibles.indexOf(id) === visibles.length - 1
    }
  }

  return (
    <div className="screen">
      <PageHeader
        title={collectionName}
        subtitle={`${numero(stats.totalAlbums)} discos · ${numero(stats.totalTracks)} canciones · ${numero(stats.totalPlays)} escuchas`}
        actions={
          <>
            <button
              className={`btn ${ordenando ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setOrdenando(!ordenando)}
            >
              {ordenando ? 'Listo' : 'Ordenar paneles'}
            </button>
            <button className="btn btn-primary" onClick={onAdd}>
              Agregar disco
            </button>
          </>
        }
      />

      {ordenando && (
        <div className="orden-aviso">
          <p>
            Mueve los paneles con las flechas y ocúltalos con la ✕. Se guarda para esta
            colección.
          </p>

          {/*
            Los ocultos se listan aquí y no en un menú aparte: si se pudieran
            apagar pero no se viera dónde vuelven a encenderse, quedarían
            perdidos para siempre.
          */}
          {ocultos.length > 0 && (
            <div className="orden-ocultos">
              <span className="orden-ocultos-titulo">Ocultos</span>
              {orden
                .filter((id) => ocultos.includes(id))
                .map((id) => (
                  <button
                    key={id}
                    className="orden-restaurar"
                    onClick={() => alternarVisible(id)}
                    title="Volver a mostrarlo"
                  >
                    {MODULOS.find((m) => m.id === id)?.label ?? id}
                    <span aria-hidden="true">+</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {loans.length > 0 && (
        <button
          className={`home-alert${atrasados > 0 ? ' home-alert-warn' : ''}`}
          onClick={onOpenLoans}
        >
          <span className="home-alert-text">
            {loans.length === 1
              ? 'Tienes 1 disco prestado'
              : `Tienes ${loans.length} discos prestados`}
            {atrasados > 0 &&
              ` · ${atrasados === 1 ? '1 lleva retraso' : `${atrasados} llevan retraso`}`}
          </span>
          <span className="home-alert-go">Ver préstamos →</span>
        </button>
      )}

      {/*
        Si los paneles que consultan la base no cargaron, se dice y se sigue
        mostrando lo demás. Desaparecer sin explicación deja a quien mira sin
        saber si es que no tiene datos o si algo se rompió.
      */}
      {errorPaneles && (
        <div className="home-fallo">
          <p className="home-fallo-titulo">Algunos paneles no se pudieron calcular.</p>
          <p className="home-fallo-detalle">{errorPaneles}</p>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            Reintentar
          </button>
        </div>
      )}

      <div className="home-grid">
        {orden.filter((id) => !ocultos.includes(id)).map((id) => paneles[id])}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------

interface CardProps {
  id: string
  titulo: string
  /** Ocupa las dos columnas. Para lo que necesita sitio: la portada, la grilla. */
  ancho?: boolean
  children: React.ReactNode
  ordenando: boolean
  onSubir: () => void
  onBajar: () => void
  onOcultar: () => void
  primero: boolean
  ultimo: boolean
}

/**
 * La tarjeta de un panel.
 *
 * Todo el inicio está hecho de estas: antes, "¿Qué escucho hoy?" tenía caja
 * propia y el resto quedaba suelto sobre el fondo, así que parecían cosas de
 * distinta importancia cuando son todas lo mismo — un panel que mira un
 * aspecto de la colección.
 */
function Card({
  titulo,
  ancho,
  children,
  ordenando,
  onSubir,
  onBajar,
  onOcultar,
  primero,
  ultimo
}: CardProps) {
  return (
    <section className={`home-card${ancho ? ' home-card-ancha' : ''}`}>
      <header className="home-card-head">
        <h3 className="home-card-title">{titulo}</h3>
        {ordenando && (
          <div className="orden-controles">
            <button onClick={onSubir} disabled={primero} aria-label={`Subir ${titulo}`}>
              ↑
            </button>
            <button onClick={onBajar} disabled={ultimo} aria-label={`Bajar ${titulo}`}>
              ↓
            </button>
            <button
              className="orden-ocultar"
              onClick={onOcultar}
              aria-label={`Ocultar ${titulo}`}
              title="Ocultar este panel"
            >
              ✕
            </button>
          </div>
        )}
      </header>
      <div className="home-card-body">{children}</div>
    </section>
  )
}

/**
 * Línea de tiempo por década.
 *
 * Columnas y no barras horizontales porque el eje es el tiempo, y el tiempo
 * se lee de izquierda a derecha. Las décadas sin ningún disco se dibujan
 * igual, vacías: el hueco es parte de la forma de una colección.
 */
function Decadas({ datos }: { datos: Array<{ decada: number; count: number }> }) {
  const desde = datos[0].decada
  const hasta = datos[datos.length - 1].decada
  const max = Math.max(...datos.map((d) => d.count))
  const todas: Array<{ decada: number; count: number }> = []
  for (let d = desde; d <= hasta; d += 10) {
    todas.push({ decada: d, count: datos.find((x) => x.decada === d)?.count ?? 0 })
  }

  return (
    <div className="decadas">
      {todas.map(({ decada, count }) => (
        <div className="decada" key={decada} title={`${decada}s: ${count} discos`}>
          <span className="decada-valor numeric">{count > 0 ? count : ''}</span>
          <span className="decada-track">
            <span
              className="decada-fill"
              style={{ height: count > 0 ? `${Math.max((count / max) * 100, 4)}%` : '0' }}
            />
          </span>
          <span className="decada-label numeric">{String(decada).slice(2)}</span>
        </div>
      ))}
    </div>
  )
}

function Meter({ label, fill, value }: { label: string; fill: number; value: string }) {
  return (
    <li className="meter">
      <span className="meter-label" title={label}>
        {label}
      </span>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${Math.min(Math.max(fill, 2), 100)}%` }} />
      </span>
      <span className="meter-value numeric">{value}</span>
    </li>
  )
}

/**
 * Un saludo según la hora.
 *
 * Es lo que se puede hacer sin red ni permisos. Ajustar la sugerencia al
 * clima necesitaría consultar un servicio y conocer dónde estás, y esta app
 * funciona sin conexión y no pide ubicación.
 */
function saludoPorHora(): string {
  const hora = new Date().getHours()
  if (hora < 6) return 'Para la madrugada'
  if (hora < 12) return 'Para la mañana'
  if (hora < 19) return 'Para la tarde'
  return 'Para la noche'
}

/**
 * Las condiciones de una lista, en una línea legible.
 *
 * Se describe lo que la lista PREGUNTA, no cuántos discos tiene: el número
 * ya va al lado y cambia solo, mientras que la pregunta es lo que la
 * identifica.
 */
function describirCriterios(c: SmartCriteria): string {
  const partes: string[] = []
  if (c.formato) partes.push(getFormat(c.formato)?.label ?? c.formato)
  if (c.genero) partes.push(c.genero)
  if (c.decada !== null && c.decada !== undefined) partes.push(`${c.decada}s`)
  if (c.estado) partes.push(conditionLabel(c.estado))
  if (c.etiqueta) partes.push(`«${c.etiqueta}»`)
  if (c.texto?.trim()) partes.push(`«${c.texto.trim()}»`)
  return partes.length > 0 ? partes.join(' · ') : 'Toda la colección'
}

/** "2026-08-14" → "ago 2026". Suficiente para un "hace cuánto". */
function fechaCorta(iso: string): string {
  const fecha = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return iso.slice(0, 7)
  return fecha.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })
}

function coverSrc(album: {
  userCoverFront: string | null
  canonicalCover: string | null
}): string | null {
  if (album.userCoverFront) return `waxbox-photo://${album.userCoverFront}`
  return album.canonicalCover
}

export default HomeScreen
