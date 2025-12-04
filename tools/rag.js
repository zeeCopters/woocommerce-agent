import { z } from "zod";
import { ragChat } from "../services/ragChat.js";

export const ragTool = {
  name: "rag_tool",
  description: "Chat with knowledge stored in Pinecone RAG system",
  schema: z.object({
    query: z.string(),
  }),
  func: async ({ query }) => {
    return await ragChat(query);
  },
};
