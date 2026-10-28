import { supabase } from "./supabase";
const BUCKET_NAME = "user-files";
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


export async function downloadFile(
  storagePath,
  fileName = null,
  options = {}
) {
  if (!storagePath) {
    throw new Error("Storage path is required.");
  }

  const {
    shareId = null,
    folderShareId = null,
  } = options;

  // If this is a shared file, verify the share is still active.
  if (shareId || folderShareId) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user?.email) {
      throw new Error("Please sign in to download this file.");
    }

    const now = new Date().toISOString();
    const recipientEmail = user.email.trim().toLowerCase();

    if (shareId) {
      const { data: share, error } = await supabase
        .from("file_shares")
        .select("id, expires_at, can_download, shared_with_email")
        .eq("id", shareId)
        .ilike("shared_with_email", recipientEmail)
        .maybeSingle();

      if (error) throw error;

      if (
        !share ||
        (share.expires_at && new Date(share.expires_at) <= new Date(now))
      ) {
        throw new Error(
          "This share has expired or been revoked. Ask the owner to share the file again."
        );
      }

      if (!share.can_download) {
        throw new Error("The owner has disabled downloads for this file.");
      }
    }

    if (folderShareId) {
      const { data: share, error } = await supabase
        .from("folder_shares")
        .select("id, expires_at, can_download, shared_with_email")
        .eq("id", folderShareId)
        .ilike("shared_with_email", recipientEmail)
        .maybeSingle();

      if (error) throw error;

      if (
        !share ||
        (share.expires_at && new Date(share.expires_at) <= new Date(now))
      ) {
        throw new Error(
          "This folder share has expired or been revoked. Ask the owner to share it again."
        );
      }

      if (!share.can_download) {
        throw new Error("The owner has disabled downloads for this folder.");
      }
    }
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    throw new Error(
      "The file could not be downloaded. Its share may have expired or access may have been revoked."
    );
  }

  const blobUrl = URL.createObjectURL(data);
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download =
    fileName ||
    storagePath.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") ||
    "download";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);
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


export async function getPreviousFileRecipients(ownerId) {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const { data, error } = await supabase
    .from("file_recipient_history")
    .select("id, recipient_email, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function saveFileRecipient(ownerId, email) {
  if (!ownerId || !email?.trim()) {
    throw new Error("Owner ID and recipient email are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("file_recipient_history")
    .upsert(
      {
        owner_id: ownerId,
        recipient_email: normalizedEmail,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: "owner_id,recipient_email",
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function removeFileRecipientSuggestion(ownerId, email) {
  if (!ownerId || !email?.trim()) {
    throw new Error("Owner ID and recipient email are required.");
  }

  const { error } = await supabase
    .from("file_recipient_history")
    .delete()
    .eq("owner_id", ownerId)
    .eq("recipient_email", email.trim().toLowerCase());

  if (error) throw error;
}

export async function clearFileRecipientHistory(ownerId) {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const { error } = await supabase
    .from("file_recipient_history")
    .delete()
    .eq("owner_id", ownerId);

  if (error) throw error;
}


export async function checkRecipientAccount(email) {
  if (!email?.trim()) {
    throw new Error("Email address is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.functions.invoke(
    "check-recipient-account",
    {
      body: { email: normalizedEmail },
    }
  );

  if (error) {
    throw new Error("Could not verify this recipient. Please try again.");
  }

  if (!data || typeof data.registered !== "boolean") {
    throw new Error("The recipient verification response was invalid.");
  }

  return data;
}

export async function shareFile(
  file,
  ownerId,
  email,
  permissions = {}
) {
  if (!file?.id || !ownerId || !email) {
    throw new Error("File, owner, and email are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check NOVA registration before creating the share.
  const recipient = await checkRecipientAccount(normalizedEmail);

  if (!recipient.registered) {
    throw new Error(
      "This email is not registered with NOVA. Invite them to join before sharing."
    );
  }

  const { data, error } = await supabase
    .from("file_shares")
    .insert({
      file_id: file.id,
      owner_id: ownerId,
      shared_with_email: normalizedEmail,
      can_edit: permissions.can_edit ?? false,
      can_download: permissions.can_download ?? true,
      can_copy: permissions.can_copy ?? true,
      expires_at: permissions.expires_at ?? null,
    })
    .select()
    .single();


  if (error) {
    throw error;
  }

  // Save the recipient for future suggestions.
  try {
    await saveFileRecipient(ownerId, normalizedEmail);
  } catch (historyError) {
    // A history failure should not undo a successful file share.
    console.error(
      "Could not save recipient history:",
      historyError
    );
  }

  return data;
}


export async function searchRecipientAccounts(query) {
  const normalizedQuery = query?.trim().toLowerCase() ?? "";

  // Avoid searching on very short input.
  if (normalizedQuery.length < 2) return [];

  const { data, error } = await supabase.functions.invoke(
    "search-recipient-accounts",
    {
      body: { query: normalizedQuery },
    }
  );

  if (error) {
    throw new Error("Could not search NOVA accounts.");
  }

  if (!Array.isArray(data?.recipients)) {
    throw new Error("The recipient search response was invalid.");
  }

  return data.recipients;
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
  can_edit,
  can_download,
  can_copy,
  expires_at,
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
      expires_at,
      can_edit,
      can_download,
      can_copy,
      files (
        id,
        user_id,
        name,
        storage_path,
        mime_type,
        size_bytes,
        folder_id,
        created_at
      )
    `)
    .eq("shared_with_email", normalizedEmail)
    .order("created_at", { ascending: false });

if (error) throw error;

const now = Date.now();
const gracePeriod = 24 * 60 * 60 * 1000;

return (data ?? []).filter((share) => {
  if (!share.expires_at) return true;

  const expiresAt = new Date(share.expires_at).getTime();

  return now < expiresAt + gracePeriod;
});
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


export async function toggleFavorite(fileId, isFavorite) {
  if (!fileId) {
    throw new Error("File ID is required.");
  }

  const { data, error } = await supabase
    .from("files")
    .update({ is_favorite: isFavorite })
    .eq("id", fileId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getFavoriteFiles(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .eq("is_favorite", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}


export async function makeFileCopy(file, userId, destinationFolderId = null) {
  if (!file?.id || !file?.storage_path || !userId) {
    throw new Error("File and user information are required.");
  }

  if (file.user_id !== userId) {
    throw new Error("You can only copy your own files.");
  }

  // Check available storage before copying.
  const { getStorageQuota } = await import("./storageQuota");
  const quota = await getStorageQuota(userId);
  const fileSize = Number(file.size_bytes) || 0;

  if (quota.isFull || fileSize > quota.storageLimit - quota.storageUsed) {
    throw new Error("Not enough storage space to copy this file.");
  }

  // Generate a unique name while preserving the extension.
  const lastDot = file.name.lastIndexOf(".");
  const hasExtension = lastDot > 0;
  const baseName = hasExtension
    ? file.name.slice(0, lastDot)
    : file.name;
  const extension = hasExtension
    ? file.name.slice(lastDot)
    : "";

  const copyName = `${baseName} (copy)${extension}`;
  const newId = crypto.randomUUID();
  const newStoragePath = `${userId}/${newId}-${copyName}`;

  // Duplicate the actual file inside Supabase Storage.
  const { error: copyError } = await supabase.storage
    .from(BUCKET_NAME)
    .copy(file.storage_path, newStoragePath);

  if (copyError) throw copyError;

  try {
    // Register the duplicate as a separate file.
    const { data, error } = await supabase
      .from("files")
      .insert({
        user_id: userId,
        name: copyName,
        storage_path: newStoragePath,
        mime_type: file.mime_type,
        size_bytes: fileSize,
        folder_id: destinationFolderId ?? null,
        is_favorite: false,
      })
      .select()
      .single();

    if (error) throw error;

    try {
      await createNotification({
        userId,
        type: "file_copied",
        title: "File copied",
        message: `"${file.name}" was copied as "${copyName}".`,
        relatedFileId: data.id,
      });
    } catch (notificationError) {
      console.error("Could not create copy notification:", notificationError);
    }

    return data;
  } catch (error) {
    // Remove the Storage copy if the database insert fails.
    const { error: cleanupError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([newStoragePath]);

    if (cleanupError) {
      console.error("Could not clean up failed file copy:", cleanupError);
    }

    throw error;
  }
}



export async function copySharedFile(
  file,
  userId,
  destinationFolderId = null,
  options = {}
) {
  if (!file?.id || !file?.storage_path || !userId) {
    throw new Error("File and user information are required.");
  }

  if (file.user_id === userId) {
    throw new Error("Use makeFileCopy for files you own.");
  }

  // Verify that this user has an active share allowing copies.
  const { data: { user: currentUser }, error: authError } =
  await supabase.auth.getUser();

if (authError) throw authError;

if (!currentUser || currentUser.id !== userId) {
  throw new Error("You must be signed in to copy this file.");
}

const recipientEmail = currentUser.email?.trim().toLowerCase();

if (!recipientEmail) {
  throw new Error("Your account email could not be verified.");
}

let canCopy = false;


if (options.folderShareId) {
  // Find the share even if it has expired, so we can show the right message.
  const { data: folderShare, error: folderShareError } = await supabase
    .from("folder_shares")
    .select("id, can_copy, expires_at")
    .eq("id", options.folderShareId)
    .ilike("shared_with_email", recipientEmail)
    .maybeSingle();

  if (folderShareError) throw folderShareError;

  if (!folderShare) {
    throw new Error(
      "You do not have permission to copy this shared folder."
    );
  }

  if (
    folderShare.expires_at &&
    new Date(folderShare.expires_at) <= new Date()
  ) {
    throw new Error(
      "This folder share has expired. Ask the owner to share the folder again."
    );
  }

  canCopy = folderShare.can_copy;
}

else {
  // Find the individual share even if it has expired.
  let shareQuery = supabase
    .from("file_shares")
    .select("id, can_copy, expires_at")
    .eq("file_id", file.id)
    .eq("owner_id", file.user_id)
    .ilike("shared_with_email", recipientEmail);

  if (options.shareId) {
    shareQuery = shareQuery.eq("id", options.shareId);
  }

  const { data: share, error: shareError } =
    await shareQuery.maybeSingle();

  if (shareError) throw shareError;

  if (!share) {
    throw new Error(
      "You do not have permission to copy this shared file."
    );
  }

  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
    throw new Error(
      "This share has expired. Ask the owner to share the file again."
    );
  }

  canCopy = share.can_copy;
}


if (!canCopy) {
  throw new Error("The owner has disabled copying.");
}

  // Check available storage before copying.
  const { getStorageQuota } = await import("./storageQuota");
  const quota = await getStorageQuota(userId);
  const fileSize = Number(file.size_bytes) || 0;

  if (
    quota.isFull ||
    fileSize > quota.storageLimit - quota.storageUsed
  ) {
    throw new Error("Not enough storage space to copy this file.");
  }

  // Preserve the file extension.
  const lastDot = file.name.lastIndexOf(".");
  const hasExtension = lastDot > 0;
  const baseName = hasExtension
    ? file.name.slice(0, lastDot)
    : file.name;
  const extension = hasExtension
    ? file.name.slice(lastDot)
    : "";

  const copyName = `${baseName} (copy)${extension}`;
  const newId = crypto.randomUUID();
  const newStoragePath = `${userId}/${newId}-${copyName}`;

  // Download through the current user's permitted access.
  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(file.storage_path);

  if (downloadError) throw downloadError;

  // Upload an independent copy to the recipient's storage.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(newStoragePath, blob, {
      contentType: file.mime_type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  try {
    const { data, error } = await supabase
      .from("files")
      .insert({
        user_id: userId,
        name: copyName,
        storage_path: newStoragePath,
        mime_type: file.mime_type,
        size_bytes: fileSize,
        folder_id: destinationFolderId ?? null,
        is_favorite: false,
      })
      .select()
      .single();

    if (error) throw error;

    try {
      await createNotification({
        userId,
        type: "file_copied",
        title: "File copied",
        message: `"${file.name}" was copied as "${copyName}".`,
        relatedFileId: data.id,
      });
    } catch (notificationError) {
      console.error(
        "Could not create copy notification:",
        notificationError
      );
    }

    return data;
  } catch (error) {
    // Remove the uploaded copy if the database insert fails.
    const { error: cleanupError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([newStoragePath]);

    if (cleanupError) {
      console.error("Could not clean up failed file copy:", cleanupError);
    }

    throw error;
  }
}


export async function getFilesInFolder(folderId) {
  if (!folderId) {
    throw new Error("Folder ID is required.");
  }

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("folder_id", folderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

const now = Date.now();

return (data ?? []).filter(
  (share) =>
    !share.expires_at ||
    new Date(share.expires_at).getTime() > now
);
}

