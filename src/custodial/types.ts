export type LinkedUserRecord = {
  xUserId: string;
  xUsername: string;
  connectedWallet: `0x${string}`;
  inSiteWallet: `0x${string}`;
  /** Bumps on renew; version 0 is the original derivation path. */
  walletVersion: number;
  /** ISO timestamp after the one-time private key reveal for the current wallet version. */
  privateKeyExportedAt: string | null;
  linkedAt: string;
  updatedAt: string;
};

export type LinkUserRequest = {
  xUserId: string;
  xUsername: string;
  connectedWallet: string;
};

export type WithdrawRequest = {
  xUserId: string;
  amountMon: string;
  /** Defaults to the user's connected wallet. */
  toAddress?: string;
};

export type ExportKeyRequest = {
  xUserId: string;
};

export type RenewWalletRequest = {
  xUserId: string;
  /** Client must send true after showing the move-funds warning. */
  confirmRenew: boolean;
};

export type TransferType = "deposit" | "withdraw";

/** Add-funds / cash-out history for the activity feed. */
export type TransferRecord = {
  id: string;
  xUserId: string;
  type: TransferType;
  amountMon: string;
  txHash: `0x${string}`;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  hotWallet: `0x${string}`;
  inSiteWallet: `0x${string}`;
  status: "CONFIRMED";
  createdAt: string;
};

export type RecordTransferRequest = {
  xUserId: string;
  type: TransferType;
  amountMon: string;
  txHash: string;
  fromAddress?: string;
  toAddress?: string;
};

/** Safe fields for site dashboards — never includes private key material. */
export type PublicLinkedUser = Omit<LinkedUserRecord, "privateKeyExportedAt"> & {
  keyExportAvailable: boolean;
  privateKeyExportedAt: string | null;
};

export function toPublicLinkedUser(user: LinkedUserRecord): PublicLinkedUser {
  return {
    ...user,
    walletVersion: user.walletVersion ?? 0,
    privateKeyExportedAt: user.privateKeyExportedAt ?? null,
    keyExportAvailable: !user.privateKeyExportedAt,
  };
}

export function normalizeLinkedUser(user: LinkedUserRecord): LinkedUserRecord {
  return {
    ...user,
    walletVersion: user.walletVersion ?? 0,
    privateKeyExportedAt: user.privateKeyExportedAt ?? null,
  };
}
