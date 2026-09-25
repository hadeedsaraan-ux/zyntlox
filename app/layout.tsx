import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import Footer from "./components/Footer";
import SiteHeader from "./components/SiteHeader";
import { RawDataProvider } from "./components/RawDataProvider";
import { ReportProvider } from "./components/ReportProvider";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
});

export const metadata: Metadata = {
  title: "Magpie — Sharp-eyed website reviews",
  description:
    "Magpie spots what's costing your website trust, leads and sales — and tells you exactly how to fix it, in under 60 seconds.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <RawDataProvider>
          <ReportProvider>
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <Footer />
          </ReportProvider>
        </RawDataProvider>
        <Analytics />
      </body>
    </html>
  );
}
