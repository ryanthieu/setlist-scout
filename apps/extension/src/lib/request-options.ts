import type { GetOptionsMessage } from "./messages";
import type { ExtensionOptions } from "./options";

export function requestOptionsViaRuntime(): Promise<ExtensionOptions> {
  const message: GetOptionsMessage = { type: "GET_OPTIONS" };
  return chrome.runtime.sendMessage(message);
}
