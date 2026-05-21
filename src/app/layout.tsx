import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import SiteHeader from "./components/rad/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://rateanyday.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "RAD",
  title: {
    default: "Rate Any Day in Human History",
    template: "%s | RAD",
  },
  description: "Explore, rate and discover any day in human history.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rate Any Day in Human History",
    description: "Explore, rate and discover any day in human history.",
    url: "/",
    siteName: "RAD",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rate Any Day in Human History",
    description: "Explore, rate and discover any day in human history.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} ${geistSans.variable} ${geistMono.variable}`}
      >
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
