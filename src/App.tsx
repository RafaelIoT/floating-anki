import { useEffect, useState } from 'react';
import CardView from './components/CardView';
import ApkgPicker from './components/ApkgPicker';
import TitleBar from './components/TitleBar';

type Direction = 'normal' | 'inverted';

export default function App() {
  const [apkgPath, setApkgPath] = useState<string | null | undefined>(undefined);
  const [direction, setDirection] = useState<Direction>('normal');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    window.api.self.getState().then((s) => {
      setApkgPath(s?.apkgPath ?? null);
      setDirection(s?.direction ?? 'normal');
    });
  }, []);

  const choose = async (p: string) => {
    await window.api.self.setApkg(p);
    setApkgPath(p);
    setShowPicker(false);
  };

  const toggleDirection = () => {
    const next: Direction = direction === 'normal' ? 'inverted' : 'normal';
    setDirection(next);
    window.api.self.setDirection(next).catch(() => {});
  };

  if (apkgPath === undefined) return null;

  return (
    <div className="app">
      <TitleBar
        onSettings={() => setShowPicker(true)}
        onNewWindow={() => window.api.window.openNew()}
        direction={direction}
        onToggleDirection={toggleDirection}
      />
      {showPicker || !apkgPath ? (
        <ApkgPicker
          currentPath={apkgPath}
          onPick={choose}
          onCancel={apkgPath ? () => setShowPicker(false) : undefined}
        />
      ) : (
        <CardView apkgPath={apkgPath} direction={direction} key={`${apkgPath}:${direction}`} />
      )}
    </div>
  );
}
