# Inkmate

Chess on a 15×15 notebook board, scribbled in ink, with card packs.

A normal chess army each (plus two Archers) on a 15×15 board. Scroll or pinch to zoom in, drag to look around. Every turn you either **move a piece or play a card**.
You earn coins (1 a turn, more for captures) and spend 5 to open a pack. Opening packs doesn't use your turn.
There is **one pack with all 127 cards** in it: units, rule-bending spells, coins, and the **NUKE**.

**Play:** open `index.html` in a browser. No build step, no dependencies. Play the computer (the Ink Baron) or two players on one device.

## Rarity tiers

Scribble · Sketch · Inked · Masterpiece · Legendary

## Highlights

- **Dropship:** drops a 4×4 squad of 16 Line Troopers (move 1, shoot 2)
- **Non-chess units:** Siege Tank, Gunship, Battle Mech, Sniper, Flame Trooper, Mortar Team, Field Medic, Necromancer, Vampire, Werewolf, Samurai, Ninja, UFO, Ogre, Bulldozer, Robot Vacuum, Cow, Screaming Pagoda, Shopping Trolley, Rubber Duck, Lawn Gnome, Pigeon, Vending Machine, Grandma, Toaster, Pogo Kid, Ink Blob, Star Paladin, Titan Walker, Sheriff, The Stranger, Kraken, Lizard King, Dragon, F-15 Fighter Jet, Golden Goose and more
- **NUKE (Legendary):** full cutscene (press **Test nuke cutscene** to watch it any time), then a 5×5 blast, a crater and radioactive ground that curses anything stopping on it
- **Execute:** chop any enemy piece one of yours is already attacking
- **Rule benders:** Ouroboros (left and right edges join up), White Flag, Knightmare, Backpedal, Rewind, Double Time, Swap Hands, Mind Control, Earthquake, Mirror Mirror, Banana Peel, Landmine, Coin Flip, Party Time, Tax Day and more
- **Recycling:** scrap cards for coins (Scribble 1 · Sketch 2 · Inked 3 · Masterpiece 5 · Legendary 8), or trade 3 of the same tier for 1 card a tier up

Flying units can only attack a king along a clear line, so nothing gives unblockable check from across the board.

## Cutscene quality

The **Cutscene** menu at the top sets how the NUKE cinematic is drawn:

- **Auto (safe)**, the default: tests your device with a tiny frame first and only uses 3D if it can keep up. Chromebooks get Light 3D at most. If it starts lagging, it switches to the simple version and remembers.
- **Light 3D**: fewer effects, lower resolution.
- **Full 3D**: needs a strong graphics card (still drops to simple if it lags).
- **Simple 2D**: the hand-drawn version, runs anywhere.

## Nuke music

The song in `assets/nuke-theme.mp3` plays during the cutscene. You can also click **Nuke music** to pick a different file. The captions beside the falling bomb are in `NUKE_LINES` near the top of the cutscene section in `game.js`; write your own there.

Open **Units & cards** in the game for every card, a move diagram for every unit, and a button to watch the nuke.

## Files

- `index.html` – page layout and dialogs
- `style.css` – notebook styling, cards, pack opening, cutscene
- `engine.js` – rules, units, terrain and effects, every card, the pack, and the computer opponent
- `art.js` – all the hand-drawn art, drawn live on canvas
- `game.js` – board, turns, shop, recycling, pack opening
- `cinema3d.js` – the NUKE cinematic's real-time 3D: raymarched chess set, metal bomb, volumetric clouds, fireball, mushroom cloud and shockwave (WebGL)
- `cinema.js` – the cinematic's timeline, titles, captions, letterbox, grain and flashes (plus a 2D fallback if WebGL isn't available)
- `assets/` – drop `nuke-theme.mp3` here

Earlier prototypes (Inkhold, the side-scrolling siege game) are in the git history.
