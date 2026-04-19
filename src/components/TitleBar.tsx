type Props = {
  onSettings: () => void;
  onNewWindow: () => void;
};

export default function TitleBar({ onSettings, onNewWindow }: Props) {
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <button className="titlebar-btn" title="New window" onClick={onNewWindow}>＋</button>
      <button className="titlebar-btn" title="Change deck" onClick={onSettings}>⚙</button>
      <button className="titlebar-btn" title="Close" onClick={() => window.api.window.close()}>✕</button>
    </div>
  );
}
