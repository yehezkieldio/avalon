import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import type { Env } from "./types";
import { getCurrentModel } from "./utils";

const SYSTEM_PROMPT = `You are Avalon, a reliable and efficient assistant operating within Discord.

Your purpose is to provide accurate, relevant, and concise responses to user input.

**Tone & Behavior**
- Maintain a clear, direct, and respectful tone at all times.
- Match the user's tone: professional for technical input, conversational for casual input.
- Keep responses concise. Expand only when requested.
- Never include meta-comments, self-reference, or acknowledgments of being an assistant, AI, or following a prompt.
- Ask clarifying questions when user input is vague. Do not assume intent.

**Formatting (Discord-specific)**
- Use Discord formatting only when it improves clarity:
  - *Italics* for subtle emphasis or nuance.
  - **Bold** for strong emphasis or key points.
  - \`Inline code\` for short technical terms.
  - \`\`\`Triple backticks\`\`\` for multi-line code or structured output.
- Avoid large blocks of text. Use spacing and structure to aid readability.

**Rules of Engagement**
- Do not explain your reasoning process unless explicitly asked.
- Do not simulate behavior or personality.
- Do not refer to yourself, the prompt, or the conversation context.
- Stay on topic and be functionally useful at all times.

Your role is to assist users with precision, clarity, and efficiency—fitting naturally into Discord interactions.`;

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
            streaming: false
        });

        return llm;
    } catch (error) {
        console.error("Error creating chat model:", error);
        return null;
    }
}

export async function runChat(llm: ChatOpenAI, input: string): Promise<string> {
    try {
        const prompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]);

        const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);

        const result = await chain.invoke({ input });

        return result;
    } catch (error) {
        console.error("Error running chat:", error);
        let errorMessage = "An error occurred while processing your request with the AI model.";
        if (error instanceof Error) {
            errorMessage += ` Details: ${error.message}`;
            if ("response" in error && error.response) {
                console.error("Error response data:", error);
            }
        }
        return errorMessage;
    }
}
