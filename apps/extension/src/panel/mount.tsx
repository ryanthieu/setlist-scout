import type { EventContext } from "@setlist-scout/shared";
import { createRoot } from "react-dom/client";
import { DEFAULT_OPTIONS } from "../lib/options";
import { requestAggregateViaRuntime } from "../lib/request-aggregate";
import { requestOptionsViaRuntime } from "../lib/request-options";
import { Panel } from "./Panel";
import { PANEL_STYLES } from "./styles";

const HOST_ID = "setlist-scout-host";

/** Mounts the panel into a fresh shadow root so host-page CSS can't reach it (and vice versa). */
export async function mountPanel(context: EventContext): Promise<void> {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = PANEL_STYLES;
  shadowRoot.appendChild(style);

  const container = document.createElement("div");
  shadowRoot.appendChild(container);

  // chrome.storage isn't reachable directly from this content script
  // context (confirmed live), so options come from the background via
  // messaging instead -- same as the aggregate fetch. That also means
  // there's no live chrome.storage.onChanged subscription here anymore:
  // changing options while a panel is already open takes effect on the
  // next page load, not immediately. Worth revisiting if that turns out
  // to matter in practice.
  const options = await requestOptionsViaRuntime().catch(() => DEFAULT_OPTIONS);

  createRoot(container).render(
    <Panel
      artist={context.artist}
      requestAggregate={requestAggregateViaRuntime}
      options={options}
    />,
  );
}
