import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AppEnv } from "../env.js";
import { assertChainId, monad } from "./chain.js";
import { createTradeError } from "../trading/errors.js";

export type BlockchainClients = {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  walletAddress: `0x${string}`;
  chainId: number;
};

export function createPublicBlockchainClient(env: Partial<AppEnv>): PublicClient {
  if (!env.MONAD_RPC_URL) {
    throw createTradeError("CONFIGURATION_ERROR", "MONAD_RPC_URL is required");
  }

  return createPublicClient({
    chain: {
      ...monad,
      id: env.MONAD_CHAIN_ID ?? monad.id,
      rpcUrls: {
        default: { http: [env.MONAD_RPC_URL] },
      },
    },
    transport: http(env.MONAD_RPC_URL),
  });
}

export async function assertConfiguredChainId(
  publicClient: PublicClient,
  expectedChainId: number,
): Promise<void> {
  const actual = await publicClient.getChainId();
  try {
    assertChainId(actual, expectedChainId);
  } catch {
    throw createTradeError("CHAIN_ID_MISMATCH");
  }
}

export function createWalletFromPrivateKey(
  privateKey: string,
  rpcUrl: string,
  chainId: number,
): { walletClient: WalletClient; walletAddress: `0x${string}` } {
  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: {
      ...monad,
      id: chainId,
      rpcUrls: {
        default: { http: [rpcUrl] },
      },
    },
    transport: http(rpcUrl),
  });

  return {
    walletClient,
    walletAddress: account.address,
  };
}

export async function createBlockchainClients(env: Partial<AppEnv>): Promise<BlockchainClients> {
  const publicClient = createPublicBlockchainClient(env);
  const expectedChainId = env.MONAD_CHAIN_ID ?? monad.id;
  await assertConfiguredChainId(publicClient, expectedChainId);

  if (env.TRADE_WALLET_PRIVATE_KEY) {
    const { walletClient, walletAddress } = createWalletFromPrivateKey(
      env.TRADE_WALLET_PRIVATE_KEY,
      env.MONAD_RPC_URL!,
      expectedChainId,
    );
    return {
      publicClient,
      walletClient,
      walletAddress,
      chainId: expectedChainId,
    };
  }

  return {
    publicClient,
    walletAddress: "0x0000000000000000000000000000000000000001",
    chainId: expectedChainId,
  };
}
