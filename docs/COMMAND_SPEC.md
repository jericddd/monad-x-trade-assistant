# Command Specification

## Supported command

```
buy <amount> mon of <tokenContract>
```

## Accepted examples

- `@monexmonad buy 100 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777`
- `@monexmonad buy 100mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777`
- `@monexmonad BUY 0.5 MON OF 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777`

## Rejected examples

- `buy max mon`
- `buy all mon`
- `buy 100 usd`
- `buy 100 tokens`
- Nad.fun URLs instead of contract addresses
- Multiple commands in one post
- Sell, transfer, approval, or withdraw commands

## Parser output

```typescript
type ParsedBuyCommand = {
  action: "buy";
  amountMon: string;
  tokenAddress: `0x${string}`;
};
```

Amounts remain decimal strings until converted with `parseEther`.
