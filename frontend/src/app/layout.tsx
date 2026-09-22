import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import QueryProvider from "@/components/providers/QueryProvider";
import { SEBIDisclaimer } from "@/components/common/SEBIDisclaimer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Alpha India",
  description:
    "AI Growth Discovery Platform for the Indian Stock Market.",
  applicationName: "Alpha India",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-slate-50 text-slate-900 dark:bg-[#081225] dark:text-white antialiased min-h-screen flex flex-col`}>
        <QueryProvider>
          <ThemeProvider>
            <div className="flex-1">
              {children}
            </div>
            <SEBIDisclaimer />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}