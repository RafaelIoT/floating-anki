type Props = {
  currentPath: string | null;
  onPick: (path: string) => void;
  onCancel?: () => void;
  error?: string | null;
};

export default function ApkgPicker({ currentPath, onPick, onCancel, error }: Props) {
  const pick = async () => {
    const p = await window.api.apkg.pick();
    if (p) onPick(p);
  };

  return (
    <div className="panel">
      <p className="muted">
        Load an Anki deck file (<code>.apkg</code>). Export one from ankiweb.net
        with <b>Support older Anki versions</b> enabled.
      </p>
      {currentPath && <p className="muted">Current: {currentPath}</p>}
      {error && <p className="error">{error}</p>}
      <button onClick={pick}>Choose .apkg file…</button>
      {onCancel && <button onClick={onCancel}>Cancel</button>}
    </div>
  );
}
