# PRD 002: Zener Game Sounds

**Status:** draft
**Author:** cookie
**Date:** 2026-03-31

## Goal

Change the shock sound effect in the game to randomly play one of the shock sound effects located in
`public/sounds/shock/`.  Remove the bell sound effect.

After the game has begun, play one of the sounds in `public/sounds/before` at a random interval 
between 2 and 5 seconds after the card is revealed and before the user makes their prediction.
The sound should be randomly selected from the sounds in the `before` directory, and should not repeat
until all sounds have been played, nor should the same sound be played twice in a row.

If the user makes an incorrect prediction, play the shock sound effect immediately, and then 
play one of the sounds in `public/sounds/wrong` at a random interval between 0.7 and 1.5 seconds 
after the shock sound effect. The sound should be randomly selected from the sounds in the `wrong` 
directory, and should not repeat until all sounds have been played, nor should the same sound be played twice in a row.

## Scope

- Changing sound effects
- Nothing else related to the game logic, UI, or design is included in this PRD.
