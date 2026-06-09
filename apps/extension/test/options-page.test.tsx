// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsPage } from "../src/options/OptionsPage";

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
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.stubGlobal("chrome", { storage: createFakeChromeStorage() });
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
});

async function renderOptionsPage(): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const r = root;
  await act(async () => {
    r.render(<OptionsPage />);
  });
  return container;
}

describe("OptionsPage", () => {
  it("renders both toggles unchecked by default", async () => {
    const el = await renderOptionsPage();
    const checkboxes = Array.from(
      el.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((c) => !c.checked)).toBe(true);
  });

  it("persists a toggle change to chrome.storage.local", async () => {
    const el = await renderOptionsPage();
    const [autoExpandCheckbox] = Array.from(
      el.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];

    await act(async () => {
      autoExpandCheckbox?.click();
    });

    const chromeMock = (
      globalThis as unknown as {
        chrome: { storage: { local: { set: ReturnType<typeof vi.fn> } } };
      }
    ).chrome;
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "options:v1": { autoExpand: true, spoilerFree: false },
    });
  });

  it("loads previously saved options on mount", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            "options:v1": { autoExpand: false, spoilerFree: true },
          }),
          set: vi.fn(),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });

    const el = await renderOptionsPage();
    const checkboxes = Array.from(
      el.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    expect(checkboxes[0]?.checked).toBe(false);
    expect(checkboxes[1]?.checked).toBe(true);
  });
});
