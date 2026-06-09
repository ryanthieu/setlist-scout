import { beforeEach, describe, expect, it, vi } from "vitest";

function createFakeChromeStorage() {
  const store = new Map<string, unknown>();
  const changeListeners: Array<
    (changes: Record<string, unknown>, areaName: string) => void
  > = [];

  return {
    local: {
      get: vi.fn(async (key: string) =>
        store.has(key) ? { [key]: store.get(key) } : {},
      ),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) {
          const oldValue = store.get(k);
          store.set(k, v);
          for (const listener of changeListeners) {
            listener({ [k]: { oldValue, newValue: v } }, "local");
          }
        }
      }),
    },
    onChanged: {
      addListener: vi.fn(
        (
          listener: (
            changes: Record<string, unknown>,
            areaName: string,
          ) => void,
        ) => {
          changeListeners.push(listener);
        },
      ),
      removeListener: vi.fn(
        (
          listener: (
            changes: Record<string, unknown>,
            areaName: string,
          ) => void,
        ) => {
          const index = changeListeners.indexOf(listener);
          if (index >= 0) changeListeners.splice(index, 1);
        },
      ),
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

  it("notifies subscribers when options change", async () => {
    const { setOptions, onOptionsChanged } = await import("../src/lib/options");
    const callback = vi.fn();
    const unsubscribe = onOptionsChanged(callback);

    await setOptions({ autoExpand: true, spoilerFree: false });

    expect(callback).toHaveBeenCalledWith({
      autoExpand: true,
      spoilerFree: false,
    });
    unsubscribe();
  });

  it("stops notifying after unsubscribing", async () => {
    const { setOptions, onOptionsChanged } = await import("../src/lib/options");
    const callback = vi.fn();
    const unsubscribe = onOptionsChanged(callback);
    unsubscribe();

    await setOptions({ autoExpand: true, spoilerFree: false });

    expect(callback).not.toHaveBeenCalled();
  });
});
