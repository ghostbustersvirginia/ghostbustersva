# PRD 001: Zener Card Deck

**Status:** draft
**Author:** cookie
**Date:** 2026-03-30

## Goal

Create a zener card deck game for use in ESP testing.
The deck should include 25 cards with 5 different symbols
(circle, plus, wavy lines, square, star), each symbol appearing on 5 cards.

In the game, the user will be shown a card back and be asked to predict the
symbol on the card by clicking on button indicating the symbol that they predict.
After the user makes a prediction, the card will flip to reveal the symbol,
and the user's prediction will be recorded as correct or incorrect.

Based on the current probability that the prediction would be correct
(initially 20% for random guessing), the user will be given a score for each
correct prediction. The score will be calculated as 20 points times the
inverse of the probability (e.g., if the probability is 20%,
a correct prediction would earn 100 points), rounded up.

There is a button labeled 'Begin'. When the user clicks this button, the deck
should animate as if it is being shuffled, the cards should be randomized and then the first card 
should be slid to the left.
and displayed face down. The user can then make their prediction by clicking on one of the symbol buttons.

After they make their prediction, the card will raise up and flip to reveal the symbol, and the 
user's score will be updated based on whether their prediction was correct or incorrect. The next card will then slide in from the right,
and the process will repeat until all cards have been revealed.

Every incorrect prediction should cause the screen to shake briefly, and the sound of an 
electric shock should play. Every correct prediction should cause the screen to flash briefly, and the sound of a bell should play.

As the number of incorrect predictions increases, the background of the game should 
darken, to a maximum of 50% opacity after 10 incorrect predictions.

# Scope

- Implement the logic and UI for the zener card deck game, including:
  - Shuffling and displaying cards
  - Allowing the user to make predictions
  - Flipping cards to reveal symbols
  - Calculating and displaying scores based on prediction accuracy

## Requirements

1. The game is written in react and typescript.
2. the symbols and card backs are svg images and scaled according to the browser window size.
3. The game should be responsive and work on both desktop and mobile devices.
4. The game should have a visually appealing design and smooth animations for shuffling and flipping cards
5. The score should be displayed prominently on the screen, and should update in real time as the 
   user makes predictions.
6. The background should darken smoothly as the number of incorrect predictions increases, with 
   the opacity increasing by 5% for each incorrect prediction, up to a maximum of 50%

## Design Notes

- the card back is located at `src/assets/card-back.svg`
- the symbols are located at `src/assets/symbols/` and are named `circle.svg`, `plus.svg`, `wavy-lines.svg`, `square.svg`, and `star.svg`.
