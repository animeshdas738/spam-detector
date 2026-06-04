/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Env {
  OPENAI_API_KEY: string;
  DATABASE_URL: string;
}

interface ImportMetaEnv {
  readonly OPENAI_API_KEY: string;
  readonly DATABASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
