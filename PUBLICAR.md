# Cómo publicar una versión

La app se actualiza sola desde GitHub Releases. Para que eso funcione hay que
publicar de una forma concreta — no basta con arrastrar el `.exe` a una
release hecha a mano.

## Lo que hace falta que exista en cada release

`electron-updater` no mira el `.exe`. Mira un archivo llamado **`latest.yml`**
que electron-builder genera junto al instalador y que contiene la versión, el
nombre del archivo y su hash. Si ese archivo no está en la release, la app no
detecta nada y nunca se actualiza, aunque el instalador esté ahí.

Cada release necesita **tres archivos**:

| Archivo | Para qué |
|---|---|
| `Melofyle-Setup-0.9.0-beta.1.exe` | El instalador |
| `Melofyle-Setup-0.9.0-beta.1.exe.blockmap` | Permite descargar solo lo que cambió |
| `beta.yml` o `latest.yml` | **El que consulta la app.** Sin esto no hay actualización |

El nombre del tercero depende de la versión: una beta genera `beta.yml` y una
estable `latest.yml`. Ver «Canales» más abajo — es lo que mantiene separados a
los dos públicos.

Los tres los genera electron-builder. Lo importante es no publicarlos a mano.

## El paso que hay que hacer siempre: subir la versión

`electron-updater` compara la versión instalada con la del `latest.yml`. Si son
iguales, no hay nada que actualizar. **Si se te olvida subir el número en
`package.json`, la release se publica pero nadie la recibe.**

```bash
npm version patch
```

- `patch` → 1.0.0 a 1.0.1 (correcciones)
- `minor` → 1.0.0 a 1.1.0 (funciones nuevas)
- `major` → 1.0.0 a 2.0.0 (cambios que rompen algo)

Ese comando actualiza `package.json` y crea el tag de git.

Hay un segundo sitio con la versión: `APP_VERSION` en `src/core/config.ts`, que
es la que se muestra en «Acerca de» y en los informes de fallo. **Hay que
cambiarla a mano** para que coincida.

## Publicar

Necesitas un token de GitHub con permiso `repo`, en la variable de entorno
`GH_TOKEN`. Se saca en GitHub → Settings → Developer settings → Personal access
tokens.

```bash
npm run publicar
```

Eso compila, empaqueta y sube los tres archivos a una release **en borrador**.
Queda en borrador a propósito: puedes revisarla y escribir las notas antes de
que llegue a nadie.

**La actualización no se reparte hasta que publicas la release en GitHub.**
Mientras siga en borrador, `latest.yml` no es público y las apps instaladas no
ven nada.

## Comprobar que funcionó

1. Instala la versión anterior en un equipo (o máquina virtual).
2. Publica la nueva.
3. Abre la app instalada y espera un momento.
4. Debería aparecer abajo a la izquierda: «La versión X ya está descargada».
5. Cierra la app y vuelve a abrirla: ya está actualizada.

Si no aparece nada, mira que `latest.yml` esté en los archivos de la release y
que la versión sea efectivamente mayor que la instalada.

## Cómo se comporta la app

- Comprueba al arrancar y cada seis horas. La app de escritorio se queda
  abierta días enteros; mirar solo al arrancar dejaría sin actualizar a quien
  nunca la cierra.
- Descarga sola, en segundo plano, sin avisar ni preguntar.
- Cuando termina, muestra un aviso discreto abajo a la izquierda. Se puede
  descartar y no vuelve en esa sesión.
- **Instala al cerrar la app**, por su cuenta. No hay botón de «reiniciar
  ahora» a propósito: se pulsa sin pensar y, si estabas a mitad de catalogar
  un disco sin guardar, pierdes ese trabajo. La actualización ya está en el
  disco y puede esperar.
- En desarrollo (`npm run dev`) no hace nada: sin empaquetar no hay nada que
  actualizar.

## Canales: beta y estable no se mezclan

El sufijo de la versión decide el canal, y esto lo hace electron-builder solo:

| Versión | Archivo que genera | Quién lo lee |
|---|---|---|
| `0.9.0-beta.1` | `beta.yml` | Solo quien tiene instalada una beta |
| `1.0.0` | `latest.yml` | Quien tiene una versión estable |

Por eso la beta no le llega a nadie que instale mañana la 1.0: cada versión
mira el archivo de su propio canal. **No hay que configurar nada más**; sale
del número de versión.

Ojo con lo contrario: quien instale la beta seguirá en el canal beta hasta que
instale a mano una estable.

---

## Firmar con SignPath Foundation

> Todavía no tenemos el certificado. Esta sección es para que integrarlo sea
> configurar y no investigar.

### Lo primero, porque cambia el plan: no vas a recibir un certificado

SignPath **no entrega un archivo `.pfx`**. Es firma en la nube: la clave vive
en un HSM suyo y nunca sale de ahí. Se les manda el instalador, lo firman y se
devuelve firmado.

Consecuencia práctica: las opciones habituales de electron-builder para
firmar —`certificateFile`, `certificatePassword`, las variables `CSC_LINK` y
`CSC_KEY_PASSWORD`— **no se usan**. No hay nada que apuntar.

Segunda consecuencia, más incómoda: en el nivel gratuito para proyectos open
source, SignPath solo firma lo que construye un **sistema de compilación de
confianza**, y en la práctica eso significa GitHub Actions. **No se puede
firmar desde este computador.** El `npm run publicar` de arriba seguirá
sirviendo para betas sin firmar, pero la 1.0 firmada tendrá que salir de un
workflow.

### El detalle que rompe las actualizaciones si se hace en el orden ingenuo

`latest.yml` lleva el **SHA512 del instalador**. electron-updater lo comprueba
antes de instalar y rechaza el archivo si no coincide.

Firmar un ejecutable **cambia sus bytes**. Así que este orden no funciona:

1. ~~electron-builder construye y genera `latest.yml`~~
2. ~~SignPath firma el `.exe`~~
3. ~~Se publican los dos~~ ← el hash del yml ya no corresponde

Todo el mundo se descargaría la actualización y fallaría al instalarla, con un
error de checksum que no dice nada útil.

Hay dos formas de resolverlo. Al integrar hay que elegir una:

**A. Firmar dentro de la compilación** (`win.signtoolOptions.sign`).
electron-builder admite un módulo JS propio que se encarga de firmar cada
binario. Como corre *durante* la compilación, los `.yml` se generan después y
con el hash correcto. Es lo más limpio, y requiere que ese módulo llame a la
API REST de SignPath y espere la respuesta.

**B. Firmar entre medias y regenerar los metadatos.** Construir con
`--publish never`, mandar el `.exe` a firmar, y volver a generar `latest.yml`
sobre el archivo ya firmado antes de publicar.

La A es la recomendable si su API permite firmar sincrónicamente dentro del
build; la B es el plan de respaldo si el proceso de firma tarda o exige
aprobación manual.

### Lo que hay que tener listo antes de aplicar

- **Licencia OSI sin doble licencia comercial.** MIT — ya cumple.
- **Proyecto mantenido activamente.** Ya cumple.
- **Haber publicado antes en forma no firmada.** Esta beta lo cumple: es uno
  de los requisitos, no un trámite aparte.
- **Funcionalidad documentada** en la página de descarga. El README cumple.
- **Doble factor activado** en las cuentas de GitHub y SignPath de todo el
  equipo. Esto hay que revisarlo a mano.
- **Una «política de firma de código» publicada** en el repositorio o el sitio,
  que incluya:
  - la atribución literal: *«Free code signing provided by SignPath.io,
    certificate by SignPath Foundation»*
  - los roles del equipo (quién es autor, quién revisa, quién aprueba)
  - una política de privacidad, o la declaración de que la app no transfiere
    datos — que es nuestro caso y conviene decirlo tal cual.
- **Metadatos en los binarios** (nombre de producto y versión). electron-builder
  ya los pone desde `productName` y `version`.

### Datos de configuración que pedirá el workflow

Cuando llegue la aprobación, SignPath da estos cuatro valores. Van como
*secrets* del repositorio, nunca en el código:

| Dato | Para qué |
|---|---|
| Organization ID | Identifica la organización en SignPath |
| Project slug | El proyecto dentro de la organización |
| Signing policy slug | Qué política aplicar (`release-signing` o `test-signing`) |
| API token | Autenticación. **Secret de GitHub, jamás en el repositorio** |

---

## Mientras tanto: sin firmar

El instalador de la beta no está firmado. Windows SmartScreen mostrará
«Windows protegió su PC» la primera vez, y hay que pulsar **Más información →
Ejecutar de todas formas**. Está explicado en la guía que se le pasa al equipo
de pruebas.

Las actualizaciones automáticas **funcionan igual sin firma**. Lo único que
cambia al firmar es que desaparece ese aviso.
