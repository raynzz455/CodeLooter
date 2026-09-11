"use client";

// CodeLooter — SplashScreen (minimalism pastel classic restyle).
// Adapted from the original repo's components/SplashScreen.tsx but restyled
// to match the new minimalism pastel classic theme: soft cream background,
// gentle fade-in, Playfair Display typography, no aggressive shake.

import { useState, useEffect, useCallback } from "react";

const SPLASH_COOKIE = "cl_splash";
const SPLASH_TTL_MS = 60 * 60 * 1000; // 1 hour

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
      // Defer to avoid cascading renders within the effect
      requestAnimationFrame(() => setShow(true));
    }
  }, []);

  return show;
}

interface SplashScreenProps {
  onDone: () => void;
}

type Phase = "enter" | "show" | "fade";

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>("enter");

  const done = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("show"), 80),
      setTimeout(() => setPhase("fade"), 1800),
      setTimeout(() => done(), 2300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [done]);

  const isFade = phase === "fade";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#faf9f6",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: isFade ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Logo container */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: 160,
          height: 160,
          borderRadius: "28px",
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          animation: "fadeIn 0.6s ease",
        }}
      >
        <img
          src="/logo.jpg"
          alt="CodeLooter logo"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          marginTop: "22px",
          animation: "fadeIn 0.8s ease 0.2s both",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 6vw, 3rem)",
            letterSpacing: "0.04em",
            lineHeight: 1,
            color: "#3a3a3a",
            margin: 0,
            fontWeight: 600,
          }}
        >
          CodeLooter
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "0.92rem",
            color: "#8a8a8a",
            marginTop: "8px",
            letterSpacing: "0.02em",
          }}
        >
          Ekstrak kode dari file kamu sekarang
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            marginTop: "16px",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#c9a0a0",
                animation: `pulse 1.4s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
