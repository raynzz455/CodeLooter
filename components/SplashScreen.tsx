"use client";

import { useState, useEffect, useCallback } from "react";

const SPLASH_COOKIE = "cl_splash";
const SPLASH_TTL_MS = 60 * 60 * 1000; // 1 jam

function getSplashCookie(): number {
  if (typeof document === "undefined") return 0;
  const m = document.cookie.match(/cl_splash=(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function setSplashCookie() {
  const expires = new Date(Date.now() + SPLASH_TTL_MS).toUTCString();
  document.cookie = `${SPLASH_COOKIE}=${Date.now()}; expires=${expires}; path=/; SameSite=Lax`;
}

export function useShouldShowSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const last = getSplashCookie();
    const expired = Date.now() - last > SPLASH_TTL_MS;
    if (expired) {
      setSplashCookie();
      setShow(true);
    }
  }, []);

  return show;
}

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  type Phase = "black" | "flash" | "slam" | "shake" | "settle" | "exit";
  const [phase, setPhase] = useState<Phase>("black");

  const done = useCallback(onDone, [onDone]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("flash"),  350),
      setTimeout(() => setPhase("slam"),   420),
      setTimeout(() => setPhase("shake"),  520),
      setTimeout(() => setPhase("settle"), 900),
      setTimeout(() => setPhase("exit"),  2600),
      setTimeout(() => done(),            3100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [done]);

  const isVisible = phase !== "black";
  const isFlash   = phase === "flash";
  const isSlam    = phase === "slam" || phase === "shake";
  const isSettle  = phase === "settle";
  const isExit    = phase === "exit";
  const isShaking = phase === "shake";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: isFlash ? "#ffffff" : phase === "black" ? "#000" : isSlam ? "#ff4444" : "#ffe8a3",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      opacity: isExit ? 0 : 1,
      transition: isExit ? "opacity 0.5s ease" : isFlash ? "background-color 0.04s" : "background-color 0.25s ease",
      animation: isShaking ? "screenShake 0.38s ease" : "none",
    }}>
      {/* speed lines */}
      {isVisible && !isExit && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: isSlam || isShaking ? 1 : isSettle ? 0.25 : 0, transition: "opacity 0.4s ease" }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * 360;
            const len = isSlam || isShaking ? "55%" : "40%";
            return (
              <div key={i} style={{
                position: "absolute", top: "50%", left: "50%",
                width: isSlam ? "3px" : "2px", height: len,
                backgroundColor: i % 3 === 0 ? "#000" : i % 3 === 1 ? "#ff6b6b" : "#ffe8a3",
                transformOrigin: "top center",
                transform: `rotate(${angle}deg) translateX(-50%)`,
                opacity: i % 4 === 0 ? 1 : 0.5,
              }} />
            );
          })}
        </div>
      )}

      {/* starburst */}
      {isVisible && (
        <div style={{
          position: "absolute",
          width: isSlam || isShaking ? 380 : isSettle ? 280 : 0,
          height: isSlam || isShaking ? 380 : isSettle ? 280 : 0,
          opacity: isExit ? 0 : isFlash ? 0 : 1,
          transition: "width 0.18s cubic-bezier(0.34,2,0.64,1), height 0.18s cubic-bezier(0.34,2,0.64,1), opacity 0.3s ease",
          pointerEvents: "none",
        }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", animation: isSettle || isExit ? "spinSlow 6s linear infinite" : "none" }}>
            <polygon points="50,2 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="#000" />
            <polygon points="50,8 59,37 91,37 66,56 76,88 50,68 24,88 34,56 9,37 41,37" fill="#ffe8a3" />
          </svg>
        </div>
      )}

      {/* comic text */}
      {(isSlam || isShaking || isSettle) && !isExit && (
        <>
          {[
            { text: "KAGET!!", top: "8%", left: "5%", rot: "-15deg", color: "#fff", size: "clamp(2rem,7vw,3.5rem)" },
            { text: "WOW!",    top: "10%", right: "4%", rot: "12deg", color: "#ffe8a3", size: "clamp(1.5rem,5vw,2.8rem)" },
            { text: "!!",      bottom: "12%", left: "6%", rot: "8deg", color: "#d4f0e4", size: "clamp(2rem,6vw,3rem)" },
            { text: "BOOM!",   bottom: "14%", right: "5%", rot: "-10deg", color: "#fff", size: "clamp(1.8rem,5vw,2.5rem)" },
          ].map(({ text, size, color, rot, ...pos }) => (
            <div key={text} style={{
              position: "absolute", ...pos,
              fontFamily: "var(--font-display)", fontSize: size, color,
              textShadow: "3px 3px 0 #000, -2px -2px 0 #000, 3px -2px 0 #000, -2px 3px 0 #000",
              letterSpacing: "0.06em", lineHeight: 1,
              transform: `rotate(${rot})`,
              transition: "opacity 0.3s ease",
            }}>{text}</div>
          ))}
        </>
      )}

      {/* logo */}
      {isVisible && (
        <div style={{
          position: "relative", zIndex: 2,
          width:  isFlash ? 10 : isSlam || isShaking ? 260 : isSettle ? 200 : 10,
          height: isFlash ? 10 : isSlam || isShaking ? 260 : isSettle ? 200 : 10,
          border: isSlam || isShaking ? "6px solid #000" : "4px solid #000",
          borderRadius: "28px",
          boxShadow: isSlam || isShaking ? "12px 12px 0 #000, -4px -4px 0 #ff6b6b" : isSettle ? "8px 8px 0 #000" : "none",
          overflow: "hidden",
          transform: isFlash ? "scale(0.05) rotate(0deg)" : isSlam ? "scale(1) rotate(-6deg)" : isShaking ? "scale(1.04) rotate(3deg)" : isSettle ? "scale(1) rotate(-2deg)" : "scale(0.9) rotate(-2deg)",
          transition: isFlash ? "width 0.05s, height 0.05s, transform 0.05s" : isSlam ? "all 0.12s cubic-bezier(0.34,2.8,0.64,1)" : "all 0.3s cubic-bezier(0.34,1.4,0.64,1)",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CodeLooter logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* title */}
      {isSettle && !isExit && (
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", marginTop: "18px", animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.5rem,8vw,4rem)", letterSpacing: "0.08em", lineHeight: 1, textShadow: "5px 5px 0 #ff6b6b, 8px 8px 0 rgba(0,0,0,0.15)", margin: 0 }}>
            CodeLooter!
          </p>
          <p style={{ fontWeight: 800, fontSize: "0.9rem", color: "#444", marginTop: "6px", letterSpacing: "0.04em" }}>
            Ekstrak kode dari file kamu sekarang 💥
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
            {[0,1,2].map((i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#000", animation: `bounce 0.5s ease-in-out ${i*0.15}s infinite alternate` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
