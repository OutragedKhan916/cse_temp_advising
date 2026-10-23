import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Advising Portal" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        {children}
        <div className="credit-fixed">Done by @OutragedKhan916</div>
      </body>
    </html>
  );
}
