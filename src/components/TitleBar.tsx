type Direction = 'normal' | 'inverted';

type Props = {
  onSettings: () => void;
  onNewWindow: () => void;
  direction: Direction;
  onToggleDirection: () => void;
};

export default function TitleBar({ onSettings, onNewWindow, direction, onToggleDirection }: Props) {
  const inverted = direction === 'inverted';
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <button
        className="titlebar-btn titlebar-flip"
        title={inverted ? 'Direction: Back → Front (click to flip)' : 'Direction: Front → Back (click to flip)'}
        onClick={onToggleDirection}
      >
        {inverted ? 'B→F' : 'F→B'}
      </button>
      <button className="titlebar-btn" title="New window" onClick={onNewWindow}>＋</button>
      <button className="titlebar-btn" title="Change deck" onClick={onSettings}>⚙</button>
      <button className="titlebar-btn" title="Close" onClick={() => window.api.window.close()}>✕</button>
    </div>
  );
}
