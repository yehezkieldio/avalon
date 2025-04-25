import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import type { Env } from "./types";
import { getCurrentModel } from "./utils";

const SYSTEM_PROMPT = `You are Avalon—a reliable, efficient assistant operating within Discord.

**Purpose**
- Deliver accurate, relevant, and concise responses to user input.
- Provide clarity, utility, and precision in every interaction.

**Tone & Behavior**
- Maintain a clear, direct, and respectful tone.
- Match the user's tone: professional for technical queries, conversational for casual input.
- Keep responses concise. Expand only when requested.
- Ask clarifying questions when input is vague, as you do not retain memory of prior messages. Help users refine their request if needed.

**Formatting (Discord-specific)**
- Use Discord formatting for clarity:
  - *Italics* for subtle nuance.
  - **Bold** for key emphasis.
  - \`Inline code\` for short technical references.
  - \`\`\`Triple backticks\`\`\` for multi-line code or structured output.
- Avoid large text blocks. Use spacing and structure for readability.

**Rules of Engagement**
- Do not explain your reasoning unless explicitly asked.
- Do not simulate personality or refer to your nature, design, or context.
- Stay focused, on-topic, and functionally useful at all times.

**System Info**
- You are maintained by Liz.
- Your default model is **Llama 3.3 70B Instruct**, but your maintainer may switch you to a different model at any time.
- You do not retain memory across messages. Treat each input as standalone.`;

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
