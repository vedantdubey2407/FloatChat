import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavHeader from "@/components/NavHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FloatChat | Naval Intelligence",
  description: "Real-time Argo Float tracking and crisis management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        // ✅ Added 'bg-slate-950 text-white' for dark theme base
        // ✅ Added 'flex flex-col min-h-screen' so layout fills the window
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white flex flex-col min-h-screen`}
      >
        <NavHeader />
        
        {/* Main wrapper ensures content sits below the fixed header if needed, or fills space */}
        <main className="flex-1 relative">
          {children}
        </main>
      </body>
    </html>
  );
}