export type LinkedUserRecord = {
  xUserId: string;
  xUsername: string;
  connectedWallet: `0x${string}`;
  inSiteWallet: `0x${string}`;
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
