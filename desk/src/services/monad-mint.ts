import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  toBytes,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadMainnet } from "@/lib/monad-chain";

const NFT_ABI = parseAbi([
  "function mint(address to, uint256 tokenId, string memory tokenURI, bytes32 openingId, bytes32 packId, bytes32 cardId) external",
  "function nextTokenId() external view returns (uint256)",
  "function hasMinted(bytes32 openingId) external view returns (bool)",
]);

export type MintResult = {
  tokenId: string;
  transactionHash: Hash;
  contractAddress: `0x${string}`;
};

function getContractAddress(): `0x${string}` | null {
  const addr = process.env.NFT_CONTRACT_ADDRESS;
  if (!addr) return null;
  return addr as `0x${string}`;
}

function getMintAccount() {
  const key = process.env.MINT_WALLET_PRIVATE_KEY;
  if (!key) return null;
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  return privateKeyToAccount(normalized as `0x${string}`);
}

export async function checkMintWalletBalance(): Promise<{ ok: boolean; balance: bigint }> {
  const account = getMintAccount();
  const contractAddress = getContractAddress();
  if (!account || !contractAddress) return { ok: false, balance: BigInt(0) };

  const client = createPublicClient({
    chain: monadMainnet,
    transport: http(process.env.MONAD_RPC_URL),
  });
  const balance = await client.getBalance({ address: account.address });
  const minBalance = BigInt("1000000000000000"); // 0.001 MON minimum
  return { ok: balance >= minBalance, balance };
}

export function buildTokenUri(openingId: string, cardId: string): string {
  const base = process.env.METADATA_BASE_URL ?? "";
  return `${base}/${openingId}/${cardId}`;
}

export async function mintCardNft(params: {
  recipient: `0x${string}`;
  openingId: string;
  packId: string;
  cardId: string;
  tokenId?: bigint;
}): Promise<MintResult> {
  const contractAddress = getContractAddress();
  const account = getMintAccount();
  if (!contractAddress || !account) {
    throw new Error("MINT_NOT_CONFIGURED");
  }

  const publicClient = createPublicClient({
    chain: monadMainnet,
    transport: http(process.env.MONAD_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: monadMainnet,
    transport: http(process.env.MONAD_RPC_URL),
  });

  const openingBytes = stringToBytes32(params.openingId);
  const alreadyMinted = await publicClient.readContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: "hasMinted",
    args: [openingBytes],
  });
  if (alreadyMinted) throw new Error("ALREADY_MINTED");

  const tokenId =
    params.tokenId ??
    (await publicClient.readContract({
      address: contractAddress,
      abi: NFT_ABI,
      functionName: "nextTokenId",
    }));

  const tokenUri = buildTokenUri(params.openingId, params.cardId);
  const packBytes = stringToBytes32(params.packId);
  const cardBytes = stringToBytes32(params.cardId);

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: "mint",
    args: [params.recipient, tokenId, tokenUri, openingBytes, packBytes, cardBytes],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("MINT_FAILED");

  return {
    tokenId: tokenId.toString(),
    transactionHash: hash,
    contractAddress,
  };
}

function stringToBytes32(value: string): `0x${string}` {
  return keccak256(toBytes(value));
}

export async function isMintConfigured(): Promise<boolean> {
  return Boolean(getContractAddress() && getMintAccount());
}
