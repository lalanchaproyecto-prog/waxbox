/*
  Genera el icono de Melôfyle rasterizando la ô del logotipo.

  Usa el propio Electron como motor de dibujo: carga una página con el SVG,
  captura la ventana y guarda el PNG. Así el icono sale del MISMO trazado que
  el logotipo de la app, no de una imagen recortada a mano que podría dejar de
  coincidir con la marca en cuanto el logo cambie.

  Se ejecuta a mano cuando cambia la marca, desde la raíz del proyecto:

    npx electron resources/hacer-icono.cjs resources/icon.png
*/
const { app, BrowserWindow } = require('electron')
const fs = require('fs')

const SIZE = 512
const SALIDA = process.argv[2]

const O_ACENTUADA =
  'M347.09,82.43c0,31.06-21.52,44.6-41.82,44.6-22.73,0-40.26-16.66-40.26-43.21,0-28.11,18.4-44.6,41.65-44.6s40.43,17.53,40.43,43.21Zm-66.64,.87c0,18.4,10.59,32.28,25.51,32.28s25.51-13.71,25.51-32.63c0-14.23-7.12-32.28-25.16-32.28s-25.86,16.66-25.86,32.63ZM311.17,4.86l16.66,24.82h-11.8l-10.07-16.49h-.35l-10.06,16.49h-11.28l16.31-24.82h10.59Z'

/*
  Cuadrado casi negro con la ô en el rojo de la marca.

  Es la lectura del referente —marco oscuro, un golpe de color— y además es lo
  que mejor aguanta el tamaño real de un icono: a 16 píxeles en la barra de
  tareas, un fondo claro se pierde contra el escritorio y el rojo sobre negro
  se sigue distinguiendo.

  El viewBox es la caja real de la letra dentro del logotipo, la misma que usa
  el componente Isotipo.
*/
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body { margin:0; padding:0; background:transparent; }
  .marco {
    width:${SIZE}px; height:${SIZE}px; box-sizing:border-box;
    background:#17181a; border-radius:${Math.round(SIZE * 0.2)}px;
    display:flex; align-items:center; justify-content:center;
  }
  svg { width:62%; height:62%; display:block; }
</style></head>
<body>
  <div class="marco">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="227.85 -12.25 156.4 156.4">
      <path d="${O_ACENTUADA}" fill="#fb3d2b"/>
    </svg>
  </div>
</body></html>`

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true
  })

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  // Un respiro para que termine de pintar antes de la captura.
  await new Promise((listo) => setTimeout(listo, 500))

  let imagen = await win.webContents.capturePage()
  // En pantallas con escalado, la captura sale más grande que la ventana.
  const real = imagen.getSize()
  if (real.width !== SIZE) imagen = imagen.resize({ width: SIZE, height: SIZE, quality: 'best' })

  fs.writeFileSync(SALIDA, imagen.toPNG())
  console.log(`Icono escrito: ${SALIDA} (${imagen.getSize().width}x${imagen.getSize().height})`)
  app.quit()
})
