import { isChatInputApplicationCommandInteraction } from "discord-api-types/utils";
import { InteractionResponseFlags, InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { AutoRouter } from "itty-router";
import { createAgentExecutor, runAgent } from "./agent";
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

                            const agentExecutor = await createAgentExecutor(env);
                            if (!agentExecutor) {
                                await sendFollowup(interactionToken, applicationId, {
                                    content: "Failed to initialize the AI agent. Please contact the owner."
                                });
                                return;
                            }

                            const result = await runAgent(agentExecutor, query);

                            const chunks = [];
                            for (let i = 0; i < result.length; i += 1990) {
                                chunks.push(result.substring(i, i + 1990));
                            }

                            await sendFollowup(interactionToken, applicationId, {
                                content: chunks[0] || "..."
                            });
                        })().catch((err) => {
                            console.error("Error during async chat processing:", err);
                            // Try sending an error followup if possible
                            sendFollowup(interaction.token, env.DISCORD_APPLICATION_ID, {
                                content: "An unexpected error occurred while processing your request." + err.message,
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
        }
    }

    console.error("Unknown Type");
    return jsonResponse({ error: "Unknown Type" });
});
router.all("*", () => new Response("Not Found.", { status: 404 }));

async function verifyDiscordRequest(request: Request, env: Env) {
    const signature: string | null = request.headers.get("x-signature-ed25519");
    const timestamp: string | null = request.headers.get("x-signature-timestamp");
    const body: string = await request.text();

    const isValidRequest =
        signature && timestamp && (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
    if (!isValidRequest) {
        return { isValid: false };
    }

    return { interaction: JSON.parse(body), isValid: true };
}

const server = {
    verifyDiscordRequest,
    fetch: router.fetch
};

export default server;
