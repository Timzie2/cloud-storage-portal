import { supabase } from "./supabase";

/**
 * Get all folders belonging to the current user.
 */
export async function getUserFolders(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

/**
 * Create a new folder.
 */
export async function createFolder(userId, name, parentId = null) {
  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Rename a folder.
 */
export async function renameFolder(folderId, name) {
  if (!folderId) {
    throw new Error("Folder ID is required.");
  }

  const trimmedName = name?.trim();

  if (!trimmedName) {
    throw new Error("Folder name is required.");
  }

  const { data, error } = await supabase
    .from("folders")
    .update({
      name: trimmedName,
    })
    .eq("id", folderId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Delete a folder.
 *
 * Files inside the folder are not deleted because
 * folder_id uses ON DELETE SET NULL.
 */
export async function deleteFolder(folderId) {
  if (!folderId) {
    throw new Error("Folder ID is required.");
  }

  const { data: folders, error: fetchError } = await supabase
    .from("folders")
    .select("id, parent_id")
    .is("deleted_at", null);

  if (fetchError) throw fetchError;

  const idsToDelete = [folderId];
  const pendingIds = [folderId];

  while (pendingIds.length > 0) {
    const parentId = pendingIds.shift();

    const children = (folders ?? []).filter(
      (folder) => folder.parent_id === parentId
    );

    children.forEach((child) => {
      if (!idsToDelete.includes(child.id)) {
        idsToDelete.push(child.id);
        pendingIds.push(child.id);
      }
    });
  }

  const { data, error } = await supabase
    .from("folders")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .in("id", idsToDelete)
    .select();

  if (error) throw error;

  return data ?? [];
}

/**
 * Get top-level deleted folders belonging to the current user.
 */
export async function getTrashedFolders(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;

  const deletedFolders = data ?? [];

  const deletedFolderIds = new Set(
    deletedFolders.map((folder) => folder.id)
  );

  return deletedFolders.filter(
    (folder) => !deletedFolderIds.has(folder.parent_id)
  );
}

/**
 * Restore a deleted folder and its entire folder tree.
 */
export async function restoreFolder(folderId) {
  if (!folderId) {
    throw new Error("Folder ID is required.");
  }

  const { data: folders, error: fetchError } = await supabase
    .from("folders")
    .select("id, parent_id, deleted_at");

  if (fetchError) throw fetchError;

  const idsToRestore = [folderId];
  const pendingIds = [folderId];

  while (pendingIds.length > 0) {
    const parentId = pendingIds.shift();

    const children = (folders ?? []).filter(
      (folder) =>
        folder.parent_id === parentId &&
        folder.deleted_at !== null
    );

    children.forEach((child) => {
      if (!idsToRestore.includes(child.id)) {
        idsToRestore.push(child.id);
        pendingIds.push(child.id);
      }
    });
  }

  const { data, error } = await supabase
    .from("folders")
    .update({
      deleted_at: null,
    })
    .in("id", idsToRestore)
    .select();

  if (error) throw error;

  return data ?? [];
}

/**
 * Permanently delete a folder and its entire folder tree.
 */
export async function permanentlyDeleteFolder(folderId) {
  if (!folderId) {
    throw new Error("Folder ID is required.");
  }

  const { data: folders, error: fetchError } = await supabase
    .from("folders")
    .select("id, parent_id");

  if (fetchError) throw fetchError;

  const idsToDelete = [folderId];
  const pendingIds = [folderId];

  while (pendingIds.length > 0) {
    const parentId = pendingIds.shift();

    const children = (folders ?? []).filter(
      (folder) => folder.parent_id === parentId
    );

    children.forEach((child) => {
      if (!idsToDelete.includes(child.id)) {
        idsToDelete.push(child.id);
        pendingIds.push(child.id);
      }
    });
  }

  const { error } = await supabase
    .from("folders")
    .delete()
    .in("id", idsToDelete);

  if (error) throw error;
}