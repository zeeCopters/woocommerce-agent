// ragChat.js
import { Pinecone } from "@pinecone-database/pinecone";
import { ChatGroq } from "@langchain/groq";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-70b-versatile",
});

// ---------------------------
// ENV REQUIRED
// ---------------------------
// PINECONE_API_KEY
// PINECONE_INDEX_NAME
// PINECONE_NAMESPACE
// GROQ_API_KEY
// MODEL: "llama3-70b-8192" or "mixtral-8x7b" etc.

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// ---------------------------
// RAG CHAT FUNCTION
// ---------------------------

export async function ragChat(query) {
  try {
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

    // 1️⃣ Search Pinecone
    const searchResponse = await index.query({
      namespace: process.env.PINECONE_NAMESPACE,
      topK: 5,
      includeMetadata: true,
      vector: await embedText(query),
    });

    const context = searchResponse.matches
      .map((m) => m.metadata.text)
      .join("\n\n");

    // 2️⃣ Construct prompt
    const prompt = `
You are a helpful assistant. Use ONLY the context below to answer the user.
If the answer is not in the context, say: "I don't have information about this."

--- CONTEXT START ---
${context}
--- CONTEXT END ---

QUESTION: ${query}
ANSWER:
`;

    // 3️⃣ LLM Response
    const completion = await groq.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error("RAG Chat Error:", err);
    return "Error retrieving information from knowledge base.";
  }
}

// ---------------------------
// EMBEDDING HELPER
// ---------------------------

async function embedText(text) {
  try {
    const response = await groq.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (err) {
    console.error("Embedding Error:", err);
  }
}
