import { isChatInputApplicationCommandInteraction } from "discord-api-types/utils";
import { InteractionResponseFlags, InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { AutoRouter } from "itty-router";
import { createChatModel, runChat } from "./ai";
import { CHAT_COMMAND, chatSchema, SETMODEL_COMMAND, setModelSchema } from "./commands";
import type { Env } from "./types";
import { ephemeralMessage, getCurrentModel, jsonResponse, sendFollowup, setCurrentModel } from "./utils";

const router = AutoRouter();

router.get("/", (_request: Request, env: Env) => {
    return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post("/", async (request: Request, env: Env, ctx: ExecutionContext) => {
    const { isValid, interaction } = await server.verifyDiscordRequest(request, env);
    if (!isValid || !interaction) {
        return new Response("Bad request signature.", { status: 401 });
    }

    if (interaction.type === InteractionType.PING) {
        return jsonResponse({
            type: InteractionResponseType.PONG
        });
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        if (isChatInputApplicationCommandInteraction(interaction)) {
            switch (interaction.data.name.toLowerCase()) {
                case CHAT_COMMAND.name.toLocaleLowerCase(): {
                    const userId = interaction.member?.user?.id || interaction.user?.id;

                    ctx.waitUntil(
                        (async () => {
                            if (!interaction.data.options) {
                                await sendFollowup(interaction.token, env.DISCORD_APPLICATION_ID, {
                                    content: "No options provided.",
                                    flags: InteractionResponseFlags.EPHEMERAL
                                });
                                return;
                            }

                            const options = interaction.data.options.reduce((acc: Record<string, unknown>, opt) => {
                                if ("value" in opt) {
                                    acc[opt.name] = opt.value;
                                }
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

                            const chatModel = await createChatModel(env);
                            if (!chatModel) {
                                await sendFollowup(interactionToken, applicationId, {
                                    content: "Failed to initialize the AI model. Please contact the owner.",
                                    flags: InteractionResponseFlags.EPHEMERAL
                                });
                                return;
                            }

                            const result = await runChat(chatModel, userId!, query);

                            const chunks = [];
                            for (let i = 0; i < result.length; i += 1990) {
                                chunks.push(result.substring(i, i + 1990));
                            }

                            await sendFollowup(interactionToken, applicationId, {
                                content: chunks[0] || "..."
                            });

                            for (let i = 1; i < chunks.length; i++) {
                                await new Promise((resolve) => setTimeout(resolve, 1000));
                                await sendFollowup(interactionToken, applicationId, {
                                    content: chunks[i]
                                });
                            }
                        })().catch((err) => {
                            console.error("Error during async chat processing:", err);
                            sendFollowup(interaction.token, env.DISCORD_APPLICATION_ID, {
                                content:
                                    "An unexpected error occurred while processing your request." +
                                    (err instanceof Error ? `\n\`${err.message}\`` : ""), // Include error message safely
                                flags: InteractionResponseFlags.EPHEMERAL
                            }).catch((followupErr) => console.error("Failed to send error followup:", followupErr));
                        })
                    );

                    return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
                }

                case SETMODEL_COMMAND.name.toLocaleLowerCase(): {
                    const userId = interaction.member?.user?.id || interaction.user?.id;

                    if (userId !== env.OWNER_USER_ID) {
                        console.warn(`Unauthorized setmodel attempt by user ${userId}`);
                        return ephemeralMessage("You do not have permission to use this command.");
                    }

                    if (!interaction.data.options) {
                        return ephemeralMessage("No options provided.");
                    }

                    const options = interaction.data.options.reduce((acc: Record<string, unknown>, opt) => {
                        if ("value" in opt) {
                            acc[opt.name] = opt.value;
                        }
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
                    try {
                        await setCurrentModel(env, model_name);
                        const currentSetModel = await getCurrentModel(env);
                        return ephemeralMessage(`Model set to: \`${currentSetModel}\`.`);
                    } catch (error) {
                        console.error("Error setting model:", error);
                        return ephemeralMessage("Failed to set the model due to an internal error.");
                    }
                }
            }
        }
    }

    console.error("Unknown Interaction Type or Command");
    if (interaction?.token) {
        fetch(
            `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: "Sorry, I couldn't understand that command.",
                    flags: InteractionResponseFlags.EPHEMERAL
                })
            }
        ).catch((e) => console.error("Failed to send unknown command followup:", e));
    }
    return jsonResponse({ error: "Unknown Type" });
});
router.all("*", () => new Response("Not Found.", { status: 404 }));

// ... existing verifyDiscordRequest ...
async function verifyDiscordRequest(request: Request, env: Env) {
    const signature: string | null = request.headers.get("x-signature-ed25519");
    const timestamp: string | null = request.headers.get("x-signature-timestamp");
    const body: string = await request.text(); // Read body once

    // Clone the request to read the body again for JSON parsing if verification passes
    const isValidRequest =
        signature && timestamp && (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));

    if (!isValidRequest) {
        console.warn("Invalid Discord request signature received.");
        return { isValid: false };
    }

    try {
        return { interaction: JSON.parse(body), isValid: true };
    } catch (e) {
        console.error("Failed to parse interaction body:", e);
        return { isValid: false }; // Treat parse failure as invalid
    }
}

const server = {
    verifyDiscordRequest,
    fetch: router.fetch
};

export default server;
