import { type KVNamespace } from "@cloudflare/workers-types";

export interface Env {
    DISCORD_BOT_TOKEN: string;
    OPENROUTER_API_KEY: string;
    TAVILY_API_KEY: string;

    DISCORD_PUBLIC_KEY: string;
    DISCORD_APPLICATION_ID: string;
    OWNER_USER_ID: string;

    SETTINGS_KV: KVNamespace;
}
