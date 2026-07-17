import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Web3Provider } from "@/components/providers/web3-provider";
import "./globals.css";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MonEx Trade Assistant",
  description: "Log in with X, fund your trading wallet, buy Nad.fun tokens from mentions.",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/monex-logo-circle.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <Web3Provider>
            <main className="mx-auto min-h-screen max-w-7xl px-4 py-10 md:py-16">{children}</main>
          </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  );
}
