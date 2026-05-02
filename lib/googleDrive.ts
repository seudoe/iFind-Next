/**
 * Google Drive helper using a Service Account.
 * The service account email must have Editor access to the target folder.
 */

import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be set in .env.local"
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

export interface UploadResult {
  fileId: string;
  viewLink: string;
  downloadLink: string;
}

/**
 * Upload a PDF buffer to the configured Drive folder.
 * Returns the file ID and a shareable view link.
 */
export async function uploadResumeToDrive(
  buffer: Buffer,
  fileName: string
): Promise<UploadResult> {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID must be set in .env.local");
  }

  // Convert Buffer to Readable stream for the Drive API
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/pdf",
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: stream,
    },
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = response.data.id!;
  const viewLink = response.data.webViewLink!;

  // Make the file publicly readable so the iframe preview works
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  // Use the embed URL for iframe preview (works without login)
  const embedLink = `https://drive.google.com/file/d/${fileId}/preview`;

  return {
    fileId,
    viewLink: embedLink,
    downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
  };
}

/**
 * Delete a file from Drive by its ID.
 */
export async function deleteResumeFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}
