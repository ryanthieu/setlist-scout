import type { EventContext } from "@setlist-scout/shared";
import { createRoot } from "react-dom/client";
import { getOptions, onOptionsChanged } from "../lib/options";
import { requestAggregateViaRuntime } from "../lib/request-aggregate";
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

  const root = createRoot(container);
  const render = (options: Awaited<ReturnType<typeof getOptions>>) => {
    root.render(
      <Panel
        artist={context.artist}
        requestAggregate={requestAggregateViaRuntime}
        options={options}
      />,
    );
  };

  render(await getOptions());
  onOptionsChanged(render);
}
