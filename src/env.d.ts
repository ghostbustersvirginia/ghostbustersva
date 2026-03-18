/// <reference types="astro/client" />

declare module "readyled/dist/readyled.js" {
  export type ReadyLEDParams = {
    fallbackFont?: string;
    font?: string;
    fontCheckInterval?: number;
    maxWait?: number;
    pixelHeight: number;
    scrollSpeed?: number;
    signWidth?: number;
    target: HTMLElement;
    text: string;
  };

  export function readyLED(params: ReadyLEDParams): Promise<void>;
}

