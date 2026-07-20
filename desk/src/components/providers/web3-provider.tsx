"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { WagmiProvider } from "wagmi";
import { monadMainnet } from "@/lib/monad-chain";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
  "c4f79cc821925dfed3a9e6e1f9e0f0a0";

const networks = [monadMainnet];

const metadata = {
  name: "MonEx",
  description: "MonEx Trade Assistant",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://trade.monexmonad.xyz",
  icons: ["https://trade.monexmonad.xyz/brand/monex-logo-circle.png"],
};

const wagmiAdapter = new WagmiAdapter({
  networks: networks as [typeof monadMainnet, ...typeof networks],
  projectId,
  ssr: true,
});

createAppKit({
  adapters: [wagmiAdapter],
  // AppKit expects a non-empty network tuple.
  networks: networks as [typeof monadMainnet, ...typeof networks],
  projectId,
  metadata,
  themeMode: "light",
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
