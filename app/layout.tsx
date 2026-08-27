import type { Metadata } from "next";
import { Nunito, Bangers } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const bangers = Bangers({
  subsets: ["latin"],
  variable: "--font-bangers",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeLooter — Ekstrak Kode dari Dokumen",
  description:
    "Ambil semua kode dari PDF, DOCX, PPTX, dan format lainnya secara instan. Tanpa AI, tanpa menunggu.",
  keywords: ["code extractor", "pdf to code", "docx parser", "ekstrak kode"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${nunito.variable} ${bangers.variable}`}>
      <head>
        {/* JetBrains Mono untuk code block — next/font tidak support variable ini */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
