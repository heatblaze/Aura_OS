import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Aura OS — AI Operating System",
  description: "A premium AI operating system interface powered by autonomous neural agents.",
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
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
