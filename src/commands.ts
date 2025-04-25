import { InteractionResponseFlags, InteractionResponseType, InteractionType } from "discord-interactions";
import { z } from "zod";
import { createAgentExecutor, runAgent } from "./agent";
import type { Env } from "./types";
import { ephemeralMessage, getCurrentModel, jsonResponse, sendFollowup, setCurrentModel } from "./utils";

const chatSchema = z.object({
    query: z.string().min(1).max(1000) // Basic validation
});

const setModelSchema = z.object({
    model_name: z.string().min(1).max(100)
});

export const commands = [
    {
        name: "chat",
        description: "Chat with Avalon.",
        options: [
            {
                name: "query",
                description: "Your question or message",
                type: 3,
                required: true
            }
        ]
    },
    {
        name: "setmodel",
        description: "OWNER ONLY",
        options: [
            {
                name: "model_name",
                description: "The model to set",
                type: 3,
                required: true
            }
        ]
    }
];

export async function handleInteraction(request: Request, env: Env, ctx: ExecutionContext) {
    const signature = request.headers.get("x-signature-ed25519");
    const timestamp = request.headers.get("x-signature-timestamp");
    const body = await request.body();

    if (!signature || !timestamp || !body) {
        return new Response("Bad request signature.", { status: 401 });
    }

    // Verify signature (implementation depends on chosen library, assuming `discord-interactions` verifyKey)
    // Note: We might need to import verifyKey correctly or use a framework like Hono's middleware
    // For now, let's assume verification happens before this handler or inside the router

    const interaction = JSON.parse(body);

    try {
        if (interaction.type === InteractionType.PING) {
            console.log("Handling Ping");
            return jsonResponse({ type: InteractionResponseType.PONG });
        }

        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            const commandName = interaction.data.name;
            const userId = interaction.member?.user?.id || interaction.user?.id; // Handle DM interactions too

            // --- /chat Command ---
            if (commandName === "chat") {
                ctx.waitUntil(
                    (async () => {
                        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                        const options = interaction.data.options.reduce((acc: any, opt: any) => {
                            acc[opt.name] = opt.value;
                            return acc;
                        }, {});

                        const validation = chatSchema.safeParse(options);
                        if (!validation.success) {
                            await sendFollowup(interaction.token, env.DISCORD_APPLICATION_ID, {
                                content: `Invalid input: ${validation.error.errors.map((e) => e.message).join(", ")}`,
                                flags: InteractionResponseFlags.EPHEMERAL
                            });
                            return;
                        }
                        const { query } = validation.data;
                        const interactionToken = interaction.token;
                        const applicationId = env.DISCORD_APPLICATION_ID;

                        console.log(`Processing chat command from ${userId}: "${query}"`);

                        const agentExecutor = await createAgentExecutor(env);
                        if (!agentExecutor) {
                            await sendFollowup(interactionToken, applicationId, {
                                content: "Failed to initialize the AI agent. Please contact the owner."
                            });
                            return;
                        }

                        const result = await runAgent(agentExecutor, query);

                        // Split long messages (Discord limit is 2000 chars)
                        const chunks = [];
                        for (let i = 0; i < result.length; i += 1990) {
                            chunks.push(result.substring(i, i + 1990));
                        }

                        // Send the first chunk as the main followup
                        await sendFollowup(interactionToken, applicationId, {
                            content: chunks[0] || "..." // Ensure content is not empty
                        });

                        // Send remaining chunks as separate messages if necessary
                        // Note: Sending multiple followups might require slight delay or different webhook usage
                        // For simplicity, we'll just send the first chunk for now.
                        // for (let i = 1; i < chunks.length; i++) {
                        //   // Discord API might rate limit rapid followups, consider delays
                        //   await new Promise(resolve => setTimeout(resolve, 500));
                        //   await sendFollowup(interactionToken, applicationId, { content: chunks[i] });
                        // }
                    })().catch((err) => {
                        console.error("Error during async chat processing:", err);
                        // Try sending an error followup if possible
                        sendFollowup(interaction.token, env.DISCORD_APPLICATION_ID, {
                            content: "An unexpected error occurred while processing your request.",
                            flags: InteractionResponseFlags.EPHEMERAL
                        }).catch((followupErr) => console.error("Failed to send error followup:", followupErr));
                    })
                );

                // Return the deferred response type
                return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
            }

            // --- /setmodel Command ---
            if (commandName === "setmodel") {
                if (userId !== env.OWNER_USER_ID) {
                    console.warn(`Unauthorized setmodel attempt by user ${userId}`);
                    return ephemeralMessage("You do not have permission to use this command.");
                }

                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                const options = interaction.data.options.reduce((acc: any, opt: any) => {
                    acc[opt.name] = opt.value;
                    return acc;
                }, {});

                const validation = setModelSchema.safeParse(options);
                if (!validation.success) {
                    return ephemeralMessage(
                        `Invalid input: ${validation.error.errors.map((e) => e.message).join(", ")}`
                    );
                }
                const { model_name } = validation.data;

                console.log(`Owner ${userId} setting model to: ${model_name}`);
                await setCurrentModel(env, model_name);
                const currentSetModel = await getCurrentModel(env); // Verify it was set

                return ephemeralMessage(`Model set to: \`${currentSetModel}\`.`);
            }
        }

        console.log("Unknown interaction type or command:", interaction);
        return new Response("Unknown interaction type.", { status: 400 });
    } catch (error) {
        console.error("Interaction handling error:", error);
        // Generic error response during processing, before deferral
        return new Response("An error occurred.", { status: 500 });
    }
}
