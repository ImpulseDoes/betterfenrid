declare module '*.css' {
  const css: string;
  export default css;
}

declare module '*.jpg' {
  const dataUrl: string;
  export default dataUrl;
}

interface Window {
  BetterFenrid?: unknown;
}

declare module '*.gif' {
  const dataUrl: string;
  export default dataUrl;
}

interface BetterFenridNative {
  version: string;
  platform: string;
  media: {
    subscribe(listener: (message: any) => void): () => void;
    command(line: string): void;
  };
  openExternal(url: string): void;
  setAppIcon?(dataUrl: string | null): void;
  updates?: {
    check(): Promise<{ status: 'latest' | 'ready' | 'local' | 'error'; version?: string; error?: string }>;
    onReady(listener: (update: { version: string }) => void): () => void;
  };
  onBack?(listener: () => boolean): () => void;
}

interface Window {
  BetterFenridNative?: BetterFenridNative;
}