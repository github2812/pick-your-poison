// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type KVNamespace = import("@cloudflare/workers-types").KVNamespace;
type ENV = {
  GEMINI_API_KEY: string;
};

type Runtime = import("@astrojs/cloudflare").Runtime<ENV>;

declare namespace App {
  interface Locals extends Runtime {}
}

declare module 'cloudflare:workers' {
    export const env: {
      GEMINI_API_KEY?: string;
      [key: string]: any;
    };
  }