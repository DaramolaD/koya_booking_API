import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { MotionProvider } from "@/components/site/motion";
import { Toaster } from "@/components/ui/sonner";
import { SITE } from "@/lib/site-config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${SITE.name} · Book an appointment`,
  description: "See real availability and book, manage or cancel a clinic appointment in under a minute.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} antialiased`}>
      <body className="min-h-svh">
        <a
          href="#book"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:text-charcoal focus:ring-2 focus:ring-ring"
        >
          Skip to booking
        </a>
        <MotionProvider>{children}</MotionProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
