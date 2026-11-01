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