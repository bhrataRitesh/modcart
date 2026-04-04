import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PerformanceMonitor } from "../components/PerformanceMonitor";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MODCART | Premium Multi-Vendor Marketplace",
  description: "Shop the best products from top-rated vendors worldwide. Modcart provides a seamless, secure, and premium shopping experience.",
  keywords: ["marketplace", "ecommerce", "premium shopping", "multi-vendor", "modcart"],
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PerformanceMonitor />
        {children}
      </body>
    </html>
  );
}
