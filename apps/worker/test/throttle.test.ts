import { describe, expect, it } from "vitest";
import { isRateLimited } from "../src/throttle";
import { createFakeKv } from "./fake-kv";

describe("isRateLimited", () => {
  it("allows requests under the limit", async () => {
    const kv = createFakeKv();
    const now = Date.now();
    for (let i = 0; i < 29; i++) {
      expect(await isRateLimited(kv, "1.2.3.4", now)).toBe(false);
    }
  });

  it("blocks once the per-window limit is hit", async () => {
    const kv = createFakeKv();
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      await isRateLimited(kv, "1.2.3.4", now);
    }
    expect(await isRateLimited(kv, "1.2.3.4", now)).toBe(true);
  });

  it("tracks each IP independently", async () => {
    const kv = createFakeKv();
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      await isRateLimited(kv, "1.2.3.4", now);
    }
    expect(await isRateLimited(kv, "5.6.7.8", now)).toBe(false);
  });

  it("resets once a new time window starts", async () => {
    const kv = createFakeKv();
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      await isRateLimited(kv, "1.2.3.4", now);
    }
    expect(await isRateLimited(kv, "1.2.3.4", now + 61_000)).toBe(false);
  });
});
