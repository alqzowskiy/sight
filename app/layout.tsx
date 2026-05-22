import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { PageBackdrop } from "@/components/landing/PageBackdrop";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sight — See your money's future",
  description:
    "Predictive liquidity management for fintech treasury teams. Sight forecasts cash flow 3 to 7 days ahead and tells you exactly what to do.",
  openGraph: {
    title: "Sight",
    description: "See your money's future.",
    url: "https://trysight.com",
    siteName: "Sight",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <ClerkProvider>
          <PageBackdrop />
          <ScrollProgress />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}