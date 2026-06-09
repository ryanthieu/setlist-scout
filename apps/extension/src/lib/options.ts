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

/** Notifies `callback` whenever options change in another context (e.g. the options page while a panel is open). Returns an unsubscribe function. */
export function onOptionsChanged(
  callback: (options: ExtensionOptions) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "local" || !(STORAGE_KEY in changes)) return;
    const newValue = changes[STORAGE_KEY]?.newValue as
      | Partial<ExtensionOptions>
      | undefined;
    callback({ ...DEFAULT_OPTIONS, ...newValue });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
