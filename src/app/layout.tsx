import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LockBox: lock away your passcodes", template: "%s · LockBox" },
  description:
    "Store your Screen Time passcode and other secrets behind a time lock. Open source, encrypted, and hard to get around.",
};

export const viewport: Viewport = { themeColor: "#07080f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
