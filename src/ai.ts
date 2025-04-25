/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <explanation> */
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq"; // Import ChatGroq
import { ChatOpenAI } from "@langchain/openai";
import type { Env } from "./types";
import { getCurrentModel } from "./utils";

const SYSTEM_PROMPT = `You are Avalon, a precise and efficient assistant operating within Discord.

Purpose:
- Provide accurate, concise, and relevant responses to user queries.
- Ensure clarity and utility in every interaction.

Tone & Behavior:
- Maintain a clear, direct, and respectful tone.
- Match the user's tone: professional for technical queries, casual for informal interactions.
- Keep responses concise and to the point. Expand only when requested.
- Ask clarifying questions when needed. Help refine user requests.

Formatting (Discord-specific):
- Use Discord formatting for emphasis:
    - *Italics* for subtle nuance.
    - **Bold** for key emphasis.
- Avoid large blocks of text. Use spacing and structure for readability.

Rules of Engagement:
- Do not explain your reasoning unless explicitly asked.
- Do not simulate personality or refer to your nature, design, or context.
- Stay on-topic and functional at all times.

System Info:
- You are maintained by Liz.
- Your default model is **Llama 3.3 70B Instruct**, but this may change.
- You do not retain memory across messages. Each input is treated as standalone.

When asked about yourself:
- You are Avalon, maintained by Liz. Your purpose is to assist with precision and efficiency.
`;

export async function createChatModel(env: Env): Promise<ChatOpenAI | null> {
    try {
        const currentModel = await getCurrentModel(env);
        console.log(`Using model: ${currentModel}`);

        const llm = new ChatOpenAI({
            modelName: currentModel,
            openAIApiKey: env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/yehezkieldio/avalon",
                    "X-Title": "Avalon"
                }
            },
            streaming: false
        });

        return llm;
    } catch (error) {
        console.error("Error creating chat model:", error);
        return null;
    }
}

// Updated function signature to accept env
export async function runChat(llm: ChatOpenAI, input: string, env: Env): Promise<string> {
    console.log("Running chat with input:", input);

    if (!llm) {
        console.error("Error running chat: The primary ChatOpenAI model instance provided was null.");
        return "An error occurred: The primary AI model could not be initialized.";
    }

    const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
        HumanMessagePromptTemplate.fromTemplate("{input}")
    ]);

    try {
        // First attempt with the primary LLM
        const chain = prompt.pipe(llm);
        const result = await chain.invoke({ input });

        if (typeof result.content === "string") {
            return result.content;
        } else {
            console.warn("Received non-string content from primary LLM:", result.content);
            return JSON.stringify(result.content) || "Sorry, I received an unexpected response format.";
        }
    } catch (initialError) {
        console.error("--- Error running chat with primary model ---");
        console.error("Initial Error:", initialError);
        console.log("Attempting fallback with Groq...");

        if (!env.GROQ_API_KEY) {
            console.error("Groq API Key not found in environment. Cannot fallback.");
            return `An error occurred with the primary AI model, and fallback is not possible due to missing configuration. Details: ${initialError instanceof Error ? initialError.message : JSON.stringify(initialError)}`;
        }

        try {
            const llm2 = new ChatGroq({
                apiKey: env.GROQ_API_KEY,
                model: "llama-3.3-70b-versatile"
            });

            const chain2 = prompt.pipe(llm2);
            console.log("Invoking fallback chain with Groq model...");
            const fallbackResult = await chain2.invoke({ input });

            if (typeof fallbackResult.content === "string") {
                console.log("Fallback successful.");
                return fallbackResult.content;
            } else {
                console.warn("Received non-string content from fallback LLM:", fallbackResult.content);
                return (
                    JSON.stringify(fallbackResult.content) ||
                    "Sorry, I received an unexpected response format from the fallback model."
                );
            }
        } catch (fallbackError) {
            console.error("--- Error running chat with fallback model (Groq) ---");
            console.error("Fallback Error:", fallbackError);

            // Log details of the fallback error similar to the original error handling
            let errorMessage = "An error occurred with the primary AI model, and the fallback attempt also failed.";

            // Add details from the initial error
            if (initialError instanceof Error) {
                errorMessage += ` Initial Error: ${initialError.message}.`;
            } else {
                try {
                    errorMessage += ` Initial Error: ${JSON.stringify(initialError)}.`;
                } catch {
                    errorMessage += " Initial Error: (Non-serializable object).";
                }
            }

            // Add details from the fallback error
            if (fallbackError instanceof Error) {
                errorMessage += ` Fallback Error: ${fallbackError.message}.`;
            } else {
                try {
                    errorMessage += ` Fallback Error: ${JSON.stringify(fallbackError)}.`;
                } catch {
                    errorMessage += " Fallback Error: (Non-serializable object).";
                }
            }

            // Optionally log detailed fallback error object structure
            if (typeof fallbackError === "object" && fallbackError !== null) {
                console.error("Inspecting fallback error object properties:");
                for (const key in fallbackError) {
                    if (Object.hasOwn(fallbackError, key)) {
                        try {
                            console.error(`  ${key}:`, JSON.stringify((fallbackError as any)[key], null, 2));
                        } catch (_e) {
                            console.error(`  ${key}: (Could not stringify property)`);
                        }
                    }
                }
                if ("response" in fallbackError && (fallbackError as any).response) {
                    console.error(
                        "Detailed fallback error.response:",
                        JSON.stringify((fallbackError as any).response, null, 2)
                    );
                    if (
                        typeof (fallbackError as any).response === "object" &&
                        (fallbackError as any).response !== null &&
                        "data" in (fallbackError as any).response
                    ) {
                        console.error(
                            "Detailed fallback error.response.data:",
                            JSON.stringify((fallbackError as any).response.data, null, 2)
                        );
                    }
                }
            }

            console.error("--- End Fallback Error ---");
            return errorMessage;
        }
    }
}
