// services/ragChat.js
import { OpenAI } from "langchain/llms/openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { ConversationalRetrievalQAChain } from "langchain/chains";

// Initialize Pinecone client
const pinecone = new PineconeClient();
await pinecone.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENV, // Make sure to add PINECONE_ENV in your .env
});

// Connect to existing Pinecone index
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Create vector store from existing Pinecone index
const vectorStore = await PineconeStore.fromExistingIndex(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  {
    pineconeIndex: index,
    namespace: process.env.PINECONE_NAMESPACE,
  }
);

// Initialize Conversational Retrieval QA Chain
const chain = ConversationalRetrievalQAChain.fromLLM(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY, temperature: 0 }),
  vectorStore.asRetriever()
);

/**
 * Ask question to RAG system
 * @param {string} question
 * @param {Array} chatHistory
 */
export async function askRAG(question, chatHistory = []) {
  const res = await chain.call({
    question,
    chat_history: chatHistory,
  });
  return res.text;
}
