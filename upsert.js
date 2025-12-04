import "dotenv/config"; // Required to load environment variables from .env
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"; // <-- This is the CRITICAL, fixed import

// --- CONFIGURATION FOR NEW UPSERT ---
// IMPORTANT: Ensure the PDF is accessible by the script (e.g., in the same directory).
const PDF_FILE_PATH = "Company Policy.pdf";

// These values must match the .env file and your ragTool.js
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
// NEW NAMESPACE to store the clean, re-embedded data
const NEW_PINECONE_NAMESPACE = "company-policy-2023v10pdf";

if (
  !PINECONE_INDEX_NAME ||
  !process.env.OPENAI_API_KEY ||
  !process.env.PINECONE_API_KEY
) {
  console.error(
    "Missing required environment variables. Ensure PINECONE_INDEX_NAME, OPENAI_API_KEY, and PINECONE_API_KEY are set in your .env file."
  );
  process.exit(1);
}

/**
 * Loads, chunks, embeds, and uploads a PDF document to Pinecone.
 */
async function runUpsert() {
  try {
    console.log(`Starting upsert process for new file: ${PDF_FILE_PATH}`);

    // 1. Load the PDF document
    console.log("1. Loading PDF document...");
    const loader = new PDFLoader(PDF_FILE_PATH);
    const rawDocs = await loader.load();
    console.log(`   - Loaded ${rawDocs.length} raw pages.`);

    // 2. Split documents into chunks for embedding
    console.log("2. Splitting documents into chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(rawDocs);
    console.log(`   - Split into ${splitDocs.length} chunks for embedding.`);

    // 3. Initialize Embeddings and Pinecone
    console.log("3. Initializing Pinecone and Embeddings...");
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);

    // 4. Upsert (Embed and Store) the documents into the NEW NAMESPACE
    console.log(
      `4. Upserting documents to index "${PINECONE_INDEX_NAME}" in NEW namespace "${NEW_PINECONE_NAMESPACE}"...`
    );

    // This function handles the embedding and uploading in bulk
    await PineconeStore.fromDocuments(splitDocs, embeddings, {
      pineconeIndex,
      namespace: NEW_PINECONE_NAMESPACE,
    });

    console.log("\n✅ Successfully uploaded all document vectors to Pinecone!");
    console.log(
      `   The data is stored in the namespace: ${NEW_PINECONE_NAMESPACE}`
    );
    console.log(
      `   You MUST update PINECONE_NAMESPACE in your .env file to use this new data.`
    );
  } catch (error) {
    console.error("\n❌ RAG Upsert Failed!");
    console.error("   Error details:", error.message);
    process.exit(1);
  }
}

runUpsert();
