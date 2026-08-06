/**
 * Internship Event Handlers
 * 
 * Phase 6: Event-driven recommendation system
 * 
 * Handles internship lifecycle events:
 * - onInternshipAdded: Generate embeddings and insert into HNSW index
 * - onInternshipExpired: Remove from HNSW index
 * 
 * Does NOT trigger global recommendation regeneration.
 * Recommendations are generated lazily when requested.
 */

import { HNSWIndexManager } from "@/lib/hnsw/HNSWIndexManager";
import { HNSW_PATHS, HNSW_CONFIGS } from "@/lib/hnsw/config";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

const HF_BASE = "https://seudoe-vectorisationResume.hf.space";
const BOOST_WEIGHT = 0.15;

/**
 * Generate vectors for an internship via HuggingFace API
 */
async function generateInternshipVectors(
  internshipId: string,
  title: string,
  description: string
): Promise<{ tfidf: number[]; bert: number[] } | null> {
  try {
    const response = await fetch(`${HF_BASE}/encode-internships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        internships: [{ id: internshipId, title, description }],
        boost_weight: BOOST_WEIGHT,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HF API error (${response.status}): ${text.slice(0, 200)}`);
    }

    const result = await response.json();
    
    if (!result.vectors || result.vectors.length === 0) {
      console.error(`❌ No vectors returned for internship ${internshipId}`);
      return null;
    }

    const vector = result.vectors[0];
    return {
      tfidf: vector.tfidf,
      bert: vector.bert,
    };
  } catch (error) {
    console.error(`❌ Failed to generate vectors for internship ${internshipId}:`, error);
    return null;
  }
}

/**
 * Event handler: Internship added
 * 
 * Flow:
 * 1. Generate embeddings via HuggingFace API
 * 2. Save vectors to database
 * 3. Insert BERT vector into HNSW index
 * 4. Do NOT regenerate recommendations (lazy generation on request)
 * 
 * @param internshipId - ID of the newly added internship
 */
export async function onInternshipAdded(internshipId: string): Promise<void> {
  console.log(`📥 Event: Internship added (${internshipId})`);

  try {
    await connectDB();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection not established");
    }

    // Load internship details
    const internship = await db.collection("internships").findOne(
      { _id: new mongoose.Types.ObjectId(internshipId) },
      { projection: { name: 1, summary: 1, tfidf_vector: 1, bert_vector: 1 } }
    );

    if (!internship) {
      console.error(`❌ Internship ${internshipId} not found`);
      return;
    }

    // Check if already vectorized
    if (internship.tfidf_vector && internship.bert_vector) {
      console.log(`✅ Internship ${internshipId} already vectorized, inserting into index...`);
    } else {
      // Generate vectors
      console.log(`🔄 Generating vectors for internship ${internshipId}...`);
      
      if (!internship.name || !internship.summary) {
        console.error(`❌ Internship ${internshipId} missing name or summary`);
        return;
      }

      const vectors = await generateInternshipVectors(
        internshipId,
        internship.name,
        internship.summary
      );

      if (!vectors) {
        console.error(`❌ Failed to vectorize internship ${internshipId}`);
        return;
      }

      // Save vectors to database
      await db.collection("internships").updateOne(
        { _id: new mongoose.Types.ObjectId(internshipId) },
        { $set: { tfidf_vector: vectors.tfidf, bert_vector: vectors.bert } }
      );

      internship.bert_vector = vectors.bert;
      console.log(`✅ Vectors saved for internship ${internshipId}`);
    }

    // Insert into HNSW index
    const indexManager = new HNSWIndexManager(
      HNSW_PATHS.internships,
      HNSW_CONFIGS.internships
    );

    // Load existing index
    const loaded = await indexManager.loadIndex();
    if (!loaded) {
      console.warn(`⚠️  HNSW index not found at ${HNSW_PATHS.internships}, initializing new index...`);
      await indexManager.initialize();
    }

    // Insert vector
    await indexManager.insertVector({
      id: internshipId,
      vector: internship.bert_vector,
      metadata: { name: internship.name },
    });

    // Save index
    await indexManager.saveIndex();

    console.log(`✅ Internship ${internshipId} inserted into HNSW index`);
    console.log(`✅ Event completed: Internship added (${internshipId})`);
    console.log(`ℹ️  Recommendations will be regenerated lazily when requested`);

  } catch (error) {
    console.error(`❌ Error handling internship added event for ${internshipId}:`, error);
    throw error;
  }
}

/**
 * Event handler: Internship expired
 * 
 * Flow:
 * 1. Remove from HNSW index
 * 2. Mark as inactive in database (already done by caller)
 * 3. Do NOT regenerate recommendations (lazy generation handles this)
 * 
 * @param internshipId - ID of the expired internship
 */
export async function onInternshipExpired(internshipId: string): Promise<void> {
  console.log(`🗑️  Event: Internship expired (${internshipId})`);

  try {
    // Remove from HNSW index
    const indexManager = new HNSWIndexManager(
      HNSW_PATHS.internships,
      HNSW_CONFIGS.internships
    );

    // Load existing index
    const loaded = await indexManager.loadIndex();
    if (!loaded) {
      console.warn(`⚠️  HNSW index not found, nothing to remove`);
      return;
    }

    // Remove vector
    await indexManager.deleteVector(internshipId);

    // Save index
    await indexManager.saveIndex();

    console.log(`✅ Internship ${internshipId} removed from HNSW index`);
    console.log(`✅ Event completed: Internship expired (${internshipId})`);
    console.log(`ℹ️  Expired internship will be filtered out during recommendation generation`);

  } catch (error) {
    console.error(`❌ Error handling internship expired event for ${internshipId}:`, error);
    // Don't throw - expired internships will be filtered naturally
  }
}

/**
 * Batch event handler: Multiple internships added
 * 
 * More efficient than calling onInternshipAdded individually.
 * 
 * @param internshipIds - Array of internship IDs
 */
export async function onInternshipsAddedBatch(internshipIds: string[]): Promise<void> {
  console.log(`📥 Event: Batch internships added (${internshipIds.length} items)`);

  for (const id of internshipIds) {
    try {
      await onInternshipAdded(id);
    } catch (error) {
      console.error(`❌ Failed to process internship ${id} in batch:`, error);
      // Continue with next internship
    }
  }

  console.log(`✅ Batch event completed: ${internshipIds.length} internships processed`);
}
