# Melôfyle

**Keep your music.**

Aplicación de escritorio para Windows que te permite catalogar tu colección de música en formatos
físicos: vinilo, CD, casete y los que se vayan agregando más adelante.

Cuando agregas un disco, la app completa automáticamente los datos del álbum (año, género, sello,
tracklist) consultando servicios públicos de música, y te deja revisar y corregir todo antes de guardarlo.

Melôfyle es exclusivamente para música en formato físico: lo que tienes en la mano y en el estante.
La música digital y el streaming quedan fuera del alcance del proyecto: Melôfyle cataloga objetos,
no bibliotecas digitales.

Con una excepción, que es la que confirma la regla: **puedes asociar tus propios archivos de audio
a las canciones de un disco que ya tienes** — el código de descarga que venía dentro del vinilo, o
el CD que rippeaste. No es una biblioteca digital: es poder escuchar el disco que está en tu
estante. Melôfyle guarda la ruta a tus archivos donde ya están, sin copiarlos ni moverlos.

## Estado: beta pública

**Versión actual: `0.9.0-beta.1`**

La app está completa y en uso real, pero todavía no ha pasado por suficientes
manos como para llamarla 1.0. Está en manos de un grupo de prueba, y de ahí
saldrá la versión estable.

Qué significa eso en la práctica:

- **Tus datos son tuyos y se quedan en tu computador.** No hay servidor, no hay
  cuenta, no se envía nada a ninguna parte. Aun así, mientras dure la beta
  conviene que no sea tu único registro de una colección grande.
- **El instalador no está firmado todavía.** Windows mostrará un aviso la
  primera vez; hay que pulsar «Más información» → «Ejecutar de todas formas».
  Estamos tramitando un certificado con [SignPath
  Foundation](https://signpath.org/), que lo da gratis a proyectos open source.
- **La app se actualiza sola.** Cuando publiquemos una beta nueva, la descarga
  en segundo plano y la instala al cerrarla.

### Qué ya funciona

- Agregar discos con datos automáticos de MusicBrainz, Cover Art Archive, Wikipedia y Deezer.
- Cargar a mano los discos que no están en ningún catálogo.
- Colección con buscador, filtros, vista de tabla y estado de conservación.
- Listas inteligentes: filtros guardados que se actualizan solos.
- Perfiles y colecciones múltiples.
- Setlists, incluido un generador automático por género.
- Lista de deseos y registro de préstamos.
- Exportación a Excel y PDF con el logo y tus datos.
- Reproductor propio con tus archivos, los adelantos de Deezer y video de YouTube.
- Tutorial de introducción y personalización del inicio.

## Reportar un problema o sugerir algo

**Lo más fácil es desde la propia app**: Configuración → «Reportar un problema»
o «Sugerir una mejora». Abre el navegador con el formulario ya empezado e
incluye la versión y el sistema, que es justo lo que hace falta para poder
mirarlo. Nada se envía hasta que tú lo publiques.

También puedes abrirlo directamente en
[Issues](https://github.com/lalanchaproyecto-prog/melofyle/issues).

Si el problema es que la app no abre y no puedes llegar a Configuración,
cuéntalo en Issues indicando la versión que instalaste.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- Windows 10 u 11

## Instalación para desarrollo

```bash
npm install
```

## Ejecutar en modo desarrollo

```bash
npm run dev
```

## Generar el instalador para Windows

```bash
npm run dist
```

El instalador `.exe` queda en la carpeta `dist/`.

## Estructura del proyecto

```
src/
├── core/          Lógica de negocio, independiente de la interfaz
│   ├── models/    Definiciones de datos (Album, Track, formatos físicos)
│   ├── services/  Consultas a MusicBrainz, Cover Art Archive, Wikipedia, YouTube
│   └── database/  Esquema y acceso a SQLite
├── main/          Proceso principal de Electron (ventana, acceso a disco y red)
├── preload/       Puente seguro entre el proceso principal y la interfaz
└── renderer/      Interfaz gráfica en React
```

La carpeta `core/` no depende de Electron ni de Windows. Toda la lógica de negocio vive ahí,
separada de la interfaz, para que sea fácil de leer, probar y mantener.

## Agregar un formato físico nuevo

Los formatos soportados están definidos en un solo archivo:
[`src/core/models/formats.ts`](src/core/models/formats.ts).

Para agregar uno (por ejemplo, minidisc) basta con añadir su identificador al tipo
`PhysicalFormatId` y su entrada a la lista `PHYSICAL_FORMATS`. El formulario, la base de datos y
la ficha del álbum leen esa lista y se adaptan solos.

## Fuentes de datos

Ninguna de estas fuentes requiere que crees una cuenta ni consigas una clave,
salvo YouTube, que es opcional.

- [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) — datos del álbum, tracklist y enlaces oficiales del artista
- [Cover Art Archive](https://coverartarchive.org/) — portada oficial del álbum
- [Wikipedia / Wikidata](https://www.wikidata.org/) — reseña introductoria del álbum o artista
- [Deezer](https://developers.deezer.com/api) — adelanto de 30 segundos de cada canción
- [YouTube Data API v3](https://developers.google.com/youtube/v3) — **opcional**, para ver el video completo

## Escuchar las canciones

Melôfyle usa Deezer para que puedas escuchar 30 segundos de cada canción. Funciona
de entrada, sin configurar nada.

Si además quieres ver el video completo, puedes agregar tu propia clave gratuita de
YouTube desde la pantalla de Configuración, que incluye una guía paso a paso. Es
opcional: sin ella, todo lo demás funciona igual. La clave se guarda cifrada en tu
computador y nunca se comparte.

## Créditos

Melôfyle es una iniciativa de **Proyecto La Lancha**, creada por Fabian Cardenas Perez e
Ivy Bonilla Guerrero.

Melôfyle existe gracias a proyectos de datos abiertos mantenidos por sus comunidades:
[MusicBrainz](https://musicbrainz.org/), [Cover Art Archive](https://coverartarchive.org/),
[Wikipedia y Wikidata](https://www.wikidata.org/), y [Deezer](https://developers.deezer.com/api).

## Licencia

MIT — ver [LICENSE](LICENSE).
