# ⚔️ Guerra Live TikTok · Juego Interactivo 2D

[![Jugar en GitHub Pages](https://img.shields.io/badge/Jugar_Online-GitHub_Pages-2ecc71?style=for-the-badge&logo=github)](https://pauluwu18.github.io/guerra-live-tiktok/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-brightgreen?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=for-the-badge)](LICENSE)

Juego RPG medieval en 2D interactivo para transmisiones en vivo de **TikTok Live**, optimizado con sprites 2D hechos a mano, físicas a 60 FPS, IA táctica avanzada y bajo consumo de memoria RAM.

---

## 🎮 Enlaces Rápidos

* 🌐 **Jugar directamente en la web**: [https://pauluwu18.github.io/guerra-live-tiktok/](https://pauluwu18.github.io/guerra-live-tiktok/) *(Funciona en navegador de PC, laptop o móvil sin instalar nada)*
* 🖥️ **Para Transmisiones en OBS**:
  * Lienzo de batalla completo: `http://127.0.0.1:4173/?obs=1`
  * Tarjeta de overlay de recompensas: `http://127.0.0.1:4173/?overlay=1`

---

## 🏆 Modos de Juego

### 1. 🛡️ Guerra 20 vs 20 (Batalla Total)
* Dos ejércitos (**Jade** vs **Coral**) con 40 gladiadores simultáneos en el campo de batalla.
* **IA con Despliegue Táctico**: Los combatientes utilizan toda la arena y mantienen distanciamiento orgánico para evitar aglomeraciones.
* Los espectadores se unen comentando `!jugar`, `!jade` o `!coral`.

### 2. ⚔️ Duelo 1 vs 1 (Torneo de Campeones)
* Combate técnico entre dos campeones.
* Sistema de estamina, esquives, bloqueo (*parry*), golpes críticos y contraataques.
* Cada victoria consecutiva aumenta +1% de vida máxima y daño del gladiador.

### 3. 🏰 Asalto a la Torre
* Modo asedio cooperativo donde el ejército Jade asalta la fortaleza enemiga.

---

## ⭐ Clases y Mecánicas Especiales

### 🌟 Soldado Nivel 10 (Caballero)
* Se desbloquea al enviar **20 Rosas** (a través de canjes o regalos de TikTok).
* **Beneficios de ascenso**:
  * **+2 Daño base y total**
  * **+2 Defensa y Armadura**
  * **Restablecimiento del 100% de la vida**
  * Nuevas animaciones completas de caballero medieval (`Knight_Walk`, `Knight_Attack`).

### 🔥 Modo Ataque Frenesí
* Al enviar **10 Rosas adicionales** una vez alcanzado el Nivel 10:
  * **En 20 vs 20**: Modo Frenesí permanente con tajo masivo (`Knight_Attack03`) y cadencia acelerada.
  * **En 1 vs 1**: Habilidad activa de **5 segundos** con contador regresivo en vivo en pantalla.

---

## 🚀 Cómo Ejecutar en Local (Conexión Real con TikTok Live)

### Método Fácil (Windows)
1. Descarga o clona este repositorio.
2. Haz doble clic en el archivo **`INICIAR.cmd`**.
3. El script instalará las dependencias necesarias y abrirá el juego automáticamente en `http://127.0.0.1:4173`.
4. En el panel lateral, escribe tu `@usuario` de TikTok y pulsa **Conectar**.

### Método Terminal
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor optimizado
npm start
```

---

## ⚡ Optimizaciones de Memoria RAM
* **Servidor V8**: Configurado con `--max-old-space-size=128 --optimize-for-size`, limitando la memoria privada a tan solo **~41 MB**.
* **Zero-Allocation Engine**: Bucle de efectos in-place y reutilización de mapas para evitar saturación de la memoria en transmisiones prolongadas.
* **Modo Web Autónomo**: En GitHub Pages, el motor corre directamente dentro del navegador del usuario sin requerir servidor backend.
