import {
  createPublicClient,
  createWalletClient,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AppEnv } from "../env.js";
import { assertChainId, monad } from "./chain.js";
import { createTradeError } from "../trading/errors.js";
import { createMonadTransport, resolveMonadRpcUrls } from "./rpc.js";

export type BlockchainClients = {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  walletAddress: `0x${string}`;
  chainId: number;
};

function monadChain(env: Partial<AppEnv>, rpcUrl: string) {
  return {
    ...monad,
    id: env.MONAD_CHAIN_ID ?? monad.id,
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  };
}

export function createPublicBlockchainClient(env: Partial<AppEnv>): PublicClient {
  const rpcUrls = resolveMonadRpcUrls(env);
  if (rpcUrls.length === 0) {
    throw createTradeError("CONFIGURATION_ERROR", "MONAD_RPC_URL is required");
  }

  return createPublicClient({
    chain: monadChain(env, rpcUrls[0]!),
    transport: createMonadTransport(rpcUrls),
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
  rpcUrls?: string[],
): { walletClient: WalletClient; walletAddress: `0x${string}` } {
  const account = privateKeyToAccount(privateKey as Hex);
  const urls = rpcUrls && rpcUrls.length > 0 ? rpcUrls : [rpcUrl];
  const walletClient = createWalletClient({
    account,
    chain: {
      ...monad,
      id: chainId,
      rpcUrls: {
        default: { http: urls },
      },
    },
    transport: createMonadTransport(urls),
  });

  return {
    walletClient,
    walletAddress: account.address,
  };
}

export async function createBlockchainClients(
  env: Partial<AppEnv>,
  signerPrivateKey?: string,
): Promise<BlockchainClients> {
  const publicClient = createPublicBlockchainClient(env);
  const expectedChainId = env.MONAD_CHAIN_ID ?? monad.id;
  await assertConfiguredChainId(publicClient, expectedChainId);

  const rpcUrls = resolveMonadRpcUrls(env);
  const privateKey = signerPrivateKey ?? env.TRADE_WALLET_PRIVATE_KEY;
  if (privateKey) {
    const { walletClient, walletAddress } = createWalletFromPrivateKey(
      privateKey,
      rpcUrls[0] ?? env.MONAD_RPC_URL!,
      expectedChainId,
      rpcUrls,
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
