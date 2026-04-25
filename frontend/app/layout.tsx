import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";
import { OpeningSequence } from "./components/OpeningSequence";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Aura OS — Cinematic AI Interface",
  description: "A premium, cinematic AI operating system interface powered by autonomous neural agents.",
  keywords: ["AI", "Operating System", "Neural Interface", "Aura OS"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable}`}
        style={{ fontFamily: "var(--font-space), var(--font-inter), sans-serif" }}
        suppressHydrationWarning
      >
        <OpeningSequence>
          <div className="app-container">
            <Sidebar />
            <main className="panel-main">
              {children}
            </main>
          </div>
        </OpeningSequence>
      </body>
    </html>
  );
}
