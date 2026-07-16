import type { AppEnv } from "../env.js";
import { createPublicClient, http } from "viem";
import { monad } from "./chain.js";

export function createBlockchainClient(env: Partial<AppEnv>) {
  return createPublicClient({
    chain: monad,
    transport: http(env.MONAD_RPC_URL ?? "https://rpc.monad.xyz"),
  });
}
