/**
 * HeroSection — Interactive Ghostbusters-themed hero.
 * PRD 009: Motion & Effects (Tier 2 — Hero showcase)
 *
 * Rendered as an Astro island (`client:load`).
 * Full-bleed hero image with text directly on the overlay —
 * no card, just clean typography with text-shadow for readability.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";
import "./HeroSection.css";

interface HeroImage {
  src: string;
  srcset?: string;
  sizes: string;
  width: number;
  height: number;
}

interface Props {
  heroImage: HeroImage;
  heroTitle?: string;
  heroTagline?: string;
  heroPurposeItems?: string[];
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

/* ─── Constants ─── */
const DEFAULT_HEADING = "Who Ya Gonna Call?";

/* ─── Motion variants ─── */
const containerVariants: Variants = {
  initial: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const fadeUp: Variants = {
  initial: { opacity: 1, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

/* ─── Typewriter heading ─── */
function TypewriterHeading({ text }: { text: string }) {
  return (
    <h1 id="home-hero-title" className="hero-title">
      {text.split("").map((char, i) => (
        <span key={i} className="hero-title-char">
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}

/* ─── Main hero section ─── */
export default function HeroSection({
  heroImage,
  heroTitle,
  heroTagline,
  heroPurposeItems,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
}: Props) {
  const prefersReduced = useReducedMotion();
  const [toggleOff, setToggleOff] = useState(false);
  const [enhanceMotion, setEnhanceMotion] = useState(false);
  const [imgZoomed, setImgZoomed] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const check = () => setToggleOff(html.getAttribute("data-reduce-motion") === "true");
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setEnhanceMotion(true);
  }, []);

  /** One-shot: first hover zooms the image in and locks it there */
  const handleHeroHover = () => {
    if (!imgZoomed && !reducedMotion) setImgZoomed(true);
  };

  const reducedMotion = Boolean(prefersReduced) || toggleOff;
  const shouldAnimate = enhanceMotion && !reducedMotion;

  return (
    <div className="hero-container">
      <section className="hero" aria-labelledby="home-hero-title" onMouseEnter={handleHeroHover}>
        {/* Full-bleed background image */}
        <div className="hero-bg">
          <img
            src={heroImage.src}
            srcSet={heroImage.srcset}
            sizes={heroImage.sizes}
            alt=""
            width={heroImage.width}
            height={heroImage.height}
            className={`hero-bg-img${imgZoomed ? " hero-img-zoomed" : ""}`}
            fetchPriority="high"
            decoding="async"
          />
          <div className="hero-bg-overlay" />
        </div>

        {/* Text directly on the image — no card */}
        <div className="hero-content">
          <motion.div
            className="hero-text"
            initial={shouldAnimate ? "initial" : "visible"}
            animate={shouldAnimate ? "visible" : undefined}
            variants={shouldAnimate ? containerVariants : undefined}
          >
            <TypewriterHeading text={heroTitle || DEFAULT_HEADING} />

            <motion.p
              className="hero-tagline"
              initial={shouldAnimate ? "initial" : "visible"}
              variants={shouldAnimate ? fadeUp : undefined}
            >
              {heroTagline ||
                "Virginia\u2019s official Ghostbusters nonprofit\u2009\u2014\u2009real fans making a real difference through charity, community events, and a whole lot of heart."}
            </motion.p>

            <motion.ul
              className="hero-purpose"
              initial={shouldAnimate ? "initial" : "visible"}
              variants={shouldAnimate ? fadeUp : undefined}
              aria-label="Key facts"
            >
              {(heroPurposeItems && heroPurposeItems.length > 0
                ? heroPurposeItems
                : ["Registered 501c3 Nonprofit", "Hospital Visits", "Community Events"]
              ).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </motion.ul>

            <motion.div
              className="hero-cta"
              initial={shouldAnimate ? "initial" : "visible"}
              variants={shouldAnimate ? fadeUp : undefined}
            >
              <a href={secondaryCtaHref || "/events"} className="btn btn--lg btn--ghost">
                {secondaryCtaLabel || "See Our Events"}
              </a>
              <a href={primaryCtaHref || "/join"} className="btn btn--lg btn--primary">
                {primaryCtaLabel || "Join the Team"}
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
