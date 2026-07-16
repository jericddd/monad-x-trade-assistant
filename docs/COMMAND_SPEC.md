# Command Specification

## Supported command

```
buy <amount> mon <tokenContract>
```

## Accepted examples

- `@monexmonad buy 100 mon 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777`
- `@monexmonad buy 100mon 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777`
- `@monexmonad BUY 0.5 MON 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777`

## Rejected examples

- `@monexmonad buy 100 mon of 0x...` (old format with `of`)
- `buy max mon`
- `buy all mon`
- `buy 100 usd`
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
