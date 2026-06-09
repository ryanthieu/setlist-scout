import { useEffect, useState } from "react";
import {
  DEFAULT_OPTIONS,
  type ExtensionOptions,
  getOptions,
  setOptions,
} from "../lib/options";

export function OptionsPage() {
  const [options, setOptionsState] =
    useState<ExtensionOptions>(DEFAULT_OPTIONS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getOptions().then((loadedOptions) => {
      setOptionsState(loadedOptions);
      setLoaded(true);
    });
  }, []);

  function update(patch: Partial<ExtensionOptions>) {
    const next = { ...options, ...patch };
    setOptionsState(next);
    void setOptions(next);
  }

  if (!loaded) return null;

  return (
    <main className="options-page">
      <h1>Setlist Scout</h1>
      <label className="options-row">
        <input
          type="checkbox"
          checked={options.autoExpand}
          onChange={(e) => update({ autoExpand: e.target.checked })}
        />
        <span>
          <strong>Auto-expand the panel</strong>
          <br />
          Show the full panel right away instead of starting collapsed as a
          pill.
        </span>
      </label>
      <label className="options-row">
        <input
          type="checkbox"
          checked={options.spoilerFree}
          onChange={(e) => update({ spoilerFree: e.target.checked })}
        />
        <span>
          <strong>Spoiler-free mode</strong>
          <br />
          Hide song names. Only show typical set length and whether there's
          usually an encore.
        </span>
      </label>
    </main>
  );
}
