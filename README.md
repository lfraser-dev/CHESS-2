# Inkmate

Chess on a 10×10 notebook page, scribbled in ink, with card packs.

Normal chess rules, a bigger board and two Archers each to start. Every turn you either **move a piece or play a card**.
You earn coins (1 a turn, more for captures) and spend 5 to open a pack. Opening packs doesn't use your turn.
There is **one pack with all 108 cards** in it: units, rule-bending spells, coins, and the **NUKE**.

**Play:** open `index.html` in a browser. No build step, no dependencies. Play the computer (the Ink Baron) or two players on one device.

## Rarity tiers

Scribble · Sketch · Inked · Masterpiece · Legendary

## Highlights

- **Non-chess units:** Screaming Pagoda, Shopping Trolley, Rubber Duck, Lawn Gnome, Pigeon, Vending Machine, Grandma, Toaster, Pogo Kid, Ink Blob, Star Paladin, Titan Walker, Sheriff, The Stranger, Kraken, Lizard King, Dragon, F-15 Fighter Jet, Golden Goose and more
- **NUKE (Legendary):** full-screen cutscene, then a 5×5 blast, a crater and radioactive ground that curses anything stopping on it
- **Execute:** chop any enemy piece one of yours is already attacking
- **Rule benders:** Ouroboros (left and right edges join up), White Flag, Knightmare, Backpedal, Rewind, Double Time, Swap Hands, Mind Control, Earthquake, Mirror Mirror, Banana Peel, Landmine, Coin Flip, Party Time, Tax Day and more
- **Recycling:** scrap cards for coins (Scribble 1 · Sketch 2 · Inked 3 · Masterpiece 5 · Legendary 8), or trade 3 of the same tier for 1 card a tier up

Flying units can only attack a king along a clear line, so nothing gives unblockable check from across the board.

## Nuke music

Click **Nuke music** in the game to pick an audio file from your device (it's remembered in that browser), or put the file at `assets/nuke-theme.mp3`.

Open **Units & cards** in the game for every card, a move diagram for every unit, and a button to watch the nuke.

## Files

- `index.html` – page layout and dialogs
- `style.css` – notebook styling, cards, pack opening, cutscene
- `engine.js` – rules, units, terrain and effects, every card, the pack, and the computer opponent
- `art.js` – all the hand-drawn art, drawn live on canvas
- `game.js` – board, turns, shop, recycling, pack opening, nuke cutscene
- `assets/` – drop `nuke-theme.mp3` here

Earlier prototypes (Inkhold, the side-scrolling siege game) are in the git history.
