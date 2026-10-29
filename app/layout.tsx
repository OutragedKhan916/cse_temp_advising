import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Advising Portal" };
const CF = process.env.NEXT_PUBLIC_CF_TOKEN; // Cloudflare Web Analytics token, set at build time
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        {CF && <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: CF })} />}
      </body>
    </html>
  );
}