
import { supabase } from "./supabase";

const BUCKET_NAME = "user-files";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SIGNED_URL_DURATION = 60 * 60; // 1 hour

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function uploadDocumentImage(file, userId, documentId) {
  if (!file || !userId || !documentId) {
    throw new Error("Image, user and document are required.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image must not exceed 5MB.");
  }

  const extension = MIME_EXTENSIONS[file.type];

  if (!extension) {
    throw new Error("This image format is not supported.");
  }

  const imageId = crypto.randomUUID();

  const storagePath =
    `${userId}/documents/${documentId}/images/${imageId}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  return storagePath;
}

export async function getDocumentImageUrl(storagePath) {
  if (!storagePath) {
    throw new Error("Image storage path is required.");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_DURATION);

  if (error) throw error;

  return data.signedUrl;
}

export async function deleteDocumentImage(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) throw error;
}
