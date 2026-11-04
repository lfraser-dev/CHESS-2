# Inkhold

A 2D side-scrolling siege game drawn in scratchy ink on notebook paper.
Build your village by day, hold the wall by night, then march your army east and tear down the Black Keep.

**Play:** open `index.html` in a browser (no build step, no dependencies).

## Controls

| Key | Action |
| --- | --- |
| A / D or ← / → | Walk (hold Shift to run) |
| Space / E | Build, upgrade or recruit at the plot you're standing on |
| F | Army: march on the Black Keep / fall back to the outer wall |
| N | Call the night early |
| P / Esc | Pause |
| M | Mute |

On phones and tablets, on-screen buttons appear.

## How it plays

- **Gold** comes from your keep and houses at dawn, coins that farms drop during the day, and coins raiders drop when they die. Walk over coins to pick them up.
- **Plots** are marked with little flags. Stand on one to see what it costs.
  - Houses and farms grow your income. Walls block raiders. Archer towers shoot on their own.
  - The barracks, archery range and siege workshop recruit swordsmen, archers and catapults.
- **Nights** bring a wave from the war camp in the east. Each wave is bigger than the last. Dawn heals your buildings and soldiers.
- **The siege**: the Black Keep sits behind a wall and two towers, and sends out guards when your army gets close. Catapults are the best way to break stone. Destroy the keep to win; lose your own keep and it's over.

## Files

- `index.html` – page and touch controls
- `style.css` – page styling
- `game.js` – the whole game (logic + hand-drawn rendering on a canvas)
