import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpha India | Growth Dashboard",
  description: "Live NSE quarterly growth screener.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
