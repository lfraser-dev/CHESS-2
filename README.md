# Inkmate

Chess on a 10×10 notebook page, scribbled in ink, with card packs.

Normal chess rules, a bigger board and two Archers each to start. Every turn you either **move a piece or play a card**.
You earn coins (1 a turn, more for captures) and spend them in the pack shop. Buying and opening packs doesn't use your turn.
There are 92 cards: units, rule-bending spells and coins, across a Classic set and four collab sets.

**Play:** open `index.html` in a browser. No build step, no dependencies. Play the computer (the Ink Baron) or two players on one device.

## Units

| Unit ## Packs

| Pack | Cost | Flavour |
| --- | --- | --- |
| Inkmate Classic | 5 | The core set |
| Iron Crusade | 7 | Grimdark space knights: armour, drop pods, orbital strikes, the Titan Walker |
| Dust & Daring | 6 | Wild West: sheriffs, bandits, bounties, heists, The Stranger |
| Monster Mayhem | 7 | B-movie monsters: tentacles, eggs, toxic goo, the Lizard King |
| Plunder | 6 | Pirates: cannons, mutiny, buried treasure, the Kraken |

## Cards that bend the rules

- **Board-wide effects:** Ouroboros (left and right edges join up), White Flag (no captures), Knightmare (pawns jump like knights), Backpedal (pawns step back)
- **Terrain:** pits, walls of fire, holy ground, hidden landmines, toxic spills
- **Statuses:** freeze, shield, armour, curses, strapped-on bombs, bounties, rebirth (Phoenix), hatching (Dragon Egg)
- **Turn tricks:** Double Time (extra turn), Rewind (undo their last turn), Swap Hands, Sticky Fingers, Spilled Ink, Pickpocket
- **Board tricks:** Mind Control, Mutiny, Chicken Curse, Ink Clone, Teleport, Swap Spots, Lasso, Earthquake, Mirror Mirror, Meteor, Orbital Strike

Flying units can only attack a king along a clear line, so nothing gives unblockable check from across the board.

## Recycling

Tap **Recycle cards** to scrap cards for coins (Common 1, Uncommon 2, Rare 3, Epic 5, Legendary 8), or trade 3 cards of the same rarity for 1 random card of the next rarity up. Recycling doesn't use your turn.

Open **Units & cards** in the game to see every card and a move diagram for every unit.

x.html` – page layout and dialogs
- `style.css` – notebook styling, cards, pack opening
- `engine.js` – rules, units, terrain and effects, every card, packs, and the computer opponent
- `art.js` – all the hand-drawn art, drawn live on canvas
- `game.js` – board, turns, shop, recycling, pack opening

The earlier side-scrolling siege prototype (Inkhold) is in the git history.
