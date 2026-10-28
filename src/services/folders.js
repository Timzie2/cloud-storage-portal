import { supabase } from "./supabase";
import JSZip from "jszip";

import {
  makeFileCopy,
  getUserFiles,
  copySharedFile,
  getFilesInFolder,
} from "./files";




/**
 * Get all active folders the current user is allowed to access.
 * Supabase RLS determines which owned and shared folders are visible.
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


/**
 * Copy a folder, its nested folders, and all files inside them.
 */
export async function copyFolder(folderId, userId, destinationFolderId = null) {
  if (!folderId || !userId) {
    throw new Error("Folder and user information are required.");
  }

  // Load the user's active folders and files.
  const [folders, files] = await Promise.all([
    getUserFolders(userId),
    getUserFiles(userId),
  ]);

  const sourceFolder = folders.find(
    (folder) => folder.id === folderId
  );

  if (!sourceFolder) {
    throw new Error("The folder could not be found.");
  }

  // Prevent copying a folder into itself or one of its descendants.
  if (destinationFolderId) {
    const descendantIds = new Set([folderId]);
    let foundNewDescendant = true;

    while (foundNewDescendant) {
      foundNewDescendant = false;

      folders.forEach((folder) => {
        if (
          descendantIds.has(folder.parent_id) &&
          !descendantIds.has(folder.id)
        ) {
          descendantIds.add(folder.id);
          foundNewDescendant = true;
        }
      });
    }

    if (descendantIds.has(destinationFolderId)) {
      throw new Error("A folder cannot be copied into itself or its descendants.");
    }
  }

  // Collect the source folder and every nested folder.
  const folderTree = [];
  const pending = [folderId];

  while (pending.length > 0) {
    const currentId = pending.shift();
    const currentFolder = folders.find(
      (folder) => folder.id === currentId
    );

    if (!currentFolder) continue;

    folderTree.push(currentFolder);

    folders.forEach((folder) => {
      if (folder.parent_id === currentId) {
        pending.push(folder.id);
      }
    });
  }

  // Create the copied root folder.
  const copiedRoot = await createFolder(
    userId,
    `${sourceFolder.name} (copy)`,
    destinationFolderId
  );

  const folderIdMap = new Map([
    [folderId, copiedRoot.id],
  ]);

  // Recreate nested folders, preserving their hierarchy.
  for (const originalFolder of folderTree) {
    if (originalFolder.id === folderId) continue;

    const newParentId = folderIdMap.get(
      originalFolder.parent_id
    );

    if (!newParentId) continue;

    const copiedFolder = await createFolder(
      userId,
      originalFolder.name,
      newParentId
    );

    folderIdMap.set(originalFolder.id, copiedFolder.id);
  }

  // Copy files into their corresponding copied folders.
  let copiedFileCount = 0;

  for (const file of files) {
    if (!folderIdMap.has(file.folder_id)) continue;

    await makeFileCopy(
      file,
      userId,
      folderIdMap.get(file.folder_id)
    );

    copiedFileCount += 1;
  }

  return {
    folder: copiedRoot,
    copiedFolderCount: folderIdMap.size,
    copiedFileCount,
  };
}


/**
 * Move a folder to another destination.
 */
export async function moveFolder(folderId, userId, destinationFolderId = null) {
  if (!folderId || !userId) {
    throw new Error("Folder and user information are required.");
  }

  const folders = await getUserFolders(userId);

  const sourceFolder = folders.find(
    (folder) => folder.id === folderId
  );

  if (!sourceFolder) {
    throw new Error("The folder could not be found.");
  }

  if (destinationFolderId === folderId) {
    throw new Error("A folder cannot be moved into itself.");
  }

  if (destinationFolderId) {
    const destination = folders.find(
      (folder) => folder.id === destinationFolderId
    );

    if (!destination) {
      throw new Error("The destination folder could not be found.");
    }

    // Collect all descendants to prevent circular folder structures.
    const descendantIds = new Set([folderId]);
    let changed = true;

    while (changed) {
      changed = false;

      folders.forEach((folder) => {
        if (
          descendantIds.has(folder.parent_id) &&
          !descendantIds.has(folder.id)
        ) {
          descendantIds.add(folder.id);
          changed = true;
        }
      });
    }

    if (descendantIds.has(destinationFolderId)) {
      throw new Error(
        "A folder cannot be moved into itself or one of its subfolders."
      );
    }
  }

  const { data, error } = await supabase
    .from("folders")
    .update({ parent_id: destinationFolderId })
    .eq("id", folderId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;

  return data;
}



export async function shareFolder(
  folder,
  ownerId,
  email,
  permissions = {}
) {
  if (!folder?.id) {
    throw new Error("Folder is required.");
  }

  if (!ownerId) {
    throw new Error("Folder owner is required.");
  }

  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  const { data, error } = await supabase
    .from("folder_shares")
    .insert({
      folder_id: folder.id,
      owner_id: ownerId,
      shared_with_email: normalizedEmail,
      can_edit: permissions.can_edit ?? false,
      can_download: permissions.can_download ?? true,
      can_copy: permissions.can_copy ?? true,
      expires_at: permissions.expires_at ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}


export async function getFolderShares(folderId) {
  if (!folderId) {
    throw new Error("Folder ID is required.");
  }

  const { data, error } = await supabase
    .from("folder_shares")
    .select("*")
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function revokeFolderShare(shareId) {
  if (!shareId) {
    throw new Error("Share ID is required.");
  }

  const { error } = await supabase
    .from("folder_shares")
    .delete()
    .eq("id", shareId);

  if (error) throw error;
}


export async function getFolderSharesByOwner(ownerId) {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const { data, error } = await supabase
    .from("folder_shares")
    .select(`
  id,
  folder_id,
  owner_id,
  shared_with_email,
  created_at,
  expires_at,
  can_edit,
  can_download,
  can_copy,
  folders (
    id,
    name,
    user_id,
    parent_id,
    created_at
  )
`)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getSharedFoldersWithMe(email) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  
const { data, error } = await supabase
  .from("folder_shares")
  .select(`
    id,
    folder_id,
    owner_id,
    shared_with_email,
    created_at,
    expires_at,
    can_edit,
    can_download,
    can_copy,
    folders (
      id,
      name,
      user_id,
      parent_id,
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


export async function getSubfolders(parentFolderId) {
  if (!parentFolderId) {
    throw new Error("Parent folder ID is required.");
  }

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("parent_id", parentFolderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}


/**
 * Copy a shared folder and its contents into the current user's storage.
 */
export async function copySharedFolder(
  sourceFolder,
  userId,
  destinationFolderId = null,
  options = {}
) {
  if (!sourceFolder?.id || !userId) {
    throw new Error("Folder and user information are required.");
  }

    // Verify the signed-in user.
  const {
    data: { user: currentUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!currentUser || currentUser.id !== userId) {
    throw new Error("You must be signed in to copy this folder.");
  }

  const recipientEmail = currentUser.email?.trim().toLowerCase();

  if (!recipientEmail) {
    throw new Error("Your account email could not be verified.");
  }

  // Verify that this folder is shared with the user and copying is allowed.
  
let shareQuery = supabase
  .from("folder_shares")
  .select("id, can_copy, expires_at")
  .eq("folder_id", sourceFolder.id)
  .eq("owner_id", sourceFolder.user_id)
  .ilike("shared_with_email", recipientEmail);

if (options.shareId) {
  shareQuery = shareQuery.eq("id", options.shareId);
}

const { data: share, error: shareError } =
  await shareQuery.maybeSingle();


  if (shareError) throw shareError;

  if (!share) {
    throw new Error("You do not have permission to copy this shared folder.");
  }

  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
  throw new Error(
    "This folder share has expired. Ask the owner to share the folder again."
  );
}

  if (!share.can_copy) {
    throw new Error("The owner has disabled copying for this folder.");
  }

  const copiedRoot = await createFolder(
    userId,
    `${sourceFolder.name} (copy)`,
    destinationFolderId
  );

  let copiedFileCount = 0;
  let copiedFolderCount = 1;

  async function copyContents(sourceFolderId, targetFolderId) {
    const [subfolders, files] = await Promise.all([
      getSubfolders(sourceFolderId),
      getFilesInFolder(sourceFolderId),
    ]);

    for (const file of files) {
      if (file.user_id === userId) {
        await makeFileCopy(file, userId, targetFolderId);
      } else {
        await copySharedFile(file, userId, targetFolderId, {
  folderShareId: share.id,
});
      }

      copiedFileCount += 1;
    }

    for (const subfolder of subfolders) {
      const copiedSubfolder = await createFolder(
        userId,
        subfolder.name,
        targetFolderId
      );

      copiedFolderCount += 1;

      await copyContents(subfolder.id, copiedSubfolder.id);
    }
  }

  await copyContents(sourceFolder.id, copiedRoot.id);

  return {
    folder: copiedRoot,
    copiedFolderCount,
    copiedFileCount,
  };
}



export async function downloadSharedFolderAsZip(sourceFolder) {
  if (!sourceFolder?.id || !sourceFolder?.user_id) {
    throw new Error("Folder information is required.");
  }

  const {
    data: { user: currentUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!currentUser) {
    throw new Error("You must be signed in to download this folder.");
  }

  const recipientEmail = currentUser.email?.trim().toLowerCase();

  if (!recipientEmail) {
    throw new Error("Your account email could not be verified.");
  }

  let shareQuery = supabase
    .from("folder_shares")
    .select("id, can_download, expires_at")
    .eq("folder_id", sourceFolder.id)
    .eq("owner_id", sourceFolder.user_id)
    .ilike("shared_with_email", recipientEmail);

  if (sourceFolder.share_id) {
    shareQuery = shareQuery.eq("id", sourceFolder.share_id);
  }

  const { data: share, error: shareError } =
    await shareQuery.maybeSingle();

  if (shareError) throw shareError;

  if (!share) {
    throw new Error("You do not have permission to download this folder.");
  }

  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
  throw new Error(
    "This folder share has expired. Ask the owner to share the folder again."
  );
}

  if (!share.can_download) {
    throw new Error("The owner has disabled downloading for this folder.");
  }

  const zip = new JSZip();

  async function addFolderContents(folderId, zipFolder) {
    const [subfolders, files] = await Promise.all([
      getSubfolders(folderId),
      getFilesInFolder(folderId),
    ]);

    for (const file of files) {
      if (!file.storage_path) continue;

      const { data: blob, error: downloadError } =
        await supabase.storage
          .from("user-files")
          .download(file.storage_path);

      if (downloadError) throw downloadError;

      zipFolder.file(file.name, blob);
    }

    for (const subfolder of subfolders) {
      const nestedZipFolder = zipFolder.folder(subfolder.name);
      await addFolderContents(subfolder.id, nestedZipFolder);
    }
  }

  await addFolderContents(sourceFolder.id, zip.folder(sourceFolder.name));

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = `${sourceFolder.name}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}
