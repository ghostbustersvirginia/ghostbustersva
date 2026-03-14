# LED Scrollbar — Copilot Integration Notes

Quick rundown of how the LED scrollbar was integrated into the site using
GitHub Copilot, and what changed from the original code (and why).

---

## How I used Copilot for this

I open **GitHub Copilot Chat** in VS Code (the sidebar panel) and select an
**agent** — a model that can read the whole codebase, create files, edit files,
and run terminal commands on my behalf. Think of it like pair-programming with
someone who already read every file in the repo.

For this task I used **Claude Opus 4.6**, which is great for code review,
optimisation, and integrating new features. I also use:

| Model         | When I reach for it                                                   |
| ------------- | --------------------------------------------------------------------- |
| **Opus 4.6**  | Code review, feature integration, refactors with nuance               |
| **Codex 5.3** | Heavier engineering — architecture decisions, complex multi-file work |
| **Sonnet**    | Design flow — CSS, layout, UX polish                                  |
| **Traycer**   | Large-scale refactors across many files at once                       |

The workflow is simple:

1. I pasted your `readyled.ts` into the repo root.
2. I opened Copilot Chat and told the agent what I wanted — review the code,
   optimise it, convert it to an Astro component, integrate it on the contact
   page, pick a colour that fits the brand.
3. The agent read your code, read the project's design system and conventions,
   identified what to keep and what to improve, then wrote the new component,
   wired it into the contact page, deleted the old file, and ran every check
   (`typecheck`, `lint`, `format`, `test`) — all passing — in one session.

That's it. One conversation, start to finish.

---

## What a single prompt can do

If you ever want to try Copilot yourself, here's the kind of prompt that would
produce a scrollbar like this from scratch:

> _"Create an Astro component called LEDScrollbar. It should render a scrolling
> dot-matrix LED sign with green glowing text in the Elan Bold font that says
> 'WE'RE READY TO BELIEVE YOU! - (804) 482-1217'. Use canvas to rasterise the
> text into a pixel grid, export it as an image, and scroll with a CSS animation.
> Dark housing background, green pixels with a glow effect, dim dots for unlit
> pixels. Respect prefers-reduced-motion. Place it on the contact page."_

One prompt. The agent would produce a working component, wire it in, and verify
it compiles. You'd review, tweak if needed, and ship.

---

## What changed from the original — and why

<details>
<summary><strong>Your original code (readyled.ts) — click to expand</strong></summary>

```typescript
export type ReadyLEDParams = {
  font?: string;
  pixelHeight: number;
  scrollSpeed?: number;
  signWidth?: number;
  target: HTMLElement;
  text: string;
};

export const readyLED = (params: ReadyLEDParams) => {
  const { font, pixelHeight, scrollSpeed = 150, signWidth, target, text } = params;

  let sign;
  if (document.querySelector(".readyled-sign")) {
    sign = document.querySelector(".readyled-sign") as HTMLElement;
    if (sign) {
      sign.innerHTML = "";
    }
  } else {
    sign = document.createElement("div");
    sign.classList.add("readyled-sign");
  }

  const fontSize = 96;
  const renderWidth = Math.ceil(fontSize * 1.2 * text.length);
  const renderHeight = Math.ceil(fontSize * 0.9);
  const pixelWidth = Math.ceil((pixelHeight / renderHeight) * renderWidth);

  const { data, width: clearedWidth } = renderAndResampleText({
    width: renderWidth,
    height: renderHeight,
    text,
    fontSize,
    fontFamily: font ?? "sans-serif",
    sampleHeight: pixelHeight,
    sampleWidth: pixelWidth,
    threshold: 128,
  });

  renderSign({
    data,
    interval: scrollSpeed,
    sampleWidth: clearedWidth,
    signWidth: signWidth ?? pixelWidth,
    target: sign as HTMLElement,
    width: clearedWidth,
    pixelSize: 1,
  });

  sign.style.width = `${signWidth ?? pixelWidth}px`;
  target.appendChild(sign);
};

type RenderAndResampleTextParams = {
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  sampleWidth: number;
  sampleHeight: number;
  threshold?: number;
};

const renderAndResampleText = ({
  text,
  fontSize,
  fontFamily,
  sampleWidth,
  sampleHeight,
  threshold = 128,
}: RenderAndResampleTextParams): { data: boolean[]; width: number } => {
  const canvas = document.createElement("canvas");
  const width = (canvas.width = Math.ceil(fontSize * 1.2 * text.length));
  const height = (canvas.height = fontSize);

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return { data: [], width };
  }

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "black";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, height / 2);

  const src = ctx.getImageData(0, 0, width, height).data;
  const data = new Array(sampleWidth * sampleHeight);

  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      const srcX = Math.floor((x / sampleWidth) * width);
      const srcY = Math.floor((y / sampleHeight) * height);

      const idx = (srcY * width + srcX) * 4;

      const r = src[idx] ?? 0;
      const g = src[idx + 1] ?? 0;
      const b = src[idx + 2] ?? 0;

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      data[y * sampleWidth + x] = luminance < threshold;
    }
  }
  const cleared = clearBlankColumns(data, sampleHeight, sampleWidth);
  return {
    data: cleared,
    width: cleared.length / sampleHeight,
  };
};

const clearBlankColumns = (data: boolean[], height: number, width: number) => {
  const cleared = data.slice();
  for (let i = width - 1; i >= 0; i--) {
    const columnData = [];
    for (let j = 0; j < height; j++) {
      const datum = cleared[j * i + i];
      columnData.push(datum);
    }
    const blankColumn = columnData.filter((d) => d).length === 0;
    if (!blankColumn) {
      break;
    }
    for (let j = height - 1; j >= 0; j--) {
      cleared.splice(j * i + i, 1);
    }
  }
  return cleared;
};

const createPixel = (on: boolean, size: number = 1) => {
  const pixel = document.createElement("div");
  pixel.classList.add("readyled-pixel");
  if (on) {
    pixel.classList.add("readyled-pixel-on");
  }
  pixel.style.width = `${size}em`;
  pixel.style.height = `${size}em`;
  return pixel;
};

type CreatePixelRowParams = {
  data: boolean[];
  rowIndex: number;
  rowSize: number;
  pixelSize: number;
};

const createPixelRow = ({ data, rowIndex, rowSize, pixelSize }: CreatePixelRowParams) => {
  const row = document.createElement("div");
  row.classList.add("readyled-row");
  row.style.width = `${rowSize * 2}em`;
  const rowData = data.slice(rowIndex, rowIndex + rowSize);
  rowData.forEach((rowDatum: boolean) => row.appendChild(createPixel(rowDatum, pixelSize)));
  return row;
};

type RenderSignParams = {
  target: HTMLElement;
  data: boolean[];
  width: number;
  signWidth: number;
  sampleWidth: number;
  pixelSize: number;
  interval: number;
};

const renderSign = function ({
  target,
  data,
  width,
  sampleWidth = Math.round(0.2 * width),
  pixelSize = 0.5,
  interval = 300,
}: RenderSignParams) {
  for (let i = 0, l = data.length - 1; i < l; i += sampleWidth) {
    const row = createPixelRow({
      data,
      rowIndex: i,
      rowSize: sampleWidth,
      pixelSize,
    });
    target.appendChild(row);
  }

  if (target.getAttribute("data-scrolling") !== "true") {
    setInterval(() => {
      target.setAttribute("data-scrolling", "true");
      const rows = document.querySelectorAll(".readyled-row");
      for (let i = 0, l = rows.length; i < l; ++i) {
        const row = rows[i] as HTMLElement;
        const shiftPixel = row.firstElementChild;
        if (!shiftPixel) {
          continue;
        }
        row.appendChild(shiftPixel);
      }
    }, interval);
  }
};

document.fonts.ready.then(() => {
  if (!document.body) {
    console.error("document.body not available");
    return;
  }

  const text = ` WE'RE READY TO BELIEVE YOU! (804) 482-1217 -`;

  let config = {
    pixelHeight: 10,
    scrollSpeed: 150,
    signWidth: 320,
    target: document.body,
    text,
  };

  const readyLEDConfig = document.getElementById("readyled-config");
  if (readyLEDConfig) {
    config = {
      ...config,
      ...JSON.parse(readyLEDConfig.innerText),
    };
  }

  readyLED(config);
});
```

</details>

Your original approach was solid — using an off-screen canvas to rasterise text
into a boolean pixel grid is a genuinely clever technique. That core idea is
kept in the new version. Here's what changed and the reasoning behind each one:

### 1. DOM pixels → canvas-to-image (performance)

**Original:** Every LED "pixel" was its own `<div>`. For a 320 × 10 sign that's
~3,000+ DOM nodes, and `setInterval` was moving the first child of every row to
the end every 150 ms — thousands of DOM mutations per second, causing layout
reflows on every tick.

**New version:** The LED visualisation is painted onto a second `<canvas>`,
exported as a single PNG via `toDataURL()`, and duplicated. Two `<img>` elements
sit side-by-side; a CSS `translateX(-50%)` animation scrolls them. The browser's
GPU compositor handles the movement — zero JS timers, zero DOM mutation after
first paint.

**Why it matters:** CSS transforms are GPU-composited. They don't trigger layout
or paint. The scrolling could run at 120 fps on a phone without breaking a
sweat. The original approach would cause visible jank on lower-end devices.

### 2. setInterval → CSS animation (no memory leaks)

**Original:** `setInterval` was used for scrolling but never stored or cleared.
If the component mounted twice (or on SPA navigation), intervals would stack
with no way to stop them.

**New version:** Pure CSS `@keyframes` animation. Nothing to clean up — the
browser manages it natively. If the element is removed from the DOM, the
animation stops automatically.

### 3. Bug fix in clearBlankColumns

**Original:** The index math `cleared[j * i + i]` should have been
`cleared[j * width + i]` for proper column-based access. This meant trailing
blank columns weren't always trimmed correctly.

**New version:** Uses `ctx.measureText()` to get the actual rendered text width
up front, so we only sample the pixels we need. No blank-column trimming
pass required — the problem is avoided entirely.

### 4. Missing CSS → self-contained component

**Original:** Referenced CSS classes (`.readyled-pixel`, `.readyled-pixel-on`,
etc.) that weren't defined in the file. The styles had to live somewhere else.

**New version:** Everything is self-contained in one `.astro` file — markup,
scoped styles, and client script. Drop it onto any page with `<LEDScrollbar />`
and it works.

### 5. File location and structure

**Original:** A standalone `.ts` file at the project root with a self-executing
`document.fonts.ready.then(...)` block at the bottom.

**New version:** Lives at `src/components/LEDScrollbar.astro`, follows the
project's Astro component conventions, and accepts props for customisation
(text, colour, speed, pixel size, font, etc.).

### 6. Design: red → green

Red LEDs aren't wrong — the Ghostbusters firehouse "Ready to Believe You" sign
was reddish neon. But for this site's brand, green fits better: ectoplasm, the
PKE meter, Slimer, the no-ghost logo glow. The site already uses
`--color-gb-green` as a key accent. The green LED with a glow effect reads as
"haunted electronics" which is very on-brand.

The colour is configurable via the `ledColor` and `ledGlow` props if you ever
want to switch it.

### 7. Accessibility

Added `role="marquee"` and `aria-label` for screen readers, plus a
`prefers-reduced-motion` media query that stops the animation for users who
have motion sensitivity. The text content is still announced by assistive
technology even when the visual animation is disabled.

---

## Where it lives now

| What      | Where                                     |
| --------- | ----------------------------------------- |
| Component | `src/components/LEDScrollbar.astro`       |
| Used on   | `src/pages/contact.astro` (hero area)     |
| Old file  | `readyled.ts` (deleted from project root) |

---

## Props reference

| Prop          | Default                                          | What it controls                         |
| ------------- | ------------------------------------------------ | ---------------------------------------- |
| `text`        | `WE'RE READY TO BELIEVE YOU! - (804) 482-1217 —` | Sign message                             |
| `pixelHeight` | `9`                                              | Number of LED rows (vertical resolution) |
| `scrollRate`  | `40`                                             | Pixels per second (higher = faster)      |
| `font`        | `Elan Bold`                                      | Font for rasterisation                   |
| `ledColor`    | `#00e676`                                        | Colour of lit pixels                     |
| `ledGlow`     | `rgba(0, 230, 118, 0.6)`                         | Glow around lit pixels                   |
| `pixelSize`   | `3`                                              | Diameter of each LED dot (px)            |
| `pixelGap`    | `1`                                              | Space between dots (px)                  |

---

## Questions / Feedback

Drop any questions, pushback, or "why did it do X?" notes below. I'll feed
this file back into my Copilot agent and it will respond to each one directly —
it has full context on your original code and every change it made. If you want
to challenge a decision or dig deeper into why something was rewritten, go for
it. That's part of the workflow.

<!--
  Leave your comments here, e.g.:

  - Why did it switch from DOM pixels to a canvas export?
  - I don't love the green — can it do red?
  - How would I add this to another page?
-->
