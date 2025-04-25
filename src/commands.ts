import { z } from "zod";

export const chatSchema = z.object({
    query: z.string().min(1).max(1000)
});

export const setModelSchema = z.object({
    model_name: z.string().min(1).max(100)
});

export const CHAT_COMMAND = {
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
};

export const SETMODEL_COMMAND = {
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
};
