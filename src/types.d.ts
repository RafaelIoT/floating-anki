/// <reference types="vite/client" />
export {};

type Bounds = { x?: number; y?: number; width: number; height: number };
type WindowState = { id: string; apkgPath: string | null; bounds: Bounds };

declare global {
  interface Window {
    api: {
      self: {
        id: string;
        getState: () => Promise<WindowState | null>;
        setApkg: (apkgPath: string | null) => Promise<void>;
      };
      apkg: {
        pick: () => Promise<string | null>;
        read: (path: string) => Promise<ArrayBuffer>;
      };
      reviews: {
        get: (apkgPath: string) => Promise<Record<string, unknown>>;
        save: (apkgPath: string, reviews: object) => Promise<void>;
      };
      window: {
        close: () => Promise<void>;
        openNew: () => Promise<void>;
      };
    };
  }
}

declare module '*?url' {
  const url: string;
  export default url;
}
