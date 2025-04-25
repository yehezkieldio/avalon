import { verifyKey } from "discord-interactions";
import { handleInteraction } from "./commands";
import { type Env } from "./types";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        const signature = request.headers.get("x-signature-ed25519");
        const timestamp = request.headers.get("x-signature-timestamp");
        const body = await request.clone().text(); // Clone request to read body multiple times

        if (!signature || !timestamp) {
            console.error("Missing signature headers");
            return new Response("Bad request signature.", { status: 401 });
        }

        const isValidRequest = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);

        if (!isValidRequest) {
            console.error("Invalid Request Signature");
            return new Response("Bad request signature.", { status: 401 });
        }

        return handleInteraction(request, env, ctx);
    }
};
