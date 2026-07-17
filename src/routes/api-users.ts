import { formatEther, getAddress, isAddress, parseEther } from "viem";
import type { Env } from "../worker.js";
import { createPublicBlockchainClient, createWalletFromPrivateKey } from "../blockchain/client.js";
import { getNativeBalance } from "../blockchain/balances.js";
import { deriveInSiteWallet, normalizeMasterSeed } from "../custodial/derive-wallet.js";
import type {
  ExportKeyRequest,
  LinkedUserRecord,
  PublicLinkedUser,
  RecordTransferRequest,
  RenewWalletRequest,
  TransferRecord,
  WithdrawRequest,
} from "../custodial/types.js";
import { normalizeLinkedUser } from "../custodial/types.js";
import { parseEnvLenient } from "../env.js";

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export function assertSiteSecret(request: Request, env: Env): boolean {
  const expected = env.SITE_API_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-site-secret");
  return Boolean(provided && provided === expected);
}

function registryStub(env: Env): DurableObjectStub {
  const id = env.USER_REGISTRY.idFromName("primary");
  return env.USER_REGISTRY.get(id);
}

async function fetchLinkedUser(env: Env, xUserId: string): Promise<LinkedUserRecord | null> {
  const stub = registryStub(env);
  const res = await stub.fetch(`https://registry/get?xUserId=${encodeURIComponent(xUserId)}`);
  const body = (await res.json()) as { user: PublicLinkedUser | null };
  if (!body.user) return null;
  return normalizeLinkedUser(body.user);
}

export async function handleUsersApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/")) {
    return null;
  }

  if (!assertSiteSecret(request, env)) {
    return unauthorized();
  }

  if (url.pathname === "/api/v1/users/link" && request.method === "POST") {
    const stub = registryStub(env);
    const upstream = await stub.fetch("https://registry/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  if (url.pathname === "/api/v1/users/export-key" && request.method === "POST") {
    const body = (await request.json()) as ExportKeyRequest;
    const stub = registryStub(env);
    const upstream = await stub.fetch("https://registry/export-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ xUserId: body.xUserId }),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": "application/json",
        // Never cache private key responses.
        "cache-control": "no-store",
      },
    });
  }

  if (url.pathname === "/api/v1/users/renew-wallet" && request.method === "POST") {
    const body = (await request.json()) as RenewWalletRequest;
    const stub = registryStub(env);
    const upstream = await stub.fetch("https://registry/renew-wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        xUserId: body.xUserId,
        confirmRenew: body.confirmRenew === true,
      }),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  const userMatch = url.pathname.match(/^\/api\/v1\/users\/(\d+)$/);
  if (userMatch && request.method === "GET") {
    const xUserId = userMatch[1]!;
    const user = await fetchLinkedUser(env, xUserId);
    if (!user) {
      return Response.json({ user: null });
    }

    let inSiteBalanceMon = "0";
    let connectedBalanceMon: string | null = null;
    try {
      const publicClient = createPublicBlockchainClient(
        parseEnvLenient(env as unknown as Record<string, unknown>),
      );
      const inSiteBal = await getNativeBalance(publicClient, user.inSiteWallet);
      inSiteBalanceMon = formatEther(inSiteBal);
      const connectedBal = await getNativeBalance(publicClient, user.connectedWallet);
      connectedBalanceMon = formatEther(connectedBal);
    } catch {
      // Balances are best-effort for the dashboard.
    }

    return Response.json({
      user: {
        ...user,
        keyExportAvailable: !user.privateKeyExportedAt,
      },
      balances: {
        inSiteMon: inSiteBalanceMon,
        connectedMon: connectedBalanceMon,
      },
    });
  }

  if (url.pathname === "/api/v1/users/withdraw" && request.method === "POST") {
    return handleWithdraw(request, env);
  }

  if (url.pathname === "/api/v1/users/transfers" && request.method === "POST") {
    return handleRecordTransfer(request, env);
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

async function recordTransferViaRegistry(
  env: Env,
  input: RecordTransferRequest,
): Promise<TransferRecord> {
  const stub = registryStub(env);
  const upstream = await stub.fetch("https://registry/record-transfer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await upstream.json()) as { transfer?: TransferRecord; error?: string };
  if (!upstream.ok || !data.transfer) {
    throw new Error(data.error ?? "record_transfer_failed");
  }
  return data.transfer;
}

export async function listTransfersViaRegistry(
  env: Env,
  xUserId: string,
  limit = 50,
): Promise<TransferRecord[]> {
  const stub = registryStub(env);
  const upstream = await stub.fetch(
    `https://registry/list-transfers?xUserId=${encodeURIComponent(xUserId)}&limit=${limit}`,
  );
  const data = (await upstream.json()) as { transfers?: TransferRecord[] };
  return data.transfers ?? [];
}

async function handleRecordTransfer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as RecordTransferRequest;
  // Site may only report deposits; withdraws are recorded server-side after send.
  if (body.type !== "deposit") {
    return badRequest("only_deposit_via_this_endpoint");
  }
  try {
    const transfer = await recordTransferViaRegistry(env, body);
    return Response.json({ transfer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "record_transfer_failed";
    const status = message === "user_not_linked" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

async function handleWithdraw(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as WithdrawRequest;
  if (!body.xUserId || !/^\d+$/.test(body.xUserId)) {
    return badRequest("invalid_x_user_id");
  }
  if (!body.amountMon || !/^\d+(?:\.\d+)?$/.test(body.amountMon)) {
    return badRequest("invalid_amount");
  }

  const user = await fetchLinkedUser(env, body.xUserId);
  if (!user) {
    return badRequest("user_not_linked");
  }

  const toAddress = body.toAddress ?? user.connectedWallet;
  if (!isAddress(toAddress)) {
    return badRequest("invalid_to_address");
  }
  if (getAddress(toAddress) !== getAddress(user.connectedWallet)) {
    return badRequest("withdraw_only_to_connected_wallet");
  }

  const masterRaw = env.CUSTODIAL_MASTER_SEED ?? env.TRADE_WALLET_PRIVATE_KEY;
  if (!masterRaw) {
    return Response.json({ error: "custodial_not_configured" }, { status: 503 });
  }

  const amountWei = parseEther(body.amountMon);
  if (amountWei <= 0n) {
    return badRequest("invalid_amount");
  }

  const derived = deriveInSiteWallet(
    normalizeMasterSeed(masterRaw),
    body.xUserId,
    user.walletVersion ?? 0,
  );
  if (getAddress(derived.address) !== getAddress(user.inSiteWallet)) {
    return Response.json({ error: "wallet_mismatch" }, { status: 500 });
  }

  const parsed = parseEnvLenient(env as unknown as Record<string, unknown>);
  if (!parsed.MONAD_RPC_URL) {
    return Response.json({ error: "rpc_not_configured" }, { status: 503 });
  }

  const publicClient = createPublicBlockchainClient(parsed);
  const balance = await getNativeBalance(publicClient, derived.address);
  const { walletClient, walletAddress } = createWalletFromPrivateKey(
    derived.privateKey,
    parsed.MONAD_RPC_URL,
    parsed.MONAD_CHAIN_ID ?? 143,
  );

  // Leave a small gas cushion in the in-site wallet.
  const gasPrice = (await publicClient.getGasPrice()) ?? 0n;
  const gasLimit = 21_000n;
  const gasCost = gasPrice * gasLimit;
  const totalNeeded = amountWei + gasCost;
  if (balance < totalNeeded) {
    return badRequest("insufficient_in_site_balance");
  }

  try {
    // Pass LocalAccount explicitly. An address string triggers eth_signTransaction
    // on the RPC, which public Monad nodes do not support.
    const account = walletClient.account;
    if (!account || typeof account === "string" || account.type !== "local") {
      return Response.json({ error: "signer_misconfigured" }, { status: 500 });
    }
    const hash = await walletClient.sendTransaction({
      account,
      to: getAddress(toAddress) as `0x${string}`,
      value: amountWei,
      gas: gasLimit,
      gasPrice,
      chain: walletClient.chain,
    });

    try {
      await recordTransferViaRegistry(env, {
        xUserId: body.xUserId,
        type: "withdraw",
        amountMon: body.amountMon,
        txHash: hash,
        fromAddress: walletAddress,
        toAddress: getAddress(toAddress),
      });
    } catch {
      // History is best-effort; withdraw already succeeded on-chain.
    }

    return Response.json({
      ok: true,
      txHash: hash,
      from: walletAddress,
      to: getAddress(toAddress),
      amountMon: body.amountMon,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "withdraw_failed";
    return Response.json({ error: "withdraw_failed", detail: message }, { status: 500 });
  }
}

export async function getRegistryUser(env: Env, xUserId: string): Promise<LinkedUserRecord | null> {
  return fetchLinkedUser(env, xUserId);
}
