/*
  EL TUTORIAL DE BIENVENIDA.

  Sale solo la primera vez que se entra a un perfil, y desde entonces vive en
  Configuración por si alguien quiere repasarlo.

  POR QUÉ ES UN RECORRIDO Y NO UNAS BURBUJAS SOBRE LA PANTALLA:

  Lo habitual sería señalar botones con globitos flotantes encima de la
  interfaz real. Aquí no sirve, por una razón concreta: la mitad de lo que hay
  que explicar no está en la pantalla de inicio. Está dentro de la ficha de un
  disco que todavía no existe, o en una sección que la persona apagó en
  Configuración. Un globito que apunta a un botón que no está en pantalla no
  se puede dibujar, y arrastrar a alguien por seis pantallas antes de que
  tenga un solo disco es peor que no explicar nada.

  Así que el tutorial se cuenta como un folleto por capítulos: qué se puede
  hacer, dónde está y cómo se hace. Se lee entero en un par de minutos, se
  salta con una tecla, y queda guardado para volver.

  Se salta con Escape o con el botón «Saltar». Que se pueda abandonar en
  cualquier momento no es un detalle: un tutorial obligatorio de catorce
  pantallas es un muro, no una ayuda.
*/

import { useEffect, useState } from 'react'
import type { FeatureFlags } from '@core/models/features'
import { APP_NAME, APP_SLOGAN } from '@core/config'
import { Logotipo } from './Logo'
import { IconClose } from './Icons'

/** Un capítulo del recorrido. */
interface Paso {
  /** Rótulo corto de la sección, en la mono. */
  seccion: string
  titulo: string
  /** El párrafo que explica para qué sirve. */
  cuerpo: string
  /** Los pasos concretos: dónde se pulsa y qué pasa. */
  comoSeHace?: string[]
  /**
   * De qué función depende este capítulo. Si está apagada en Configuración,
   * el capítulo no se muestra: contarle a alguien una sección que decidió no
   * tener es ruido.
   */
  requiere?: keyof FeatureFlags
}

const PASOS: Paso[] = [
  {
    seccion: 'Bienvenida',
    titulo: 'Esto es un catálogo de tu música física',
    cuerpo:
      `${APP_NAME} guarda los discos que tienes en la mano: vinilos, CD y casetes. ` +
      'No es un reproductor de streaming ni una biblioteca digital — es el registro de ' +
      'tu estantería, con lo que cada copia tiene de particular: en qué estado está, ' +
      'dónde la compraste, a quién se la prestaste.',
    comoSeHace: [
      'Todo lo que veas aquí se puede saltar y volver a leer después desde Configuración.',
      'La app funciona sin conexión; solo necesita internet para buscar los datos de un disco nuevo.'
    ]
  },
  {
    seccion: 'Agregar',
    titulo: 'Agregar un disco, de dos maneras',
    cuerpo:
      'Lo normal es que la app complete sola el año, el sello, el género, la portada y el ' +
      'tracklist. Escribes el artista y el álbum, y ella busca en los catálogos públicos. ' +
      'Si tu disco no aparece en ninguno —una edición rara, algo autoeditado— lo cargas a mano.',
    comoSeHace: [
      'Pulsa «Agregar disco» en el menú de la izquierda o arriba a la derecha.',
      'Escribe el artista y el título, y elige tu edición entre los resultados.',
      'Si no aparece, pulsa «Cargar a mano» y escribe tú los datos.',
      'Antes de guardar puedes corregir cualquier campo y subir fotos de tu portada y contraportada.'
    ]
  },
  {
    seccion: 'Colección',
    titulo: 'Buscar y filtrar lo que ya tienes',
    cuerpo:
      'La colección es la lista completa. Se puede ver como fichas o como tabla, y se ' +
      'filtra por formato, género, década, estado de conservación y etiquetas.',
    comoSeHace: [
      'Entra en «Colección» desde el menú.',
      'Usa el buscador de arriba para encontrar por título, artista o sello.',
      'Combina los filtros; el número de resultados se actualiza solo.',
      'Cambia entre fichas y tabla con el control de vista.'
    ]
  },
  {
    seccion: 'Listas',
    titulo: 'Listas inteligentes: filtros que se guardan',
    cuerpo:
      'Una lista inteligente no guarda discos, guarda la pregunta. «Mis vinilos de los 70 en ' +
      'buen estado» sigue siendo cierto dentro de un año, y la lista se actualiza sola con ' +
      'lo que compres desde hoy.',
    requiere: 'smartLists',
    comoSeHace: [
      'En la colección, aplica los filtros que quieras.',
      'Pulsa «Guardar como lista» y ponle un nombre.',
      'Aparecerá en el panel «Mis listas» del inicio, con su número siempre al día.'
    ]
  },
  {
    seccion: 'Ficha del disco',
    titulo: 'Tu copia: lo que ningún catálogo sabe',
    cuerpo:
      'Al abrir un disco verás dos cosas distintas. El catálogo —título, año, sello, ' +
      'tracklist— es igual para todo el mundo. «Tu copia» es solo tuya: el estado de ' +
      'conservación, dónde y por cuánto la compraste, tus etiquetas y tus notas.',
    comoSeHace: [
      'Abre cualquier disco de la colección.',
      'En el panel de la derecha, pulsa «Editar tu copia».',
      'Anota el estado, la compra, las etiquetas y lo que quieras recordar.',
      'También puedes enlazar dos ediciones del mismo álbum como variantes.'
    ]
  },
  {
    seccion: 'Reproducir',
    titulo: 'Escuchar lo que tienes',
    cuerpo:
      'La app puede sonar de tres formas: tus propios archivos de audio, los adelantos de ' +
      '30 segundos de Deezer, y el video de YouTube. Tus archivos se quedan donde están — ' +
      'solo se guarda la ruta, no se copian ni se mueven.',
    requiere: 'playback',
    comoSeHace: [
      'En la ficha de un disco, pulsa «Agregar mis archivos de audio» y elige la carpeta; se reparten solos por el nombre.',
      'Pulsa ▶ en cualquier canción, o «Reproducir» en el panel «¿Qué escucho hoy?» del inicio.',
      'El reproductor vive abajo. Con ⤢ se hace grande y muestra la cola de canciones.',
      'En el reproductor grande puedes saltar a cualquier canción de la cola con un clic.'
    ]
  },
  {
    seccion: 'Setlists',
    titulo: 'Armar tandas de canciones',
    cuerpo:
      'Un setlist mezcla canciones de discos distintos: para una fiesta, para un viaje, ' +
      'para probar un orden. Se pueden reproducir enteros y exportar a PDF o Excel.',
    requiere: 'setlists',
    comoSeHace: [
      'Entra en «Setlists» y crea uno nuevo.',
      'Desde el tracklist de cualquier disco, pulsa «+» en una canción para sumarla.',
      'O usa el generador automático: eliges un género y una duración, y lo arma él.',
      'Reordena arrastrando, y pulsa «Reproducir» para escucharlo entero.'
    ]
  },
  {
    seccion: 'Deseos',
    titulo: 'Lo que todavía no tienes',
    cuerpo:
      'La lista de deseos funciona casi igual que la colección: puedes buscar el disco en ' +
      'el catálogo para que se complete solo, o escribirlo a mano. Cuando lo consigas, pasa ' +
      'a la colección.',
    requiere: 'wishlist',
    comoSeHace: [
      'Entra en «Deseos» desde el menú.',
      'Pulsa «Buscar en catálogo» para que complete los datos, o «Agregar a mano».',
      'Anota la prioridad y cuánto estás dispuesto a pagar.'
    ]
  },
  {
    seccion: 'Préstamos',
    titulo: 'Saber a quién le prestaste qué',
    cuerpo:
      'Cuando prestas un disco, lo registras con la fecha en que debería volver. El inicio ' +
      'te avisa de los que llevan retraso, para que no se te pierda ninguno.',
    requiere: 'loans',
    comoSeHace: [
      'Abre el disco y pulsa «+ Prestar» en el panel de préstamos.',
      'Escribe a quién y, si quieres, cuándo debería volver.',
      'Cuando te lo devuelvan, pulsa «Ya volvió».',
      'En «Préstamos» ves todos los que están fuera de casa.'
    ]
  },
  {
    seccion: 'Inicio',
    titulo: 'El inicio es tuyo: acomódalo',
    cuerpo:
      'Los paneles del inicio se mueven, se agrandan y se esconden. Si te sobra espacio en ' +
      'blanco, ensancha un panel para llenarlo; si un panel no te interesa, quítalo.',
    comoSeHace: [
      'Pulsa «Personalizar inicio» arriba a la derecha.',
      'Arrastra un panel y suéltalo sobre otro para cambiarlo de sitio.',
      'Pulsa «1 col» para que ocupe 2 o 3 columnas y no queden huecos.',
      'Con la ✕ lo escondes; los escondidos se recuperan desde el mismo modo.'
    ]
  },
  {
    seccion: 'Atajos',
    titulo: 'Buscar en toda la app sin soltar el teclado',
    cuerpo:
      'Hay un buscador general que encuentra discos, setlists y secciones desde cualquier ' +
      'pantalla. Es la forma más rápida de moverse cuando la colección crece.',
    comoSeHace: [
      'Pulsa Ctrl + K en cualquier momento.',
      'Escribe lo que buscas y navega con las flechas.',
      'Enter abre el resultado; Escape cierra.'
    ]
  },
  {
    seccion: 'Perfiles',
    titulo: 'Varias personas, varias colecciones',
    cuerpo:
      'Cada perfil tiene sus propias colecciones, separadas del resto. Y dentro de un ' +
      'perfil puedes tener más de una colección — la tuya, la heredada, la del local.',
    comoSeHace: [
      'Arriba en el menú, pulsa tu nombre para cambiar de perfil.',
      'Justo debajo, el selector de colección permite crear y cambiar de colección.',
      'Los perfiles no llevan contraseña: separan, no protegen.'
    ]
  },
  {
    seccion: 'Guardar y compartir',
    titulo: 'Sacar tu colección de la app',
    cuerpo:
      'Puedes exportar la colección entera o un setlist a Excel y a PDF, eligiendo qué ' +
      'columnas incluir. Sirve para un seguro, para una venta o simplemente para tener copia.',
    comoSeHace: [
      'En la colección o en un setlist, busca el botón de exportar.',
      'Elige el formato y marca los campos que quieras incluir.',
      'Se guarda donde tú digas, en tu computador.'
    ]
  },
  {
    seccion: 'Configuración',
    titulo: 'Apaga lo que no uses',
    cuerpo:
      'Si no prestas discos ni haces setlists, esas secciones no tienen por qué ocupar sitio ' +
      'en tu menú. En Configuración puedes encender y apagar cada función de la app.',
    comoSeHace: [
      'Entra en «Configuración» al final del menú.',
      'Abre «Funciones de la app» y desmarca lo que no uses.',
      'Ahí mismo eliges el tema claro u oscuro y puedes volver a ver este tutorial.'
    ]
  }
]

interface TutorialProps {
  /** Para no contar capítulos de secciones apagadas. */
  features: FeatureFlags
  onCerrar: () => void
}

function Tutorial({ features, onCerrar }: TutorialProps) {
  const pasos = PASOS.filter((paso) => !paso.requiere || features[paso.requiere])
  const [indice, setIndice] = useState(0)

  const paso = pasos[indice]
  const primero = indice === 0
  const ultimo = indice === pasos.length - 1

  /*
    Escape cierra, y las flechas pasan de capítulo.

    Un recorrido que solo avanza con el ratón obliga a soltar el teclado en
    cada pantalla, y son catorce.
  */
  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
      if (evento.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, pasos.length - 1))
      if (evento.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCerrar, pasos.length])

  if (!paso) return null

  return (
    <div className="modal-backdrop" onClick={onCerrar}>
      <div
        className="modal modal-tutorial"
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-label="Tutorial de introducción"
      >
        <header className="modal-header">
          <div className="tutorial-encabezado">
            <span className="overline">
              {paso.seccion} · {indice + 1} de {pasos.length}
            </span>
            <h2>{paso.titulo}</h2>
          </div>
          <button className="modal-close" onClick={onCerrar} title="Saltar el tutorial (Esc)">
            <IconClose size={18} />
          </button>
        </header>

        {/* La barra de avance: cuánto queda, sin tener que contar. */}
        <div className="tutorial-avance" aria-hidden="true">
          <span
            className="tutorial-avance-lleno"
            style={{ width: `${((indice + 1) / pasos.length) * 100}%` }}
          />
        </div>

        <div className="tutorial-cuerpo">
          {/* Solo el primer capítulo lleva la marca; después estorbaría. */}
          {primero && (
            <div className="tutorial-marca">
              <Logotipo alto={40} />
              <span className="tutorial-eslogan">{APP_SLOGAN}</span>
            </div>
          )}

          <p className="tutorial-texto">{paso.cuerpo}</p>

          {paso.comoSeHace && (
            <div className="tutorial-pasos">
              <span className="overline">Cómo se hace</span>
              <ol className="tutorial-lista">
                {paso.comoSeHace.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <footer className="modal-footer tutorial-pie">
          <button className="btn btn-ghost" onClick={onCerrar}>
            {ultimo ? 'Cerrar' : 'Saltar'}
          </button>

          <div className="tutorial-navegacion">
            <button
              className="btn btn-ghost"
              onClick={() => setIndice((i) => i - 1)}
              disabled={primero}
            >
              Anterior
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (ultimo ? onCerrar() : setIndice((i) => i + 1))}
            >
              {ultimo ? 'Empezar' : 'Siguiente'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default Tutorial
