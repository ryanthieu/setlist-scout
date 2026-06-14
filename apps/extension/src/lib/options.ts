export type ExtensionOptions = {
  autoExpand: boolean;
  spoilerFree: boolean;
};

export const DEFAULT_OPTIONS: ExtensionOptions = {
  autoExpand: false,
  spoilerFree: false,
};

const STORAGE_KEY = "options:v1";

export async function getOptions(): Promise<ExtensionOptions> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as
    | Partial<ExtensionOptions>
    | undefined;
  return { ...DEFAULT_OPTIONS, ...stored };
}

export async function setOptions(options: ExtensionOptions): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: options });
}
