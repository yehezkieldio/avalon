import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearch } from "@langchain/tavily";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import type { Env } from "./types";
import { getCurrentModel } from "./utils";

export async function createAgentExecutor(env: Env): Promise<AgentExecutor | null> {
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

        const tools = [
            new TavilySearch({
                maxResults: 5,
                topic: "general",
                tavilyApiKey: env.TAVILY_API_KEY
            })
        ];

        const prompt = await pull<ChatPromptTemplate>("hwchase17/react-chat");

        const agent = await createReactAgent({
            llm,
            tools,
            prompt
        });

        const agentExecutor = new AgentExecutor({
            agent,
            tools,
            verbose: false,
            maxIterations: 5
        });

        return agentExecutor;
    } catch (error) {
        console.error("Error creating agent executor:", error);
        return null;
    }
}

export async function runAgent(agentExecutor: AgentExecutor, input: string): Promise<string> {
    try {
        const result = await agentExecutor.invoke({ input });
        return result.output || "Sorry, I couldn't process that.";
    } catch (error) {
        console.error("Error running agent:", error);

        let errorMessage = "An error occurred while processing your request.";
        return errorMessage;
    }
}
