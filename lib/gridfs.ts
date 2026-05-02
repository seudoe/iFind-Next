/**
 * MongoDB GridFS storage for resume PDFs and profile photos.
 * Files are stored directly in MongoDB — no external service needed.
 */

import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

// ─── Bucket helpers ───────────────────────────────────────────────────────────

function getResumeBucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  return new GridFSBucket(db, { bucketName: "resumes" });
}

function getPhotoBucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected");
  return new GridFSBucket(db, { bucketName: "photos" });
}

export interface UploadResult {
  fileId: string;
  viewLink: string;
  downloadLink: string;
}

// ─── Resume ───────────────────────────────────────────────────────────────────

/**
 * Upload a PDF buffer to GridFS.
 * Deletes any previous file with the same userId before uploading.
 */
export async function uploadResumeToGridFS(
  buffer: Buffer,
  fileName: string,
  userId: string
): Promise<UploadResult> {
  const bucket = getResumeBucket();

  await deleteResumeFromGridFS(userId);

  const fileId = new mongoose.Types.ObjectId();
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
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

// ─── Profile Photo ────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Upload a profile photo buffer to GridFS.
 * Replaces any existing photo for the user.
 */
export async function uploadPhotoToGridFS(
  buffer: Buffer,
  mimeType: string,
  userId: string
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Only JPG, PNG, GIF, or WebP images are accepted");
  }

  const bucket = getPhotoBucket();

  // Delete old photo
  await deletePhotoFromGridFS(userId);

  const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
  const fileId = new mongoose.Types.ObjectId();
  const stream = bucket.openUploadStreamWithId(fileId, `${userId}_photo.${ext}`, {
    metadata: { userId, mimeType, uploadedAt: new Date() },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer).pipe(stream)
      .on("finish", resolve)
      .on("error", reject);
  });

  // Return the API URL that serves the image
  return `/api/user/photo/${fileId.toString()}`;
}

export async function deletePhotoFromGridFS(userId: string): Promise<void> {
  const bucket = getPhotoBucket();
  const files = await bucket.find({ "metadata.userId": userId }).toArray();
  await Promise.all(files.map((f) => bucket.delete(f._id)));
}

export function streamPhotoFromGridFS(fileId: string): NodeJS.ReadableStream {
  const bucket = getPhotoBucket();
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

/**
 * Get the mimeType stored in a photo's metadata.
 */
export async function getPhotoMimeType(fileId: string): Promise<string> {
  const bucket = getPhotoBucket();
  const files = await bucket
    .find({ _id: new mongoose.Types.ObjectId(fileId) })
    .toArray();
  return (files[0]?.metadata?.mimeType as string) ?? "image/jpeg";
}
