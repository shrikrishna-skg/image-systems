export interface IepElectronApi {
  readonly isElectron: true;
  openChromiumWindow: (url: string) => Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    iepElectron?: IepElectronApi;
  }
}

export {};
