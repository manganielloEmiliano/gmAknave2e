# Knave 2e — Asistente de GM

App web estática (HTML/CSS/JS vanilla, sin build) para llevar partidas de
**Knave: Second Edition** (Ben Milton / Questing Beast LLC): referencia de
reglas, creación y ficha de personaje, combate, exploración de mazmorra,
viaje e inventario de grupo. Bilingüe (ES/EN), con el estado guardado en
`localStorage` del navegador.

## Alcance

Esta versión cubre el **loop de juego core**: habilidades, pruebas, creación
de personaje, slots/heridas, subir de nivel, viaje (watches + Travel Hazard
Die), exploración de mazmorra (turnos + Dungeon Hazard Die + luz), combate,
peligros ambientales y lanzamiento de hechizos (solo el procedimiento).

Por licencia del libro ("the game mechanics of Knave: Second Edition may be
reused freely, but the text and art may not"), **no incluye** ninguna de las
~30 tablas de contenido del libro (carreras, bestiario, hechizos concretos,
objetos, generación de PNJs/tesoros/dressing, alquimia, reliquias, guerra,
edificios, reclutamiento). Donde la mecánica necesita ese tipo de dato
(carrera inicial, hechizos conocidos), la app deja campos de texto libre
para que cargues el contenido desde tu propia copia del libro.

## Cómo correrlo en local

Como usa `fetch()` para cargar los diccionarios de idioma y las reglas
(`data/*.json`), hace falta servirlo por HTTP (no funciona abriendo
`index.html` directo con `file://`). Cualquier servidor estático simple
sirve:

```bash
npx serve .
# o
python -m http.server 8000
```

Luego abrí `http://localhost:PUERTO` en el navegador.

## Publicar en GitHub Pages

1. Subí este directorio a un repositorio de GitHub.
2. En el repo: **Settings → Pages → Build and deployment → Source: Deploy
   from a branch**, elegí la rama (`main`) y la carpeta `/ (root)`.
3. GitHub Pages sirve `index.html` directamente; no hace falta ningún paso
   de build ni GitHub Actions.

## Datos y backup

Todo el estado (personajes, grupo, progreso de mazmorra/viaje, idioma y
tema) se guarda en `localStorage`, que es **local a cada navegador**. Desde
**Ajustes** podés exportar un backup en JSON e importarlo después (en el
mismo navegador u otro) para no perder la partida.

## Estructura

```
index.html
css/styles.css
js/
  app.js        bootstrap + navegación
  router.js     ruteo por hash
  i18n.js       diccionarios ES/EN
  storage.js    localStorage (load/save/export/import)
  state.js      estado en memoria + notificación a las vistas
  dice.js       utilidades de tiradas (d20, xdY, checks, ataques)
  views/        una vista por sección (home, rules, characters, party,
                combat, delving, travel, settings)
data/
  i18n.es.json, i18n.en.json   strings de interfaz y de reglas
  rules.json                    contenido de referencia (parafraseado)
```

## Fuera de alcance (posible fase 2)

Bestiario, Alquimia, Magia de Reliquias, Guerra, Edificios, Reclutamiento,
y cualquier tabla de generación de contenido del libro.
