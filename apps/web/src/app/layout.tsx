import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceForge",
  description: "Development traceability for tasks, Git, and AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
