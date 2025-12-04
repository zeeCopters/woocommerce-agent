import { tool } from "@langchain/core/tools";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const embeddingModel = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const ragLlm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0.1,
  maxRetries: 2,
});

const RAG_PROMPT_TEMPLATE = `
You are a helpful and accurate document retrieval assistant.
Answer the user's question only based on the retrieved context provided below.
If the context does not contain the answer, state clearly that you cannot find the answer in the documents.

--- CONTEXT ---
{context}

--- QUESTION ---
{question}
`;

const ragPrompt = PromptTemplate.fromTemplate(RAG_PROMPT_TEMPLATE);

async function getRetriever() {
  const pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);

  const vectorStore = await PineconeStore.fromExistingIndex(embeddingModel, {
    pineconeIndex,
    namespace: PINECONE_NAMESPACE,
  });

  return vectorStore.asRetriever(10);
}

let retrieverInstance;

async function runRAG(query) {
  //console.log("runRAG is called with this query: ", query);
  if (!retrieverInstance) {
    try {
      retrieverInstance = await getRetriever();
    } catch (error) {
      console.error(
        "RAG Tool: Error during retriever setup (Pinecone or Embedding initialization):",
        error.message
      );
      throw new Error("Failed to initialize RAG retriever.");
    }
  }

  //console.log("retrieverInstance is: ", retrieverInstance);

  const chain = RunnableSequence.from([
    {
      context: async (input) => {
        // 🛑 Must be async for 'await'
        const docs = await retrieverInstance.invoke(input.question);

        // --- CRITICAL DEBUGGING LOG ---
        const contextString = docs
          .map((doc) => doc.pageContent)
          .join("\n---\n");
        console.log("\n--- RETRIEVED CONTEXT DOCUMENTS (DEBUG) ---");
        if (contextString.length > 0) {
          console.log(contextString);
        } else {
          console.log(
            "NO DOCUMENTS RETRIEVED. (Index may be empty or query is too weak)"
          );
        }
        console.log("-------------------------------------------\n");
        // --- END CRITICAL DEBUGGING LOG ---

        return contextString; // Return the string for the LLM
      },
      question: (input) => input.question,
    },
    // {
    //   context: (input) =>
    //     retrieverInstance
    //       .invoke(input.question)
    //       .then((docs) => docs.map((doc) => doc.pageContent).join("\n---\n")),
    //   question: (input) => input.question,
    // },
    ragPrompt,
    ragLlm,
    new StringOutputParser(),
  ]);

  //console.log("chain is: ", chain);

  try {
    const result = await chain.invoke({ question: query });
    return result;
  } catch (error) {
    console.error(
      "RAG Tool: Error during chain invocation (Pinecone query or Groq LLM call):",
      error
    );
    throw new Error("Document search failed due to an internal API error.");
  }
}

export const documentSearchTool = tool(runRAG, {
  name: "document_search",
  description:
    "Useful for answering general, non-commerce-related questions, like those about store policies, shipping fees, returns, or technical information. Always use this tool if the question is NOT about adding to cart, viewing products, or checking out.",
});
