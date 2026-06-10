export const PANEL_STYLES = `
:host {
  all: initial;
}

.ss-root {
  all: initial;
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;

  --ss-bg: #ffffff;
  --ss-text: #1a1a1a;
  --ss-text-muted: #666;
  --ss-text-faint: #888;
  --ss-border: #d8d8de;
  --ss-hover-bg: #f5f5f7;
  --ss-shadow: rgba(0, 0, 0, 0.15);
  --ss-shadow-strong: rgba(0, 0, 0, 0.2);
  --ss-divider: #eee;
  --ss-skeleton-base: #eaeaee;
  --ss-skeleton-highlight: #f5f5f7;
  --ss-stale-bg: #fff6e5;
  --ss-stale-border: #f0d68a;
  --ss-link: #0066cc;
  --ss-bustout-bg: #fff1ee;
  --ss-bustout-border: #f4b8a8;
  --ss-bustout-accent: #c2410c;

  color: var(--ss-text);
}

@media (prefers-color-scheme: dark) {
  .ss-root {
    --ss-bg: #26262b;
    --ss-text: #f0f0f0;
    --ss-text-muted: #b0b0b8;
    --ss-text-faint: #909098;
    --ss-border: #3c3c42;
    --ss-hover-bg: #323238;
    --ss-shadow: rgba(0, 0, 0, 0.4);
    --ss-shadow-strong: rgba(0, 0, 0, 0.5);
    --ss-divider: #3c3c42;
    --ss-skeleton-base: #35353b;
    --ss-skeleton-highlight: #414148;
    --ss-stale-bg: #3a2f10;
    --ss-stale-border: #6b5a1f;
    --ss-bustout-bg: #3a2418;
    --ss-bustout-border: #7a3f28;
    --ss-bustout-accent: #ff9166;
    --ss-link: #6cb2ff;
  }
}

.ss-pill {
  all: initial;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ss-text);
  background: var(--ss-bg);
  border: 1px solid var(--ss-border);
  border-radius: 999px;
  padding: 8px 14px;
  box-shadow: 0 2px 10px var(--ss-shadow);
  cursor: pointer;
}

.ss-pill:hover {
  background: var(--ss-hover-bg);
}

.ss-panel {
  position: relative;
  width: 300px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--ss-bg);
  border: 1px solid var(--ss-border);
  border-radius: 12px;
  box-shadow: 0 4px 20px var(--ss-shadow-strong);
  padding: 16px;
}

.ss-panel-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.ss-icon-button {
  all: initial;
  font-family: inherit;
  cursor: pointer;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--ss-text-muted);
}

.ss-icon-button:hover {
  background: var(--ss-hover-bg);
}

.ss-header {
  margin: 0 24px 12px 0;
}

.ss-artist-name {
  font-weight: 700;
  font-size: 15px;
  margin: 0 0 2px 0;
}

.ss-subline {
  color: var(--ss-text-muted);
  font-size: 12px;
  margin: 0;
}

.ss-section {
  margin-bottom: 12px;
}

.ss-section-title {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ss-text-faint);
  margin: 0 0 6px 0;
}

.ss-song-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ss-song-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
}

.ss-song-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-song-rate {
  color: var(--ss-text-faint);
  flex-shrink: 0;
}

.ss-empty {
  color: var(--ss-text-faint);
  font-size: 12px;
  margin: 0;
}

.ss-bustouts {
  background: var(--ss-bustout-bg);
  border: 1px solid var(--ss-bustout-border);
  border-radius: 8px;
  padding: 8px 10px;
}

.ss-bustouts-title {
  color: var(--ss-bustout-accent);
}

.ss-bustout-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  font-weight: 600;
}

.ss-bustout-gap {
  color: var(--ss-bustout-accent);
  flex-shrink: 0;
  font-weight: 500;
  font-size: 12px;
}

.ss-stale-banner {
  background: var(--ss-stale-bg);
  border: 1px solid var(--ss-stale-border);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  margin-bottom: 12px;
  color: var(--ss-text);
}

.ss-footer {
  border-top: 1px solid var(--ss-divider);
  padding-top: 10px;
  font-size: 12px;
  color: var(--ss-text-muted);
}

.ss-footer-line {
  margin: 0 0 4px 0;
}

.ss-attribution {
  color: var(--ss-link);
  text-decoration: none;
}

.ss-attribution:hover {
  text-decoration: underline;
}

.ss-message {
  font-size: 13px;
  color: var(--ss-text);
  margin: 4px 20px 0 0;
}

.ss-skeleton-line {
  height: 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  background: linear-gradient(90deg, var(--ss-skeleton-base) 25%, var(--ss-skeleton-highlight) 37%, var(--ss-skeleton-base) 63%);
  background-size: 400% 100%;
  animation: ss-shimmer 1.4s ease infinite;
}

.ss-skeleton-title {
  width: 55%;
  height: 15px;
}

.ss-skeleton-subline {
  width: 75%;
  height: 10px;
}

.ss-skeleton-short {
  width: 40%;
}

@keyframes ss-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ss-skeleton-line {
    animation: none;
  }
}
`;
