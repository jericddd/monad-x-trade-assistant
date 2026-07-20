import { describe, expect, it } from "vitest";
import { venueFromRouter, VENUE_LABELS } from "../src/blockchain/venues/detect.js";
import { FLAP_MAINNET } from "../src/blockchain/flap/config.js";
import { NADFUN_MAINNET } from "../src/blockchain/nadfun/config.js";
import { UNISWAP_MAINNET } from "../src/blockchain/uniswap/config.js";

describe("venueFromRouter", () => {
  it("maps Nad.fun routers", () => {
    expect(venueFromRouter(NADFUN_MAINNET.BONDING_CURVE_ROUTER)).toBe("nadfun");
    expect(venueFromRouter(NADFUN_MAINNET.DEX_ROUTER)).toBe("nadfun");
    expect(venueFromRouter(NADFUN_MAINNET.V2_ROUTER)).toBe("nadfun");
  });

  it("maps Flap Portal", () => {
    expect(venueFromRouter(FLAP_MAINNET.PORTAL)).toBe("flap");
  });

  it("maps Uniswap routers", () => {
    expect(venueFromRouter(UNISWAP_MAINNET.V2_ROUTER02)).toBe("uniswap");
    expect(venueFromRouter(UNISWAP_MAINNET.SWAP_ROUTER_02)).toBe("uniswap");
  });

  it("returns null for unknown routers", () => {
    expect(venueFromRouter("0x1111111111111111111111111111111111111111")).toBeNull();
    expect(venueFromRouter(null)).toBeNull();
  });

  it("has human labels for hover", () => {
    expect(VENUE_LABELS.nadfun).toBe("Nad.fun");
    expect(VENUE_LABELS.flap).toBe("Flap.sh");
    expect(VENUE_LABELS.uniswap).toBe("Uniswap");
  });
});
