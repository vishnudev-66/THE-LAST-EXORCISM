/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional URL of the multiplayer (Socket.IO) server. Single player works without it. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
