import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HERMES Mission Control",
  description: "Multi-agent orchestration dashboard for Samuel's business missions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
