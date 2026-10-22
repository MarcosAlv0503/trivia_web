# Documentación

Índice de toda la documentación del proyecto. Las reglas de trabajo, las decisiones y el estado de cada fase están en [`CLAUDE.md`](../CLAUDE.md). Cómo arrancar el proyecto en local está en el [`README.md`](../README.md) de la raíz.

## Documentación por módulos

Describe cómo funciona el código, módulo a módulo: reglas, flujo, tablas, RPC, archivos y tests. Refleja el código del 2026-10-22 (commit `c276753`). Si cambias un módulo, actualiza su documento en el mismo commit.

**Plataforma**

- [Arquitectura](modulos/arquitectura.md): mapa del monorepo, capas, flujo de una petición y convenciones.
- [Web](modulos/web.md): app Next.js, rutas, proxy, clientes de Supabase, i18n y Sentry.
- [Sistema visual](modulos/sistema-visual.md): tokens, componentes compartidos, iconos, mascota, sonido y accesibilidad.
- [Base de datos](modulos/base-de-datos.md): seguridad, límites de peticiones, códigos de error, mapa de tablas y funciones, migraciones y tests.
- [Infraestructura y CI](modulos/infraestructura-y-ci.md): scripts, entorno local, variables de entorno, CI/CD, copias y monitorización.

**Cuentas**

- [Auth y onboarding](modulos/auth-y-onboarding.md): login social, protección de rutas y creación del perfil.
- [Perfil](modulos/perfil.md): perfil, avatares, nombres de usuario y su moderación, invitados y borrado de cuenta.
- [Legal y privacidad](modulos/legal-y-privacidad.md): textos legales, consentimiento, datos personales, retención y copias.

**Contenido**

- [Preguntas](modulos/preguntas.md): modelo de categorías, preguntas y traducciones, importación y % de acierto.
- [Contenido y admin](modulos/contenido-y-admin.md): procesos de generación, traducción y revisión, reportes y panel `/admin`.

**Juego**

- [game-core](modulos/game-core.md): reglas compartidas en TypeScript puro.
- [Modo rápido](modulos/modo-rapido.md): partida en solitario y local por turnos.
- [Reto diario](modulos/reto-diario.md): las mismas 7 preguntas para todos cada día.
- [Amigos y duelo](modulos/amigos-y-duelo.md): amigos, presencia "en línea" y duelo por turnos.
- [Duelo relámpago](modulos/duelo-relampago.md): 1 contra 1 en vivo.

**Progresión y avisos**

- [Progresión y estadísticas](modulos/progresion-y-estadisticas.md): XP, niveles, títulos y estadísticas por categoría.
- [Avisos, PWA y push](modulos/avisos-pwa-y-push.md): avisos in-app, app instalable, push web y aviso de plazo.

## Guías y diseños

- [Producción](produccion.md): crear y configurar Supabase Cloud, Vercel y Sentry; copias y retención.
- [Procesos de preguntas](procesos-de-preguntas.md): ejecutar y modificar la generación, traducción y revisión de preguntas.
- [Hallazgos del 2026-10-22](hallazgos-2026-10-22.md): problemas encontrados al documentar todo el código, por gravedad; nada corregido aún.
- [Visión](vision.md): el planteamiento original del proyecto.
- [Diseño del duelo relámpago](superpowers/specs/2026-10-21-duelo-relampago-design.md) y su [plan de implementación](superpowers/plans/2026-10-21-duelo-relampago.md).

## ¿Dónde miro si…?

| Quiero…                                               | Empieza por                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Entender cómo encaja todo                             | [Arquitectura](modulos/arquitectura.md)                                                                     |
| Añadir una pantalla o una RPC                         | [Arquitectura](modulos/arquitectura.md) y [Base de datos](modulos/base-de-datos.md)                          |
| Cambiar una regla de puntuación o de tiempo           | [game-core](modulos/game-core.md) y el documento del modo                                                   |
| Saber qué significa un error de una RPC (`hint`)      | [Base de datos → Códigos de error](modulos/base-de-datos.md#códigos-de-error)                               |
| Saber dónde está definida una función de SQL          | [Base de datos → Funciones por documento](modulos/base-de-datos.md#funciones-por-documento)                  |
| Cambiar cuánta XP da algo                             | [Progresión y estadísticas](modulos/progresion-y-estadisticas.md)                                           |
| Añadir o revisar preguntas                            | [Contenido y admin](modulos/contenido-y-admin.md) y [Procesos de preguntas](procesos-de-preguntas.md)        |
| Tocar textos, colores o componentes                   | [Web](modulos/web.md) (i18n) y [Sistema visual](modulos/sistema-visual.md)                                  |
| Saber qué datos personales guardamos                  | [Legal y privacidad](modulos/legal-y-privacidad.md)                                                         |
| Desplegar o configurar un entorno                     | [Infraestructura y CI](modulos/infraestructura-y-ci.md) y [Producción](produccion.md)                       |
