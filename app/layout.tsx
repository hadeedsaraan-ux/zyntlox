import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Footer from "./components/Footer";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "ZYNTLOX — Brutally Honest Website Roasts",
  description: "Get brutally honest, actionable feedback for your website in under 60 seconds.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}>
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
