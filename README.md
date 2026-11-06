# Chess 2

*The sequel nobody asked for.*

Chess on a 15×15 notebook board, scribbled in ink, with card packs and absolutely no stability.

A normal chess army each (plus two Archers) on a 15×15 board. Scroll or pinch to zoom in, drag to look around. Every turn you either **move a piece or play a card**.
You earn coins (1 a turn, more for captures) and spend 5 to open a pack. Opening packs doesn't use your turn.
There is **one pack with all 127 cards** in it: units, rule-bending spells, coins, and the **NUKE**.

**Play:** open `index.html` in a browser. No build step, no dependencies. Play the computer (the Ink Baron) or two players on one device.

## Randomness

Pick **how random** on the start screen:

| Level | What happens |
| --- | --- |
| Calm | Normal starting armies, no events |
| Mild | Shuffled armies, a random thing every 3 rounds |
| Wild (default) | Shuffled armies, random things all the time |
| Unhinged | The board fills up with stuff, and lots of mutations |

**Random things** keep turning up on the board. Walk a piece onto one and:

- **Pomegranate:** it eats it and sprays seeds everywhere. Enemies next to it are too sticky to move next turn.
- **Marker:** it draws a new piece next to itself (a horse, a chicken, Grandma...) and the drawing comes to life.
- **Gem:** +3 coins. Whoever grabs your side's third gem ascends into a Queen (a Queen becomes a fighter jet).
- **Wedding ring:** it marries the nearest piece on its side. Both get +1 armour and a baby is born. A king's royal wedding turns his partner into a Queen.
- **Disco ball:** dance party. Every enemy within 2 squares dances instead of moving next turn.
- **Birthday cake:** it grows up: Pawn to Knight to Bishop to Rook to Queen.

## Brainrot meter and special moves

The **Brainrot meter** above the board fills every turn (faster with captures, specials and random things). Each time it crosses a line, a short popup names the next act and crazier **special moves** unlock:

| Meter | Act |
| --- | --- |
| 0% | ACT I: A Normal Game of Chess |
| 15% | ACT II: Something Is Off |
| 35% | ACT III: Chess in Ohio |
| 55% | ACT IV: Total Brainrot (more random things) |
| 75% | ACT V: Completely Unhinged |
| 100% | THE FINALE: both kings get a NUKE card, a meteor lands every turn, and anything can self-destruct |

Tap one of your pieces to see its special moves. Using one takes your turn (except the queen's Steal the Next Turn), and then specials recharge for a couple of turns. The Ink Baron uses them too.

- **Pawn:** Google en passant · Call in an airstrike
- **Knight:** Walk off the board (into another dimension, and back 2 turns later in enemy territory) · Double horsey
- **Bishop:** Turn 90 degrees · Convert an enemy
- **Rook:** Castle with anything · Roll across the board
- **Queen:** Steal the next turn · Throw a tantrum
- **King:** Eat his own piece (for coins) · Call his mum (Grandma turns up)
- **Anything but the king:** Hit the griddy (freezes enemies next to it) · Go get snacks · Eat the piece next to it · Self-destruct (finale only)

Every move gets a meme caption ("White: *googles en passant*"), with reaction text, dramatic zoom-ins, move annotations (!!, ??, ?!) and synthesised sound stings. On **Calm** there's no meter and no specials.

## Boss fight

At **THE FINALE**, **MEGA HORSEY** lands in the middle of the board: a giant crowned horse that takes up 2×2 squares, has 18 health and belongs to nobody. To hit it, select a piece next to it (or a shooter within 3 squares) and click the boss. That uses your turn and deals damage based on the piece's value. Every round it attacks whoever is near: it **stomps** (destroys up to 2 pieces next to it), fires **eye lasers** along a row, **neighs** so loud everything nearby freezes, or **charges** towards the biggest crowd. Spells that hit it hurt it too, and a NUKE does 12. Whoever lands the final blow gets 15 coins, and that piece gets 2 armour and super speed. To summon it any time, open **Units & cards**.

## Talking pieces and the highlights reel

Pieces talk in speech bubbles: they brag when they capture, say their last words when they're taken, the king screams when he's in check, and bored pieces chat while you think.

When the game ends you can **watch the highlights**: a vertical replay of the biggest moments (captures, special moves, random items, meteors, nukes and the checkmate) with captions and reactions, like a Short.

**Mutations:** a piece that captures may mutate and gain a power: jumping like a knight, stepping like a king, sliding straight or diagonally, flying over pieces, zooming 6 squares, or growing a gun. Mutated pieces show a green star with the number of mutations.

**Shuffled armies:** the back row is shuffled and three pieces are swapped for random weird units (both sides get the same lineup).

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

## Battle cam

When one piece takes another, a comic-book close-up plays over the board: the attacker winds up and dashes in (or fires), a black-and-white impact frame with a big word ("SLASH!", "BANG!", "CLANG!", "SHLURP!"...), and the loser goes flying with cracks and ink splatter. Every unit has its own attack: swords, guns, cannons, catapult rocks, flamethrowers, tentacles, dragon fire, missiles, tractor beams and more. Set it in the **Battle cam** menu: Big captures (default), Every capture, or Off. Click the close-up to skip it.

On the board itself, attackers wind up and lunge with a motion trail, hits throw sparks and shake the board, and captured pieces get knocked flying.

## Cutscene quality

The **Cutscene** menu at the top sets how the NUKE cinematic plays:

- **Full 3D movie (best)**, the default: the 3D scene is pre-rendered into `assets/nuke-cinematic.mp4`, so it plays smoothly on any device, Chromebooks included. Titles, captions, flashes, grain and sound are drawn live on top, synced to the video.
- **Live 3D (strong PC only)**: renders the scene in real time with WebGL. Tests your device first and drops to the simple version if it lags.
- **Simple 2D**: the hand-drawn version.

To re-render the movie after changing `cinema3d.js`, render frames 4.4s–22.2s at 24 fps with `INK.NukeGL.create(canvas, 1).draw(t, 854, 480, true)` and encode them with ffmpeg (H.264, yuv420p).

## Nuke music

The song in `assets/nuke-theme.mp3` plays during the cutscene. You can also click **Nuke music** to pick a different file. The captions beside the falling bomb are in `NUKE_LINES` near the top of the cutscene section in `game.js`; write your own there.

Open **Units & cards** in the game for every card, a move diagram for every unit, and a button to watch the nuke.

## Files

- `index.html` – page layout and dialogs
- `style.css` – notebook styling, cards, pack opening, cutscene
- `engine.js` – rules, units, terrain and effects, every card, the pack, and the computer opponent
- `art.js` – all the hand-drawn art, drawn live on canvas
- `game.js` – board, turns, shop, recycling, pack opening
- `battle.js` – the battle cam close-ups
- `items.js` – the random things on the board and their drawings
- `talk.js` – what the pieces say, and the speech bubbles
- `replay.js` – the end-of-game highlights reel
- `boss.js` – MEGA HORSEY, the finale boss
- `memes.js` – the Brainrot meter, the acts, special moves, and meme captions
- `cinema3d.js` – the NUKE cinematic's real-time 3D: raymarched chess set, metal bomb, volumetric clouds, fireball, mushroom cloud and shockwave (WebGL)
- `cinema.js` – the cinematic's timeline, titles, captions, letterbox, grain and flashes (plus a 2D fallback if WebGL isn't available)
- `assets/` – drop `nuke-theme.mp3` here

Earlier prototypes (Inkhold, the side-scrolling siege game) are in the git history.
