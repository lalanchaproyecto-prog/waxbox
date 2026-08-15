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
| `Melofyle-Setup-1.0.1.exe` | El instalador |
| `Melofyle-Setup-1.0.1.exe.blockmap` | Permite descargar solo lo que cambió |
| `latest.yml` | **El que consulta la app.** Sin esto no hay actualización |

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

## Sobre la firma de código

El instalador no está firmado. Windows SmartScreen mostrará un aviso de
«editor desconocido» la primera vez que alguien lo ejecute, y hay que pulsar
«Más información» → «Ejecutar de todas formas».

Las actualizaciones automáticas **sí funcionan sin firma**. Un certificado de
firma cuesta entre 200 y 400 dólares al año; lo único que cambia es que
desaparece ese aviso.
