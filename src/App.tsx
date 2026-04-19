import { useEffect, useState } from 'react';
import CardView from './components/CardView';
import ApkgPicker from './components/ApkgPicker';
import TitleBar from './components/TitleBar';

export default function App() {
  const [apkgPath, setApkgPath] = useState<string | null | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    window.api.self.getState().then((s) => setApkgPath(s?.apkgPath ?? null));
  }, []);

  const choose = async (p: string) => {
    await window.api.self.setApkg(p);
    setApkgPath(p);
    setShowPicker(false);
  };

  if (apkgPath === undefined) return null;

  return (
    <div className="app">
      <TitleBar
        onSettings={() => setShowPicker(true)}
        onNewWindow={() => window.api.window.openNew()}
      />
      {showPicker || !apkgPath ? (
        <ApkgPicker
          currentPath={apkgPath}
          onPick={choose}
          onCancel={apkgPath ? () => setShowPicker(false) : undefined}
        />
      ) : (
        <CardView apkgPath={apkgPath} key={apkgPath} />
      )}
    </div>
  );
}
