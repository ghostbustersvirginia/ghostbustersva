/**
 * ZenerGame — Interactive Zener card ESP test game.
 * PRD 001: Zener Card Deck
 * PRD 002: Zener Game Sounds
 *
 * 25-card deck (5 symbols × 5). User predicts each card's symbol;
 * score is based on the inverse probability of a correct guess.
 * Incorrect answers shake the screen + play a random shock sound, followed
 * by a random "wrong" quip 0.7–1.5 s later.
 * Correct answers flash the screen.
 * While waiting for a prediction, a random "before" prompt plays 2–5 s after
 * the card appears.
 * Background darkens 5% per wrong answer, up to 50% at 10 wrong.
 */

import { useState, useCallback, useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type ZenerSymbol = "circle" | "plus" | "wavy-lines" | "square" | "star";

type Phase =
  | "idle"
  | "shuffling"
  | "waiting" // card face-down, awaiting prediction
  | "flipping" // card is animating the flip
  | "revealed" // symbol visible, brief pause before next card
  | "complete";

type ScreenEffect = "none" | "flash" | "shake";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                  */
/* ------------------------------------------------------------------ */

const SYMBOLS: ZenerSymbol[] = ["circle", "plus", "wavy-lines", "square", "star"];

function buildDeck(): ZenerSymbol[] {
  return [...SYMBOLS, ...SYMBOLS, ...SYMBOLS, ...SYMBOLS, ...SYMBOLS];
}

function shuffleDeck(deck: ZenerSymbol[]): ZenerSymbol[] {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Score for a correct prediction: ceil(20 / probability). */
function calcScore(predicted: ZenerSymbol, remaining: ZenerSymbol[]): number {
  if (remaining.length === 0) return 0;
  const count = remaining.filter((s) => s === predicted).length;
  if (count === 0) return 0; // symbol exhausted — no points (can't be correct)
  const probability = count / remaining.length;
  return Math.ceil(20 / probability);
}

/* ------------------------------------------------------------------ */
/* Inline SVG paths (source: src/assets/symbols/*.svg)                 */
/* ------------------------------------------------------------------ */

const SYMBOL_SVGS: Record<ZenerSymbol, string> = {
  circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30.005 30.265" role="img" aria-label="Circle"><path d="M28.594 15.133c0 7.574-6.089 13.721-13.591 13.721-7.503 0-13.592-6.147-13.592-13.721 0-7.575 6.09-13.722 13.592-13.722s13.591 6.147 13.591 13.722" style="fill:none;stroke:currentColor;stroke-width:2.82222;stroke-linecap:round;stroke-linejoin:round"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.725 28.725" role="img" aria-label="Plus"><path d="M14.363 0v28.725m14.362-14.362H0" style="fill:none;stroke:currentColor;stroke-width:3.38667;stroke-linecap:butt"/></svg>`,
  "wavy-lines": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.275 29.777" role="img" aria-label="Wavy lines"><path d="M214.184 162.236c2.518-5.123 3.29-11.334.533-16.517-2.07-4.177-4.85-7.798-7.415-11.67-4.07-5.266-7.264-11.836-5.81-18.527.764-4.845 3.717-9.023 6.023-13.257 2.258-3.72 4.484-7.759 5.546-12.05 1.134-5.885-.644-14.509-4.693-19.127l12.096.005c2.861 4.494 6.141 9.345 5.593 14.857.466 7.21-4.204 13.332-7.353 19.506-3.75 5.877-6.528 13.344-3.436 20.033 2.882 6.344 7.646 11.689 11.053 17.776 2.864 4.524 3.094 10.16 1.963 15.212-2.125 5.6-5.19 12.689-7.71 18.122l-13.117-.017c1.655-5 4.44-9.593 6.727-14.346" style="fill:currentColor" transform="translate(-51.048 -20.063)scale(.28222)"/><path d="M193.926 162.236c2.519-5.123 3.291-11.334.533-16.517-2.07-4.177-4.85-7.798-7.415-11.67-4.07-5.266-7.263-11.836-5.81-18.527.765-4.845 3.717-9.023 6.023-13.257 2.259-3.72 4.484-7.759 5.547-12.05 1.133-5.885-.644-14.509-4.694-19.127l12.096.005c2.862 4.494 6.142 9.345 5.593 14.857.466 7.21-4.204 13.332-7.353 19.506-3.75 5.877-6.528 13.344-3.435 20.033 2.882 6.344 7.645 11.689 11.052 17.776 2.864 4.524 3.095 10.16 1.963 15.212-2.125 5.6-5.19 12.689-7.71 18.122l-13.117-.017c1.655-5 4.44-9.593 6.727-14.346M234.441 162.236c2.519-5.123 3.291-11.334.533-16.517-2.069-4.177-4.85-7.798-7.414-11.67-4.071-5.266-7.264-11.836-5.81-18.527.764-4.845 3.717-9.023 6.022-13.257 2.259-3.72 4.484-7.759 5.547-12.05 1.134-5.885-.644-14.509-4.693-19.127l12.095.005c2.862 4.494 6.142 9.345 5.593 14.857.466 7.21-4.204 13.332-7.353 19.506-3.75 5.877-6.528 13.344-3.435 20.033 2.882 6.344 7.645 11.689 11.053 17.776 2.863 4.524 3.094 10.16 1.963 15.212-2.126 5.6-5.191 12.689-7.711 18.122l-13.117-.017c1.655-5 4.44-9.593 6.727-14.346" style="fill:currentColor" transform="translate(-51.048 -20.063)scale(.28222)"/></svg>`,
  square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26.934 26.924" role="img" aria-label="Square"><path d="M1.693 1.693h23.548v23.538H1.693Z" style="fill:none;stroke:currentColor;stroke-width:3.38667;stroke-linecap:round"/></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34.812 32.529" role="img" aria-label="Star"><path d="m26.072 29.813-8.726-4.866-8.774 4.75 2.001-9.642-7.329-6.732 9.964-1.094 4.244-8.91 4.156 8.966 9.952 1.225-7.395 6.635z" style="fill:none;stroke:currentColor;stroke-width:2.82222;stroke-linecap:round;stroke-linejoin:miter"/></svg>`,
};

const SYMBOL_LABELS: Record<ZenerSymbol, string> = {
  circle: "Circle",
  plus: "Plus",
  "wavy-lines": "Wavy Lines",
  square: "Square",
  star: "Star",
};

/* ------------------------------------------------------------------ */
/* Sound files                                                          */
/* ------------------------------------------------------------------ */

const SHOCK_FILES = ["/sounds/shock/shock-1.mp3", "/sounds/shock/shock-2.mp3"];

const BEFORE_FILES = [
  "/sounds/before/clear-your-head.mp3",
  "/sounds/before/tell-me-what-you-think-it-is.mp3",
  "/sounds/before/think-hard.mp3",
  "/sounds/before/what-is-it.mp3",
  "/sounds/before/whats-this-one.mp3",
];

const WRONG_FILES = [
  "/sounds/wrong/good-guess.mp3",
  "/sounds/wrong/isnt-your-lucky-day.mp3",
  "/sounds/wrong/wrong-1.mp3",
  "/sounds/wrong/wrong-2.mp3",
];

const RIGHT_FILES = [
  "/sounds/right/incredible.mp3",
  "/sounds/right/there-are-some-things.mp3",
  "/sounds/right/theres-something-you-dont-see-every-day.mp3",
  "/sounds/right/very-good-thats-great.mp3",
  "/sounds/right/you-are-a-legitimate-phenomenon.mp3",
  "/sounds/right/you-cant-see-these-can-you.mp3",
  "/sounds/right/youre-not-cheating-me-are-you.mp3",
];

/* ------------------------------------------------------------------ */
/* SoundQueue — shuffle bag: no repeats until exhausted,               */
/*              never plays the same sound twice in a row.             */
/* ------------------------------------------------------------------ */

class SoundQueue {
  private files: string[];
  private queue: string[] = [];
  private lastPlayed: string | null = null;

  constructor(files: string[]) {
    this.files = files;
    this.refill();
  }

  private refill(): void {
    const shuffled = [...this.files];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Ensure the new head is never the same as the last played
    if (shuffled.length > 1 && shuffled[0] === this.lastPlayed) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    this.queue = shuffled;
  }

  next(): string {
    if (this.queue.length === 0) this.refill();
    const sound = this.queue.shift()!;
    this.lastPlayed = sound;
    return sound;
  }
}

let currentAudio: HTMLAudioElement | null = null;

function playSound(src: string): void {
  try {
    // Don't start a new sound while another one is still playing
    if (currentAudio && !currentAudio.paused) return;
    const audio = new Audio(src);
    currentAudio = audio;
    audio.play().catch(() => {
      /* ignore browser autoplay-policy rejections */
    });
  } catch {
    /* ignore environments where Audio is unavailable */
  }
}

/* ------------------------------------------------------------------ */
/* SymbolIcon component                                                 */
/* ------------------------------------------------------------------ */

function SymbolIcon({ symbol, className = "" }: { symbol: ZenerSymbol; className?: string }) {
  return (
    <span
      className={`zener-symbol-icon ${className}`}
      aria-hidden="true"
      // SVG content is from local asset files — not user-supplied
      dangerouslySetInnerHTML={{ __html: SYMBOL_SVGS[symbol] }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function ZenerGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [deck, setDeck] = useState<ZenerSymbol[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prediction, setPrediction] = useState<ZenerSymbol | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [lastResult, setLastResult] = useState<"correct" | "incorrect" | null>(null);
  const [screenEffect, setScreenEffect] = useState<ScreenEffect>("none");
  const [cardSlide, setCardSlide] = useState<"slide-in" | "slide-out" | "center" | "none">("none");
  const [isFlipped, setIsFlipped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const shockQueueRef = useRef(new SoundQueue(SHOCK_FILES));
  const beforeQueueRef = useRef(new SoundQueue(BEFORE_FILES));
  const wrongQueueRef = useRef(new SoundQueue(WRONG_FILES));
  const rightQueueRef = useRef(new SoundQueue(RIGHT_FILES));

  /* Detect reduced motion preference */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Play a random "before" prompt 2–5 s after each card appears.
     The effect cleanup cancels the timer if the user predicts first. */
  useEffect(() => {
    if (phase !== "waiting") return;
    const delay = 2000 + Math.random() * 3000; // 2000–5000 ms
    const timer = setTimeout(() => {
      playSound(beforeQueueRef.current.next());
    }, delay);
    return () => clearTimeout(timer);
  }, [phase]);

  /* Trigger a brief screen effect (cleared after animation) */
  const triggerEffect = useCallback(
    (effect: ScreenEffect) => {
      if (reducedMotion) return;
      setScreenEffect(effect);
      setTimeout(() => setScreenEffect("none"), effect === "shake" ? 500 : 300);
    },
    [reducedMotion],
  );

  /* Begin — shuffle deck and deal first card */
  const handleBegin = useCallback(() => {
    const shuffled = shuffleDeck(buildDeck());
    setDeck(shuffled);
    setCurrentIndex(0);
    setTotalScore(0);
    setIncorrectCount(0);
    setPrediction(null);
    setLastResult(null);
    setIsFlipped(false);

    setPhase("shuffling");

    // After shuffle animation, slide in first card
    const shuffleMs = reducedMotion ? 50 : 900;
    setTimeout(() => {
      setCardSlide("slide-in");
      setPhase("waiting");
      setTimeout(() => setCardSlide("center"), reducedMotion ? 0 : 400);
    }, shuffleMs);
  }, [reducedMotion]);

  /* Prediction made — flip the card */
  const handlePredict = useCallback(
    (sym: ZenerSymbol) => {
      if (phase !== "waiting") return;
      setPrediction(sym);
      setPhase("flipping");

      const flipMs = reducedMotion ? 0 : 600;

      // Flip card
      setIsFlipped(true);

      setTimeout(() => {
        const currentCard = deck[currentIndex];
        const isCorrect = sym === currentCard;
        const remaining = deck.slice(currentIndex); // includes current card
        const score = isCorrect ? calcScore(sym, remaining) : 0;

        setLastResult(isCorrect ? "correct" : "incorrect");
        if (isCorrect) {
          setTotalScore((s) => s + score);
          triggerEffect("flash");
          // Play a random right-answer quip 0.7–1.5 s later
          const rightDelay = 700 + Math.random() * 800;
          setTimeout(() => playSound(rightQueueRef.current.next()), rightDelay);
        } else {
          setIncorrectCount((n) => n + 1);
          triggerEffect("shake");
          // Play a random shock sound immediately
          playSound(shockQueueRef.current.next());
          // Play a random wrong-answer quip 0.7–1.5 s later
          const wrongDelay = 700 + Math.random() * 800;
          setTimeout(() => playSound(wrongQueueRef.current.next()), wrongDelay);
        }

        setPhase("revealed");

        // Auto-advance to next card
        const pauseMs = reducedMotion ? 100 : 1200;
        setTimeout(() => {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= deck.length) {
            setPhase("complete");
          } else {
            // Slide out current card, slide in next
            setCardSlide("slide-out");
            setTimeout(
              () => {
                setIsFlipped(false);
                setPrediction(null);
                setLastResult(null);
                setCurrentIndex(nextIndex);
                setCardSlide("slide-in");
                setPhase("waiting");
                setTimeout(() => setCardSlide("center"), reducedMotion ? 0 : 400);
              },
              reducedMotion ? 0 : 350,
            );
          }
        }, pauseMs);
      }, flipMs);
    },
    [phase, deck, currentIndex, reducedMotion, triggerEffect],
  );

  /* Play again */
  const handleRestart = useCallback(() => {
    setPhase("idle");
    setDeck([]);
    setCurrentIndex(0);
    setPrediction(null);
    setLastResult(null);
    setTotalScore(0);
    setIncorrectCount(0);
    setIsFlipped(false);
    setCardSlide("none");
  }, []);

  /* ---------------------------------------------------------------- */
  /* Derived values                                                     */
  /* ---------------------------------------------------------------- */

  const cardsLeft = deck.length - currentIndex;
  const cardsRemaining = phase === "complete" ? 0 : cardsLeft;

  // Dark overlay opacity: 5% per wrong answer, max 50% at 10
  const overlayOpacity = Math.min(incorrectCount * 0.05, 0.5);

  // Score preview while waiting
  const scorePreviewFor = (sym: ZenerSymbol): number => {
    const rem = deck.slice(currentIndex);
    return calcScore(sym, rem);
  };

  /* ---------------------------------------------------------------- */
  /* CSS class helpers                                                  */
  /* ---------------------------------------------------------------- */

  const gameClasses = ["zener-game", screenEffect !== "none" ? `zener-game--${screenEffect}` : ""]
    .filter(Boolean)
    .join(" ");

  const cardClasses = [
    "zener-card",
    isFlipped ? "zener-card--flipped" : "",
    cardSlide === "slide-in" ? "zener-card--slide-in" : "",
    cardSlide === "slide-out" ? "zener-card--slide-out" : "",
    cardSlide === "center" ? "zener-card--center" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* ---------------------------------------------------------------- */
  /* Render                                                             */
  /* ---------------------------------------------------------------- */

  return (
    <div className={gameClasses} role="main" aria-label="Zener card ESP test">
      {/* Dark overlay that grows with incorrect answers */}
      <div className="zener-bg-overlay" style={{ opacity: overlayOpacity }} aria-hidden="true" />

      {/* Flash overlay */}
      {screenEffect === "flash" && <div className="zener-flash-overlay" aria-hidden="true" />}

      {/* ---- HUD ---- */}
      <div className="zener-hud" aria-live="polite" aria-atomic="true">
        <div className="zener-hud__score">
          <span className="zener-hud__label">Score</span>
          <span className="zener-hud__value">{totalScore}</span>
        </div>
        {phase !== "idle" && phase !== "shuffling" && phase !== "complete" && (
          <div className="zener-hud__cards">
            <span className="zener-hud__label">Cards left</span>
            <span className="zener-hud__value">{cardsRemaining}</span>
          </div>
        )}
        {phase !== "idle" && (
          <div className="zener-hud__wrong">
            <span className="zener-hud__label">Wrong</span>
            <span className="zener-hud__value">{incorrectCount}</span>
          </div>
        )}
      </div>

      {/* ---- Idle: deck + Begin button ---- */}
      {phase === "idle" && (
        <div className="zener-intro">
          <div className="zener-deck-stack" aria-hidden="true">
            {[4, 3, 2, 1, 0].map((i) => (
              <div
                key={i}
                className="zener-deck-card"
                style={{
                  transform: `translateY(${i * -3}px) rotate(${(i - 2) * 1.5}deg)`,
                  zIndex: 5 - i,
                }}
              />
            ))}
          </div>
          <p className="zener-intro__prompt">
            Can you sense what&apos;s on each card? Test your ESP with 25 Zener cards.
          </p>
          <button className="zener-btn zener-btn--primary" onClick={handleBegin}>
            Begin
          </button>
        </div>
      )}

      {/* ---- Shuffling animation ---- */}
      {phase === "shuffling" && (
        <div className="zener-shuffle" aria-label="Shuffling cards…" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="zener-shuffle__card"
              style={{ animationDelay: `${i * 0.12}s` }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* ---- Active game: card + controls ---- */}
      {(phase === "waiting" || phase === "flipping" || phase === "revealed") && (
        <div className="zener-stage">
          {/* Card */}
          <div className="zener-card-wrapper" aria-label={`Card ${currentIndex + 1} of 25`}>
            <div className={cardClasses}>
              <div className="zener-card__face zener-card__face--back" aria-hidden="true"></div>
              <div className="zener-card__face zener-card__face--front">
                {prediction && (
                  <div className="zener-card__revealed">
                    <SymbolIcon symbol={deck[currentIndex]} className="zener-card__symbol" />
                    {/*{lastResult && (*/}
                    {/*  <span*/}
                    {/*    className={`zener-result-badge zener-result-badge--${lastResult}`}*/}
                    {/*    aria-label={lastResult === "correct" ? "Correct!" : "Incorrect"}*/}
                    {/*  >*/}
                    {/*    {lastResult === "correct" ? "✓" : "✗"}*/}
                    {/*  </span>*/}
                    {/*)}*/}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Symbol buttons */}
          <div className="zener-symbols" role="group" aria-label="Choose the symbol you predict">
            {SYMBOLS.map((sym) => {
              return (
                <button
                  key={sym}
                  className={[
                    "zener-symbol-btn",
                    prediction === sym ? "zener-symbol-btn--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handlePredict(sym)}
                  disabled={phase !== "waiting"}
                  aria-pressed={prediction === sym}
                >
                  <SymbolIcon symbol={sym} />
                  <span className="zener-symbol-btn__label">{SYMBOL_LABELS[sym]}</span>
                </button>
              );
            })}

          </div>

          {/*/!* Prediction result feedback *!/*/}
          {phase === "revealed" && lastResult && (
            <div
              className={`zener-feedback zener-feedback--${lastResult}`}
              aria-live="assertive"
              role="status"
            >
              {lastResult === "correct" ? (
                <>
                  <span className="zener-feedback__icon">⚡</span>
                  Correct! {calcScore(prediction!, deck.slice(currentIndex))} pts
                </>
              ) : (
                 <>
                   <span className="zener-feedback__icon">⚡</span>
                   Incorrect — it was <strong>{SYMBOL_LABELS[deck[currentIndex]]}</strong>
                 </>
               )}
            </div>
          )}
        </div>
      )}

      {/* ---- Complete ---- */}
      {phase === "complete" && (
        <div className="zener-complete" role="region" aria-label="Game complete">
          <h2 className="zener-complete__heading">Test Complete!</h2>
          <div className="zener-complete__score-wrap" aria-label={`Final score: ${totalScore}`}>
            <span className="zener-complete__score-label">Final Score</span>
            <span className="zener-complete__score-value">{totalScore}</span>
          </div>
          <p className="zener-complete__summary">
            {incorrectCount === 0
              ? "Perfect score! Are you really psychic?"
              : incorrectCount <= 5
                ? "Strong performance — your ESP is showing!"
                : incorrectCount <= 15
                  ? "Not bad — keep practicing your focus."
                  : "The spirits were not cooperative today."}
          </p>
          <div className="zener-complete__stats">
            <span>
              Correct: <strong>{25 - incorrectCount}</strong>
            </span>
            <span>
              Incorrect: <strong>{incorrectCount}</strong>
            </span>
          </div>
          <button className="zener-btn zener-btn--primary" onClick={handleRestart}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
