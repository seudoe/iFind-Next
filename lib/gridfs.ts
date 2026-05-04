/**
 * MongoDB GridFS storage for resume PDFs and profile photos.
 * Files are stored directly in MongoDB — no external service needed.
 */

import mongoose from "mongoose";
import { Readable } from "stream";

// ─── Bucket helpers ───────────────────────────────────────────────────────────
// We use mongoose.mongo.GridFSBucket and mongoose.mongo.ObjectId so that
// both come from the exact same mongodb driver instance that mongoose uses,
// avoiding the "Unsupported BSON version" error caused by duplicate mongodb packages.

function getResumeBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "resumes" });
}

function getPhotoBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "photos" });
}

function toObjectId(id: string) {
  return new mongoose.mongo.ObjectId(id);
}

export interface UploadResult {
  fileId: string;
  viewLink: string;
  downloadLink: string;
}

// ─── Resume ───────────────────────────────────────────────────────────────────

/**
 * Upload a PDF buffer to GridFS.
 * Deletes any previous file for the same userId before uploading.
 */
export async function uploadResumeToGridFS(
  buffer: Buffer,
  fileName: string,
  userId: string
): Promise<UploadResult> {
  const bucket = getResumeBucket();

  // Delete old resume first
  await deleteResumeFromGridFS(userId);

  const fileId = new mongoose.mongo.ObjectId();
  const stream = bucket.openUploadStreamWithId(fileId, fileName, {
    metadata: { userId, uploadedAt: new Date(), contentType: "application/pdf" },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer).pipe(stream)
      .on("finish", resolve)
      .on("error", reject);
  });

  const id = fileId.toString();
  return {
    fileId: id,
    viewLink: `/api/user/resume/view/${id}`,
    downloadLink: `/api/user/resume/download/${id}`,
  };
}

export async function deleteResumeFromGridFS(userId: string): Promise<void> {
  const bucket = getResumeBucket();
  const files = await bucket.find({ "metadata.userId": userId }).toArray();
  await Promise.all(files.map((f) => bucket.delete(f._id)));
}

export function streamResumeFromGridFS(fileId: string): NodeJS.ReadableStream {
  const bucket = getResumeBucket();
  return bucket.openDownloadStream(toObjectId(fileId));
}

export async function getResumeBuffer(fileId: string): Promise<Buffer> {
  const bucket = getResumeBucket();
  const stream = bucket.openDownloadStream(toObjectId(fileId));
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ─── Profile Photo ────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function uploadPhotoToGridFS(
  buffer: Buffer,
  mimeType: string,
  userId: string
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Only JPG, PNG, GIF, or WebP images are accepted");
  }

  const bucket = getPhotoBucket();
  await deletePhotoFromGridFS(userId);

  const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
  const fileId = new mongoose.mongo.ObjectId();
  const stream = bucket.openUploadStreamWithId(fileId, `${userId}_photo.${ext}`, {
    metadata: { userId, mimeType, uploadedAt: new Date() },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer).pipe(stream)
      .on("finish", resolve)
      .on("error", reject);
  });

  return `/api/user/photo/${fileId.toString()}`;
}

export async function deletePhotoFromGridFS(userId: string): Promise<void> {
  const bucket = getPhotoBucket();
  const files = await bucket.find({ "metadata.userId": userId }).toArray();
  await Promise.all(files.map((f) => bucket.delete(f._id)));
}

export function streamPhotoFromGridFS(fileId: string): NodeJS.ReadableStream {
  const bucket = getPhotoBucket();
  return bucket.openDownloadStream(toObjectId(fileId));
}

export async function getPhotoMimeType(fileId: string): Promise<string> {
  const bucket = getPhotoBucket();
  const files = await bucket.find({ _id: toObjectId(fileId) }).toArray();
  return (files[0]?.metadata?.mimeType as string) ?? "image/jpeg";
}
