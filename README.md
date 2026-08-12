# Waxbox

**Tu música, tu historia.**

Aplicación de escritorio para Windows que te permite catalogar tu colección de música en formatos
físicos: vinilo, CD, casete y los que se vayan agregando más adelante.

Cuando agregas un disco, la app completa automáticamente los datos del álbum (año, género, sello,
tracklist) consultando servicios públicos de música, y te deja revisar y corregir todo antes de guardarlo.

Waxbox es exclusivamente para música en formato físico: lo que tienes en la mano y en el estante.
Música digital, streaming y archivos de audio quedan fuera del alcance del proyecto.

## Estado del proyecto

En desarrollo. Actualmente funciona el esqueleto de la aplicación, la ventana principal y el
formulario para agregar un disco a la colección.

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

- [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) — metadatos del álbum y tracklist
- [Cover Art Archive](https://coverartarchive.org/) — portada oficial del álbum
- [Wikipedia / Wikidata](https://www.wikidata.org/) — reseña introductoria del álbum o artista
- [YouTube Data API v3](https://developers.google.com/youtube/v3) — video de cada canción

## Licencia

MIT — ver [LICENSE](LICENSE).
