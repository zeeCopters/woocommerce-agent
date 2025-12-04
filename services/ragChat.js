import { tool } from "@langchain/core/tools";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/community/vectorstores/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";

// Initialize Pinecone client
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Pinecone index + namespace
const index = pc.Index(process.env.PINECONE_INDEX);
const namespace = process.env.PINECONE_NAMESPACE || undefined;

// LangChain embeddings
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

// Convert Pinecone → Retriever
const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex: index,
  namespace,
});

// LLM
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama3-70b-8192",
  temperature: 0,
});

// TOOL
export const ragTool = tool(
  async ({ query }) => {
    if (!query) return "Missing query";

    // Retrieve
    const results = await vectorStore.similaritySearch(query, 4);
    if (!results || results.length === 0) {
      return "No relevant documents found.";
    }

    const context = results.map((r) => `• ${r.pageContent}`).join("\n\n");

    // Ask LLM
    const prompt = `
Use ONLY the following context to answer the question.
If answer is not in context, say "I don't know".

Context:
${context}

Question: ${query}

Answer:
`;

    const response = await llm.invoke(prompt);
    return response.content;
  },
  {
    name: "rag_tool",
    description: "RAG: answer from Pinecone vector DB",
    schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  }
);
