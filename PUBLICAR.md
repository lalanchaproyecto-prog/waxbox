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
| `latest.yml` | **El que consulta la app.** Sin esto no hay actualización |

Con GitHub el tercero se llama `latest.yml` **también en las betas**. Ver
«Canales» más abajo: la separación entre beta y estable no la hace el nombre
de ese archivo.

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

## Requisito de Windows para poder generar el instalador

**Hay que tener activado el Modo de desarrollador de Windows.** Sin él,
`npm run dist` falla siempre con este error:

```
ERROR: Cannot create symbolic link : El cliente no dispone de un privilegio requerido.
  ...winCodeSign\<números>\darwin\10.12\lib\libcrypto.dylib
```

No tiene nada que ver con la firma de código ni con macOS, aunque lo parezca.
electron-builder descarga un paquete de herramientas que trae dentro enlaces
simbólicos de la versión de macOS, y crear enlaces simbólicos en Windows exige
un privilegio que las cuentas normales no tienen. Falla al descomprimir y no
llega a construir el instalador.

Cómo activarlo:

**Configuración de Windows → Sistema → Para programadores → Modo de
programador → Activado**

Hay que reiniciar la terminal después. No hace falta reiniciar el equipo.

Es un ajuste del sistema y hay que hacerlo a mano una vez; después
`npm run dist` funciona con normalidad.

## Publicar

### El token

electron-builder crea la release y sube los archivos por la API de GitHub, y
para eso necesita un token en la variable de entorno `GH_TOKEN`.

Usa un **token de acceso personal de alcance fino** (*fine-grained*), no uno
clásico. El clásico solo ofrece el permiso `repo`, que da control total sobre
**todos** tus repositorios; el de alcance fino se limita a este y a lo justo.

En GitHub → *Settings* → *Developer settings* → *Personal access tokens* →
*Fine-grained tokens* → *Generate new token*:

| Campo | Qué poner |
|---|---|
| Token name | `melofyle-publicar` |
| Expiration | 90 días. Que caduque es una función, no una molestia |
| Repository access | *Only select repositories* → **melofyle**, y nada más |
| Permissions → Repository → **Contents** | **Read and write** ← el único que hace falta |

`Contents: Read and write` es lo que permite crear releases y subirles
archivos. No hace falta ningún otro permiso.

### Dónde se guarda

El token se escribe **una vez** en una variable de entorno del usuario. En
PowerShell, sustituyendo el valor:

```bash
[Environment]::SetEnvironmentVariable('GH_TOKEN','TU_TOKEN_AQUI','User')
```

Hay que **abrir una terminal nueva** después: las que ya estaban abiertas no
ven la variable.

Tres cosas que conviene tener claras:

- **Queda en texto plano en el registro de Windows**, en
  `HKCU:\Environment`. Cualquier programa que corra con tu usuario puede
  leerlo. Es el mismo nivel de protección que tiene la clave de YouTube dentro
  de la app, y es aceptable para un token que solo puede tocar un repositorio
  y caduca en 90 días — no lo sería para uno con permiso sobre toda la cuenta.
- **Nunca va al repositorio ni a un archivo del proyecto.** Si alguna vez se
  te cuela en un commit, GitHub lo detecta y lo revoca solo, pero no cuentes
  con eso: revócalo tú.
- Para borrarlo cuando ya no haga falta:

```bash
[Environment]::SetEnvironmentVariable('GH_TOKEN',$null,'User')
```

### El comando

```bash
npm run publicar
```

Compila, empaqueta y sube los tres archivos.

### Sale directo como pre-release, no como borrador

En `package.json`, dentro de `build.publish`, está puesto
`"releaseType": "prerelease"`. Con eso la release se publica sola marcada como
pre-release, sin tener que entrar a GitHub a marcarla a mano.

> **Antes de la 1.0 hay que cambiar esto.** `releaseType` no distingue
> versiones: mientras diga `prerelease`, *toda* release sale marcada como
> pre-release, incluida la 1.0 estable. Al dejar de estar en beta hay que
> cambiarlo a `"release"` (sale publicada) o a `"draft"` (sale en borrador,
> para revisarla antes).

Una pre-release **sí reparte actualizaciones** a quien tenga instalada una
beta: el canal lo decide el sufijo de la versión, no la etiqueta de GitHub.
Ver «Canales» más abajo.

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

> Cuidado, porque casi toda la documentación que se encuentra por ahí describe
> el otro caso. **Con GitHub no hay archivos por canal.**

Con otros proveedores, electron-builder genera un `beta.yml` aparte del
`latest.yml` y cada versión lee el suyo. **Con GitHub no**: genera un único
`latest.yml` y espera que la separación la haga la **marca de pre-release de
la release**. Está dicho en su propio código:

```
// for GitHub should be pre-release way be used
```

Comprobado: construir `0.9.0-beta.1` genera `latest.yml`, no `beta.yml`.

Quien decide, entonces, es la opción `allowPrerelease` del lado de la app, en
`src/main/updater.ts`:

| Versión instalada | `allowPrerelease` | Qué recibe |
|---|---|---|
| `0.9.0-beta.1` | `true` | Betas más nuevas **y** la 1.0 estable cuando salga |
| `1.0.0` | `false` | Solo estables. Las betas ni las ve |

**No está fijo a mano: se saca de si la versión que corre lleva sufijo de
preversión.** Quien instaló una beta quiere betas; quien instaló una estable,
no. El día que salga la 1.0 se apaga solo.

### La trampa que esto evita

El valor por omisión de `allowPrerelease` es `false`. Con la beta publicada
como pre-release, eso significa que la app pide `/releases/latest` — y GitHub
**excluye las pre-releases de ahí por definición**. No encuentra nada.

O sea: con la configuración por defecto, **la beta no recibiría ninguna
actualización nunca**, sin ningún error visible. Parecería que funciona.

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
