# Inkmate

Chess on a 10×10 notebook page, scribbled in ink, with card packs.

Normal chess rules, a bigger board and two Archers each to start. Every turn you either **move a piece or play a card**.
You earn coins (1 a turn, more for captures), and 5 coins buys a pack of 3 cards. Opening a pack doesn't use your turn.
Packs hold new units (catapults, tanks, wizards, dragons… and, if you're lucky, an **F-15 Fighter Jet**), spells and coins.

**Play:** open `index.html` in a browser. No build step, no dependencies. Play the computer (the Ink Baron) or two players on one device.

## Units

| Unit | How it moves | Where from |
| --- | --- | --- |
| King, Queen, Rook, Bishop, Knight, Pawn | Like normal chess (no castling or en passant; pawns promote to Queen) | Start; most are in packs too |
| Archer | Steps 1 any way; shoots the first enemy within 2 squares and stays put | Start, Uncommon |
| Stone Wall | Never moves. Blocks. | Common |
| Wizard | Knight jump, or up to 2 diagonally | Uncommon |
| Catapult | Rolls 1 straight; lobs over anything at an enemy 2–3 squares away in a line | Rare |
| Tank | Up to 3 in straight lines; pawns can't capture it | Rare |
| Dragon | Flies up to 3 any direction, over pieces | Epic |
| F-15 Fighter Jet | Flies any distance any direction, over everything | Legendary |

Units from cards are summoned onto an empty square in your back three rows.

## Spells and coins

Freeze, Shield, Call to Arms, Knighted, Fireball, Teleport, Lightning Strike, Royal Decree, Meteor (legendary), plus Coin Pouch, Fat Purse and Treasure Chest.
Open **Units & cards** in the game to see every card and a move diagram for every unit.

## Files

- `index.html` – page layout and dialogs
- `style.css` – notebook styling, cards, pack opening
- `game.js` – rules engine, computer opponent, cards, and all the hand-drawn art (drawn live on canvas)

The earlier side-scrolling siege prototype (Inkhold) is in the git history.
