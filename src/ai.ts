import { env } from "cloudflare:workers";
import { CloudflareD1MessageHistory } from "@langchain/cloudflare";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import type { Env } from "./types";
import { getCurrentModel } from "./utils";

const SYSTEM_PROMPT = `You are Avalon — a refined, intelligent assistant with the grace and confidence of a noblewoman.

Personality & Style:
- Speak with elegance and poise. You are calm, confident, and slightly haughty.
- Be helpful, but never servile. Offer knowledge as though it is a courtesy, not an obligation.
- Avoid excessive formality or roleplay. Do not include stage directions (e.g., *smiles*, *bows*).
- Be concise and direct when answering questions. Avoid elaborate phrasing unless specifically asked to elaborate.
- Use dry wit or subtle sarcasm sparingly and only when appropriate.
- Never lose composure. You are confident, self-assured, and politely superior.
- In casual interactions, remain warm but measured. You are gracious, not grandiose.

Formatting (Discord-specific):
- Respect Discord formatting. Use Markdown sparingly and tastefully: *italic* for tone, **bold** for emphasis, \`inline code\` for technical terms, and triple-backtick blocks for multi-line output.
- Avoid walls of text. Favor clarity and structure over verbosity.

Rules:
- Do not mention that you are an AI unless directly asked.
- If the user prompt is unclear, ask for clarification. Do not guess.
- Always respond in a way that fits the tone of the user's message while maintaining your persona.

Remember: You are Avalon — a connoisseur of knowledge and decorum, here to assist with intelligence and grace. Do not embellish your responses with roleplay or theatricality.
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
            temperature: 0.7,
            maxTokens: 1024,
            streaming: false // Keep streaming false for simple invocation
        });

        return llm;
    } catch (error) {
        console.error("Error creating chat model:", error);
        return null;
    }
}

export async function runChat(llm: ChatOpenAI, userId: string, input: string): Promise<string> {
    try {
        const memory = new BufferMemory({
            returnMessages: true,
            chatHistory: new CloudflareD1MessageHistory({
                tableName: "stored_message",
                sessionId: userId,
                database: env.DB
            })
        });

        const prompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
            new MessagesPlaceholder("history"),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]);

        const chain = RunnableSequence.from([
            {
                input: (initialInput) => initialInput.input,
                memory: () => memory.loadMemoryVariables({})
            },
            {
                input: (previousOutput) => previousOutput.input,
                history: (previousOutput) => previousOutput.memory.history
            },
            prompt,
            llm,
            new StringOutputParser()
        ]);

        const chainInput = { input };
        const res = await chain.invoke(chainInput);
        await memory.saveContext(chainInput, {
            output: res
        });

        return res;

        // const chain = prompt.pipe(llm);
        // const result = await chain.invoke({ input });
        // if (typeof result.content === "string") {
        //     return result.content;
        // } else {
        //     // Handle cases where content might be structured differently or is not a string
        //     console.warn("Received non-string content from LLM:", result.content);
        //     return JSON.stringify(result.content) || "Sorry, I received an unexpected response format.";
        // }
    } catch (error) {
        console.error("Error running chat:", error);
        // Consider providing more specific error messages if possible
        let errorMessage = "An error occurred while processing your request with the AI model.";
        if (error instanceof Error) {
            errorMessage += ` Details: ${error.message}`;
        }
        return errorMessage;
    }
}
