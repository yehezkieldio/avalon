import { InteractionResponseFlags, InteractionResponseType } from "discord-interactions";
import { type Env } from "./types";

/**
 * Sends a followup message to an interaction.
 */
export async function sendFollowup(token: string, applicationId: string, messageData: unknown): Promise<Response> {
    const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(messageData)
    });
    if (!response.ok) {
        console.error(`Discord API error: ${response.status} ${response.statusText}`, await response.json());
    }
    return response;
}

/**
 * Gets the current model from KV or default.
 */
export async function getCurrentModel(env: Env): Promise<string> {
    try {
        const model = await env.SETTINGS_KV.get("CURRENT_MODEL");
        return model || "meta-llama/llama-3.2-3b-instruct:free";
    } catch (e) {
        console.error("KV get error:", e);
        return "meta-llama/llama-3.2-3b-instruct:free";
    }
}

/**
 * Sets the current model in KV.
 */
export async function setCurrentModel(env: Env, model: string): Promise<void> {
    try {
        await env.SETTINGS_KV.put("CURRENT_MODEL", model);
    } catch (e) {
        console.error("KV put error:", e);
    }
}

/**
 * Helper to create a simple text response for Discord.
 */
export function jsonResponse(data: unknown) {
    return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * Helper for ephemeral messages
 */
export function ephemeralMessage(content: string) {
    return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content,
            flags: InteractionResponseFlags.EPHEMERAL
        }
    });
}
