import { beforeEach, describe, expect, it, vi } from "vitest";

function createFakeChromeStorage() {
  const store = new Map<string, unknown>();

  return {
    local: {
      get: vi.fn(async (key: string) =>
        store.has(key) ? { [key]: store.get(key) } : {},
      ),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      }),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("chrome", { storage: createFakeChromeStorage() });
  vi.resetModules();
});

describe("options", () => {
  it("returns the defaults when nothing has been saved yet", async () => {
    const { getOptions, DEFAULT_OPTIONS } = await import("../src/lib/options");
    expect(await getOptions()).toEqual(DEFAULT_OPTIONS);
  });

  it("round-trips saved options", async () => {
    const { getOptions, setOptions } = await import("../src/lib/options");
    await setOptions({ autoExpand: true, spoilerFree: true });
    expect(await getOptions()).toEqual({ autoExpand: true, spoilerFree: true });
  });
});
