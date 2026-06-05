import type { EventContext } from "@setlist-scout/shared";

export interface SiteAdapter {
  matches(url: URL): boolean;
  detect(): Promise<EventContext | null>;
}
