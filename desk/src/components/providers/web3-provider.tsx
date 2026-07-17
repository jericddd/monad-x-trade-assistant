"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monadMainnet } from "@/lib/monad-chain";

const connectors = [
  injected({ target: "metaMask", shimDisconnect: true }),
  injected({ target: "rabby", shimDisconnect: true }),
  injected({ shimDisconnect: true }),
];

const config = createConfig({
  chains: [monadMainnet],
  connectors,
  transports: {
    [monadMainnet.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
