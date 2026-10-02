import { supabase } from "./supabase";
import { createNotification } from "./notifications";

export async function getUserFiles(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
  .from("files")
  .select("*")
  .eq("user_id", userId)
  .is("deleted_at", null)
  .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function downloadFile(storagePath) {
  if (!storagePath) {
    throw new Error("Storage path is required.");
  }

  const { data, error } = await supabase.storage
    .from("user-files")
    .createSignedUrl(storagePath, 60);

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error("Could not generate download URL.");
  }

  window.open(data.signedUrl, "_blank");
}

export async function getPreviewUrl(storagePath) {
  if (!storagePath) {
    throw new Error("Storage path is required.");
  }

  const { data, error } = await supabase.storage
    .from("user-files")
    .createSignedUrl(storagePath, 300);

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error("Could not generate preview URL.");
  }

  return data.signedUrl;
}

export async function deleteFile(file) {
  if (!file?.id || !file?.user_id) {
    throw new Error("File information is required.");
  }

  const { error } = await supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", file.id);

  if (error) throw error;

  try {
    await createNotification({
      userId: file.user_id,
      type: "file_deleted",
      title: "File moved to Trash",
      message: `"${file.name}" was moved to Trash.`,
      relatedFileId: file.id,
    });
  } catch (notificationError) {
    console.error(
      "Could not create delete notification:",
      notificationError
    );
  }
}

export async function getTrashedFiles(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function restoreFile(file) {
  if (!file?.id || !file?.user_id) {
    throw new Error("File information is required.");
  }

  const { error } = await supabase
    .from("files")
    .update({ deleted_at: null })
    .eq("id", file.id);

  if (error) throw error;

  try {
    await createNotification({
      userId: file.user_id,
      type: "file_restored",
      title: "File restored",
      message: `"${file.name}" was restored from Trash.`,
      relatedFileId: file.id,
    });
  } catch (notificationError) {
    console.error(
      "Could not create restore notification:",
      notificationError
    );
  }
}

export async function permanentlyDeleteFile(file) {
  if (!file?.id || !file?.storage_path || !file?.user_id) {
    throw new Error("File information is required.");
  }

  const { error: storageError } = await supabase.storage
    .from("user-files")
    .remove([file.storage_path]);

  if (storageError) throw storageError;

  const { error: databaseError } = await supabase
    .from("files")
    .delete()
    .eq("id", file.id);

  if (databaseError) throw databaseError;

  try {
    await createNotification({
      userId: file.user_id,
      type: "file_permanently_deleted",
      title: "File permanently deleted",
      message: `"${file.name}" was permanently deleted.`,
      relatedFileId: null,
    });
  } catch (notificationError) {
    console.error(
      "Could not create permanent delete notification:",
      notificationError
    );
  }
}

export async function shareFile(file, ownerId, email) {
  if (!file?.id || !ownerId || !email) {
    throw new Error("File, owner, and email are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("file_shares")
    .insert({
      file_id: file.id,
      owner_id: ownerId,
      shared_with_email: normalizedEmail,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getFileShares(ownerId) {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const { data, error } = await supabase
    .from("file_shares")
    .select(`
      id,
      file_id,
      owner_id,
      shared_with_email,
      created_at,
      files (
        id,
        name,
        mime_type,
        size_bytes,
        storage_path
      )
    `)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function revokeShare(shareId) {
  if (!shareId) {
    throw new Error("Share ID is required.");
  }

  const { error } = await supabase
    .from("file_shares")
    .delete()
    .eq("id", shareId);

  if (error) {
    throw error;
  }
}

export async function getSharedWithMe(email) {
  if (!email) throw new Error("Email is required.");

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("file_shares")
    .select(`
      id,
      file_id,
      owner_id,
      shared_with_email,
      created_at,
      files (
        id,
        name,
        mime_type,
        size_bytes,
        storage_path,
        created_at
      )
    `)
    .eq("shared_with_email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getSharedFileCount(ownerId) {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const { count, error } = await supabase
    .from("file_shares")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  if (error) throw error;

  return count ?? 0;
}

export async function moveFile(fileId, folderId) {
  const { data, error } = await supabase
    .from("files")
    .update({
      folder_id: folderId,
    })
    .eq("id", fileId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}