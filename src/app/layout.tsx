import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/pwa/PWARegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cadence — Consistency & Discipline Tracker",
  description: "Measure your discipline. Build your identity.",
  applicationName: "Cadence",
  appleWebApp: {
    capable: true,
    title: "Cadence",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="min-h-full flex flex-col">
        <PWARegister />
        {children}
        <Toaster position="bottom-right" richColors theme="dark" />
      </body>
    </html>
  );
}
