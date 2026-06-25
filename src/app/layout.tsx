import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/pwa/PWARegister";
import "./globals.css";

// Inter is the Claude design system's sans. Keep the --font-geist-sans variable
// name so the @theme `--font-sans` mapping keeps working unchanged.
const geistSans = Inter({
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
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <PWARegister />
        {children}
        <Toaster position="bottom-right" richColors theme="light" />
      </body>
    </html>
  );
}
