import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Advising Portal" };
const CF = process.env.NEXT_PUBLIC_CF_TOKEN; // Cloudflare Web Analytics token (optional)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        {CF ? <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: CF })} /> : null}
      </body>
    </html>
  );
}
