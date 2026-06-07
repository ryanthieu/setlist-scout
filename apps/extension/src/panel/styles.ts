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
  color: #1a1a1a;
}

.ss-pill {
  all: initial;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 13px;
  color: #1a1a1a;
  background: #ffffff;
  border: 1px solid #d8d8de;
  border-radius: 999px;
  padding: 8px 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.ss-pill:hover {
  background: #f5f5f7;
}

.ss-panel {
  position: relative;
  width: 300px;
  max-height: 420px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #d8d8de;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
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
  color: #666;
}

.ss-icon-button:hover {
  background: #f0f0f2;
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
  color: #666;
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
  color: #888;
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
  color: #888;
  flex-shrink: 0;
}

.ss-empty {
  color: #888;
  font-size: 12px;
  margin: 0;
}

.ss-stale-banner {
  background: #fff6e5;
  border: 1px solid #f0d68a;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  margin-bottom: 12px;
}

.ss-footer {
  border-top: 1px solid #eee;
  padding-top: 10px;
  font-size: 12px;
  color: #555;
}

.ss-footer-line {
  margin: 0 0 4px 0;
}

.ss-attribution {
  color: #0066cc;
  text-decoration: none;
}

.ss-attribution:hover {
  text-decoration: underline;
}

.ss-message {
  font-size: 13px;
  color: #333;
  margin: 4px 20px 0 0;
}
`;
