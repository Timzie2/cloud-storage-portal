import { supabase } from "./supabase";

const BUCKET_NAME = "user-files";

export async function uploadFile(file, userId, folderId = null) {
  if (!file || !userId) {
    throw new Error("File and user are required.");
  }

  const fileId = crypto.randomUUID();

  const safeFileName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );

  const storagePath = `${userId}/${fileId}-${safeFileName}`;

  // Upload the actual file
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType:
        file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Save file information in the database
  const { data, error: databaseError } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      folder_id: folderId,
    })
    .select()
    .single();

  // If database insertion fails, remove the uploaded file
  if (databaseError) {
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    throw databaseError;
  }

  return data;
}