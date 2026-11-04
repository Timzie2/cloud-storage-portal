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

export async function updateOriginalDocx(fileId, updatedBlob) {
  if (!fileId || !(updatedBlob instanceof Blob)) {
    throw new Error("A valid file ID and updated DOCX are required.");
  }

  // Confirm the signed-in user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!user) {
    throw new Error("Please sign in to update this document.");
  }

  // Retrieve the original file, ensuring it belongs to this user.
  const { data: file, error: fileError } = await supabase
    .from("files")
    .select("id, user_id, name, storage_path, mime_type, size_bytes")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (fileError) throw fileError;

  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Only DOCX files can be updated this way.");
  }

  const contentType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Download the existing original.
  const { data: originalBlob, error: downloadError } =
    await supabase.storage
      .from(BUCKET_NAME)
      .download(file.storage_path);

  if (downloadError) throw downloadError;

  // Create a unique backup path.
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const backupPath =
    `${user.id}/backups/${file.id}/${timestamp}-${file.name}`;

  // Upload the backup before touching the original.
  const { error: backupError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(backupPath, originalBlob, {
      contentType: file.mime_type || contentType,
      upsert: false,
    });

  if (backupError) {
    throw new Error(
      `Original document was not changed because its backup failed: ${backupError.message}`
    );
  }

    // Register the backup so it appears in NOVA Docs Version History.
  const { error: versionError } = await supabase
    .from("document_versions")
    .insert({
      file_id: file.id,
      owner_id: user.id,
      storage_path: backupPath,
      file_name: file.name,
      mime_type: file.mime_type || contentType,
      size_bytes: originalBlob.size,
    });

  if (versionError) {
    // Do not replace the original if its backup cannot be registered.
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([backupPath]);

    throw new Error(
      `Original document was not changed because its backup could not be registered: ${versionError.message}`
    );
  }

  // Replace the original at its existing storage path.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(file.storage_path, updatedBlob, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `The original was not updated. Its backup is available at ${backupPath}. ${uploadError.message}`
    );
  }

  // Update the existing database record.
  const { error: updateError } = await supabase
    .from("files")
    .update({
      size_bytes: updatedBlob.size,
      mime_type: contentType,
    })
    .eq("id", file.id)
    .eq("user_id", user.id);

  if (updateError) {
    // Attempt to restore the original if the database update fails.
    const { error: restoreError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(file.storage_path, originalBlob, {
        contentType: file.mime_type || contentType,
        upsert: true,
      });

    if (restoreError) {
      throw new Error(
        `Database update failed and automatic restoration failed. Your backup is available at ${backupPath}.`
      );
    }

    throw updateError;
  }

  return {
    success: true,
    backupPath,
    fileId: file.id,
    sizeBytes: updatedBlob.size,
  };
}


export async function getDocxVersions(fileId) {
  if (!fileId) {
    throw new Error("File ID is required.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Please sign in.");

  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("file_id", fileId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function downloadDocxVersion(versionId) {
  if (!versionId) {
    throw new Error("Version ID is required.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Please sign in.");

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .eq("owner_id", user.id)
    .single();

  if (versionError) throw versionError;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(version.storage_path);

  if (downloadError) throw downloadError;

  return { version, blob };
}

export async function restoreDocxVersion(fileId, versionId) {
  if (!fileId || !versionId) {
    throw new Error("File ID and version ID are required.");
  }

  const { version, blob } = await downloadDocxVersion(versionId);

  if (version.file_id !== fileId) {
    throw new Error("This version does not belong to the selected document.");
  }

  // This backs up the current original before restoring the selected version.
  return await updateOriginalDocx(fileId, blob);
}

export async function deleteDocxVersion(versionId) {
  if (!versionId) {
    throw new Error("Version ID is required.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Please sign in.");

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .eq("owner_id", user.id)
    .single();

  if (versionError) throw versionError;

  // Remove the actual backup first.
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([version.storage_path]);

  if (storageError) throw storageError;

  // Only remove the database record after Storage deletion succeeds.
  const { error: deleteError } = await supabase
    .from("document_versions")
    .delete()
    .eq("id", versionId)
    .eq("owner_id", user.id);

  if (deleteError) {
    throw new Error(
      "The backup file was deleted, but its history record could not be removed. Refresh and check the history."
    );
  }

  return { success: true };
}

export async function clearDocxVersionHistory(fileId) {
  if (!fileId) {
    throw new Error("File ID is required.");
  }

  const versions = await getDocxVersions(fileId);

  // Delete each backup and its record individually.
  // If Storage deletion fails, its record remains in the history.
  for (const version of versions) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([version.storage_path]);

    if (storageError) {
      throw new Error(
        `Could not delete ${version.file_name}. Remaining history has been preserved. ${storageError.message}`
      );
    }

    const { error: deleteError } = await supabase
      .from("document_versions")
      .delete()
      .eq("id", version.id)
      .eq("owner_id", version.owner_id);

    if (deleteError) {
      throw new Error(
        "A backup was deleted, but its history record could not be removed. Please refresh and check the history."
      );
    }
  }

  return { success: true, deletedCount: versions.length };
}


const documentDocxSaveQueues = new Map();

export async function saveDocumentDocxOutput(
  documentId,
  userId,
  updatedBlob,
  documentTitle
) {
  if (!documentId || !userId || !(updatedBlob instanceof Blob)) {
    throw new Error("Document, user, and valid DOCX file are required.");
  }

  const previousSave =
    documentDocxSaveQueues.get(documentId) || Promise.resolve();

  const currentSave = previousSave
    .catch(() => {})
    .then(async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user || user.id !== userId) {
        throw new Error("You must be signed in to save this document.");
      }

      // Retrieve the document and its existing output file ID.
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("id, owner_id, title, output_file_id")
        .eq("id", documentId)
        .eq("owner_id", userId)
        .single();

      if (documentError) throw documentError;

      const contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      // Ensure the output filename has a .docx extension.
      const safeTitle = (documentTitle || document.title || "Untitled document")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-");

      const fileName = safeTitle.toLowerCase().endsWith(".docx")
        ? safeTitle
        : `${safeTitle}.docx`;

      // If an output file already exists, update that file.
      if (document.output_file_id) {
        const { data: existingFile, error: existingFileError } =
          await supabase
            .from("files")
            .select("id, user_id, name, storage_path, mime_type")
            .eq("id", document.output_file_id)
            .eq("user_id", userId)
            .is("deleted_at", null)
            .maybeSingle();

        if (existingFileError) throw existingFileError;

        if (existingFile) {
          if (!existingFile.name.toLowerCase().endsWith(".docx")) {
            throw new Error("The linked output file is not a DOCX file.");
          }

          // Keep a copy of the current output in case the update fails.
          const { data: previousBlob, error: downloadError } =
            await supabase.storage
              .from(BUCKET_NAME)
              .download(existingFile.storage_path);

          if (downloadError) throw downloadError;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(existingFile.storage_path, updatedBlob, {
              contentType,
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: updatedFile, error: updateError } = await supabase
            .from("files")
            .update({
              name: fileName,
              mime_type: contentType,
              size_bytes: updatedBlob.size,
            })
            .eq("id", existingFile.id)
            .eq("user_id", userId)
            .select()
            .single();

          if (updateError) {
            // Restore the previous DOCX if its metadata update fails.
            const { error: restoreError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(existingFile.storage_path, previousBlob, {
                contentType: existingFile.mime_type || contentType,
                upsert: true,
              });

            if (restoreError) {
              throw new Error(
                "The output file update failed and automatic restoration failed."
              );
            }

            throw updateError;
          }

          return updatedFile;
        }
      }

      // No existing output file: check storage quota before creating one.
      const { getStorageQuota } = await import("./storageQuota");
      const quota = await getStorageQuota(userId);

      if (
        quota.isFull ||
        updatedBlob.size > quota.storageLimit - quota.storageUsed
      ) {
        throw new Error("Not enough storage space to save this DOCX file.");
      }

      const newFileId = crypto.randomUUID();
      const newStoragePath = `${userId}/${newFileId}-${fileName}`;

      // Upload the new DOCX.
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(newStoragePath, updatedBlob, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      try {
        // Register the new file in My Files.
        const { data: newFile, error: insertError } = await supabase
          .from("files")
          .insert({
            user_id: userId,
            name: fileName,
            storage_path: newStoragePath,
            mime_type: contentType,
            size_bytes: updatedBlob.size,
            folder_id: null,
            is_favorite: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Link this output file to the NOVA document.
        const { data: linkedDocument, error: linkError } = await supabase
          .from("documents")
          .update({
            output_file_id: newFile.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId)
          .eq("owner_id", userId)
          .select("id")
          .maybeSingle();

        if (linkError) throw linkError;

        if (!linkedDocument) {
          throw new Error("Could not link the DOCX file to this document.");
        }

        return newFile;
      } catch (error) {
        // Clean up if registering or linking the new file fails.
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([newStoragePath]);

        if (deleteError) {
          console.error("Could not clean up the new DOCX upload:", deleteError);
        }

        throw error;
      }
    });

  documentDocxSaveQueues.set(documentId, currentSave);

  try {
    return await currentSave;
  } finally {
    if (documentDocxSaveQueues.get(documentId) === currentSave) {
      documentDocxSaveQueues.delete(documentId);
    }
  }
}
