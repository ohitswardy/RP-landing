"use client";
// PhotoWheel — scroll-built 3D photo orbit (tilted spinning ring).
// deps: npm i gsap
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface PhotoWheelProps {
  images?: string[];
  label?: string;
  /** rotateZ of the orbit (deg). Negative = top-right → bottom-left diagonal. */
  tiltDeg?: number;
  /** rotateY yaw (deg) — how much you look "into" the ring. */
  yawDeg?: number;
  /** seconds per full revolution once the orbit closes. */
  spinSeconds?: number;
}

const ACCENT = "#5980a6";
const BG = "#ffffff"; // matches the navbar
const TEXT = "#1d1f20";

const DEFAULT_IMAGES = [
  "/AiBG.jpg",
  "/Wheel.jpg",
  "/Wheel1.jpg",
  "/Wheel2.jpg",
  "/Wheel3.jpg",
  "/Wheel4.jpg",
  "/Wheel5.jpg",
  "/Wheel.jpg",
  "/AiBG.jpg",
  "/insight-exit.jpg",
  "/insight-meeting.jpg",
];

export default function PhotoWheel({
  images = DEFAULT_IMAGES,
  label = "",
  tiltDeg = -28,
  yawDeg = -35,
  spinSeconds = 40,
}: PhotoWheelProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const spin = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const ring = ringRef.current;
    if (!section || !ring) return;

    const slots = Array.from(ring.querySelectorAll<HTMLElement>("[data-slot]"));
    const cards = Array.from(ring.querySelectorAll<HTMLElement>("[data-card]"));
    const hint = section.querySelector<HTMLElement>("[data-hint]");
    const n = slots.length;

    // Cards sit on a cylinder: rotateX around the ring, pushed out by radius R.
    const layout = () => {
      const h = slots[0] ? slots[0].offsetHeight : 160;
      const R = Math.round((h * 1.35 * n) / (2 * Math.PI));
      slots.forEach((slot, i) => {
        slot.style.transform = `translate(-50%, -50%) rotateX(${(360 / n) * i}deg) translateZ(${R}px)`;
      });
      // Shrink the whole orbit on small screens so it stays in view.
      const s = Math.min(1, Math.min(window.innerWidth, window.innerHeight) / (2.6 * R));
      gsap.set(ring, { scale: s });
    };
    layout();

    const startSpin = () => {
      if (spin.current) return;
      spin.current = gsap.to(ring, {
        rotationX: "-=360",
        duration: spinSeconds,
        ease: "none",
        repeat: -1,
      });
    };
    const stopSpin = () => {
      if (!spin.current) return;
      spin.current.kill();
      spin.current = null;
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: `+=${n * 45}%`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        // Orbit is "connected" at the end of the scrub → slow infinite spin.
        onUpdate: (self) => (self.progress > 0.985 ? startSpin() : stopSpin()),
      },
    });

    if (hint) tl.to(hint, { autoAlpha: 0, duration: 0.6 }, 0.4);
    // The orbit slowly advances while the cards pop into their slots.
    tl.to(ring, { rotationX: -100, duration: n * 0.8 + 2, ease: "none" }, 0);
    cards.forEach((card, i) => {
      // Fade the faces, never the <figure>: opacity on a preserve-3d element flattens it,
      // which drops the z-sorting and mirrors far-side cards mid-pop.
      const faces = Array.from(card.children).filter((el) => !el.hasAttribute("data-shade"));
      tl.set(card, { visibility: "visible" }, i * 0.8);
      tl.fromTo(card, { scale: 0.2 }, { scale: 1, duration: 0.9, ease: "back.out(1.6)" }, i * 0.8);
      tl.fromTo(faces, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "back.out(1.6)" }, i * 0.8);
    });

    // Depth cue: shade each card by how far it currently faces away from the viewer.
    const shades = Array.from(ring.querySelectorAll<HTMLElement>("[data-shade]"));
    const step = 360 / n;
    const depthTick = () => {
      const rot = Number(gsap.getProperty(ring, "rotationX")) || 0;
      shades.forEach((shade, i) => {
        const facing = Math.cos(((rot + step * i) * Math.PI) / 180); // 1 = front, -1 = back
        shade.style.opacity = String(((1 - facing) / 2) * 0.5);
      });
    };
    depthTick();
    gsap.ticker.add(depthTick);

    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      gsap.ticker.remove(depthTick);
      stopSpin();
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [images, spinSeconds]);

  const cardW = "clamp(140px, 26vmin, 300px)";

  return (
    <div
      ref={sectionRef}
      style={{
        position: "relative",
        height: "100vh",
        overflow: "hidden",
        background: BG,
        color: TEXT,
        fontFamily: "'Barlow', sans-serif",
      }}
    >
      <div style={{ position: "absolute", top: "clamp(16px, 3vmin, 32px)", left: "clamp(16px, 3vmin, 32px)", zIndex: 3 }}>
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(18px, 2.6vmin, 26px)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          {label}
        </div>
      </div>

      <div
        data-hint
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 3,
          fontSize: 13,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: ACCENT,
        }}
      >
        
      </div>

      {/* Perspective stage → tilted axis → 3D ring */}
      <div
        style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", perspective: 1000 }}
        onMouseEnter={() => spin.current?.pause()}
        onMouseLeave={() => spin.current?.play()}
      >
        <div style={{ transformStyle: "preserve-3d", transform: `rotateY(${yawDeg}deg) rotateZ(${tiltDeg}deg)` }}>
          <div ref={ringRef} style={{ position: "relative", width: 0, height: 0, transformStyle: "preserve-3d" }}>
            {images.map((src, i) => (
              <div
                key={i}
                data-slot
                style={{ position: "absolute", left: 0, top: 0, width: cardW, aspectRatio: "16 / 10", transformStyle: "preserve-3d" }}
              >
                <figure
                  data-card
                  style={{
                    margin: 0,
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    transformStyle: "preserve-3d",
                    visibility: "hidden",
                  }}
                >
                  {/* white frame — mirrored on the back so the card reads flat from either side */}
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#fff",
                      border: "1px solid #d8dadd",
                      borderRadius: 6,
                      boxShadow: "0 16px 34px rgba(29, 31, 32, 0.2)",
                      backfaceVisibility: "hidden",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#fff",
                      border: "1px solid #d8dadd",
                      borderRadius: 6,
                      backfaceVisibility: "hidden",
                      transform: "translateZ(-1px) rotateX(180deg)",
                    }}
                  />
                  {/* photo sits flush on the frame and repeats on the back face */}
                  {[1, -2].map((z) => (
                    <img
                      key={z}
                      src={src}
                      alt=""
                      style={{
                        position: "absolute",
                        left: 5,
                        top: 5,
                        width: "calc(100% - 10px)",
                        height: "calc(100% - 10px)",
                        objectFit: "cover",
                        display: "block",
                        borderRadius: 3,
                        backfaceVisibility: "hidden",
                        transform: z > 0 ? "translateZ(1px)" : "translateZ(-2px) rotateX(180deg)",
                      }}
                    />
                  ))}
                  {/* glossy sheen */}
                  <span
                    style={{
                      position: "absolute",
                      inset: 5,
                      background: "linear-gradient(115deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%)",
                      pointerEvents: "none",
                      borderRadius: 3,
                      backfaceVisibility: "hidden",
                      transform: "translateZ(2px)",
                    }}
                  />
                  {/* depth shade — opacity driven per-frame by how far the card faces away */}
                  <span
                    data-shade
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#22303c",
                      opacity: 0,
                      pointerEvents: "none",
                      borderRadius: 6,
                      transform: "translateZ(3px)",
                    }}
                  />
                </figure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
