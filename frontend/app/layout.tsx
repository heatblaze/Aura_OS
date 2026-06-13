import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";
import { PageTransition } from "./components/PageTransition";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Aura OS — The Proactive Neural Operating System",
  description: "A premium glassmorphic AI operating system interface powered by an autonomous multi-agent brain graph. Explore the future of digital agency.",
  generator: "Next.js",
  applicationName: "Aura OS",
  referrer: "origin-when-cross-origin",
  keywords: ["Aura OS", "AI Operating System", "AI Coworkers", "Autonomous Agents", "Glassmorphic UI", "Multi-Agent Systems"],
  authors: [{ name: "Aura OS Team" }],
  creator: "Aura OS Team",
  publisher: "Aura OS Team",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Aura OS — The Proactive Neural Operating System",
    description: "A premium glassmorphic AI operating system interface powered by an autonomous multi-agent brain graph. Explore the future of digital agency.",
    url: "https://aura-os.vercel.app",
    siteName: "Aura OS",
    images: [
      {
        url: "/aura_logo.png",
        width: 800,
        height: 600,
        alt: "Aura OS Logo Graphic",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aura OS — The Proactive Neural Operating System",
    description: "A premium glassmorphic AI operating system interface powered by an autonomous multi-agent brain graph.",
    images: ["/aura_logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.variable} style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }} suppressHydrationWarning>
        <div className="app-container">
          <Sidebar />
          <main className="panel-main">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </div>
      </body>
    </html>
  );
}
