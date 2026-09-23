# GUERRA LIVE — versión equilibrada

Abre `INICIAR.cmd` y entra en http://127.0.0.1:4173. Si el juego ya estaba abierto antes de actualizarlo, reinicia el servidor y recarga la página.

## Reglas y costes de referencia

Los precios siguientes proceden del catálogo local. Son monedas de TikTok orientativas, no precios fijados por el juego. Confírmalos con «Consultar Regalos de mi LIVE». Rose y Rosa pueden ser regalos distintos; usa el nombre de tu catálogo.

| Canje | Coste aproximado | Efecto |
|---|---:|---|
| 20 Rose | 20 monedas | Nivel 10: +2 daño y +2 defensa; cura si sigue vivo. No revive. |
| Cada 10 Rose adicionales | 10 monedas | Frenesí 5 s en los tres modos, hasta 10 s acumulados. |
| 1 Finger Heart | 5 monedas | +25 armadura, hasta 100. |
| 10 GG | 10 monedas | Escudo 3 s; una ráfaga puede dar hasta 6 s. Después requiere 6 s de recarga. |
| 1 Perfume | 20 monedas | Magia durante 30 s: 18 daño cada 4,5 s; hasta 60 s acumulados. |
| 1 Doughnut | 30 monedas | Revive con hasta 100 HP; si está vivo, añade una reserva (máximo 3). |
| 1 Hand Heart | 100 monedas | Espada de acero: 16 daño base. |
| 1 Sunglasses | 199 monedas | Espada real: 22 daño base. |
| 1 Galaxy | 1000 monedas | Meteorito: hasta 90 daño de área antes de modificadores; máximo 3 pendientes por bando. |

Las armas repetidas no apilan críticos y una espada menor nunca sustituye a una mayor. La legendaria queda disponible como recompensa configurable, sin un regalo predeterminado.

Al alcanzar un límite, el exceso de regalos no añade poder ni queda pendiente. Los escudos canjeados durante su recarga no se activan. Revisa los límites visibles antes de enviar regalos. El laboratorio permite probar sin gastar monedas.

50 likes = +2% de daño y +2 de vida. Máximo 20 bloques por combatiente: +40% y +40 HP. En modo de likes para todo el ejército, cada bloque cuesta 1000 likes en 20 vs 20 o 1500 contra la torre; en duelo cuesta 50.

## Partidas justas

- Guerra: 20 vs 20. Jefe: hasta 30 contra la torre. Duelo: 1 vs 1.
- Al vencer, el campeón gana +1% de vida base y +1 punto porcentual de daño, hasta 10 victorias con bonus. No crece indefinidamente.
- Al agotarse el tiempo se comparan supervivientes y luego la suma de porcentajes de vida restante. Un empate real no da puntos ni favorece a Jade.
- Sin plaza, `!jade` y `!coral` permiten apoyar ese bando. Los apoyos sin preferencia se alternan; se recuerdan hasta 2000 espectadores.
- Ocupar un bot conserva su vida y mejoras; no sirve para resucitar gratis.
- Armas, nivel, likes, reservas y canjes incompletos se conservan entre rondas dentro de la guerra. Armadura y escudo se reinician. Magia conserva su tiempo restante; el frenesí del duelo se reinicia.
- Hasta 200 eventos recibidos entre rondas esperan al comienzo de la siguiente. Los eventos duplicados con identificador se ignoran.
- Iniciar otra partida reinicia la progresión. La vida base cambiada en Ajustes se aplica a los nuevos combatientes; la torre se actualiza en la siguiente ronda.

## Rendimiento

Dibujo de batalla limitado a 30 FPS; vista previa a 15 FPS. Las pestañas ocultas dejan de dibujar. La simulación del servidor continúa para el LIVE y OBS.

Hay un máximo de 160 efectos activos y 3 meteoritos pendientes por bando. Los efectos no serializan copias completas de personajes. Las animaciones, avisos y sonidos usan memoria acotada; los sonidos se disparan una vez por efecto. No hay efectos de combate sonando en el menú ni durante la pausa.

El overlay solo recibe configuración y estado básico, sin soldados ni efectos. El servidor no serializa partidas cuando no hay vistas conectadas; limita las vistas simultáneas a 12 y desconecta consumidores demasiado lentos. Los controles de teclado no generan peticiones simultáneas pendientes.

## LIVE y OBS

En Ajustes introduce tu usuario y pulsa «Conectar al LIVE» cuando estés transmitiendo. El conector existente es no oficial. La conexión real no se verificó durante esta corrección; las pruebas usan eventos locales.

- Canjes transparentes: http://127.0.0.1:4173/?overlay=1
- Batalla completa: http://127.0.0.1:4173/?obs=1

## Verificación

Ejecuta `npm.cmd test` en Windows (o `npm test` en otros entornos). Incluye 19 grupos de pruebas originales actualizadas y 17 regresiones: límites, empates, apoyos, cambio de rondas, eventos inválidos, ráfagas de 100000 meteoritos y 18000 pasos de simulación.

También se comprobó la interfaz en Chrome con ascenso y frenesí mediante regalos simulados. Estas pruebas no garantizan ausencia de cualquier bloqueo en todos los equipos ni sustituyen una prueba con tu LIVE real.

Los archivos anteriores a la corrección están en `../../work/backup-equilibrio/`.
