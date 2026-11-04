
import { supabase } from "./supabase";

// Create a new document.
export async function createDocument(
  userId,
  title = "Untitled document",
  sourceFileId = null
) {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      owner_id: userId,
      title,
      source_file_id: sourceFileId,
      content: {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Get one document by its ID.
export async function getDocument(documentId) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error) throw error;
  return data;
}

// Keep saves for each document in sequence.
const documentSaveQueues = new Map();

// Save document content and title.
export async function saveDocument(documentId, title, content) {
  const previousSave =
    documentSaveQueues.get(documentId) || Promise.resolve();

  const currentSave = previousSave
    .catch(() => {
      // Allow the next save to proceed even if the previous one failed.
    })
    .then(async () => {
      const { data, error } = await supabase
        .from("documents")
        .update({
          title,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    });

  documentSaveQueues.set(documentId, currentSave);

  try {
    return await currentSave;
  } finally {
    if (documentSaveQueues.get(documentId) === currentSave) {
      documentSaveQueues.delete(documentId);
    }
  }
}


// List documents owned by a user.
export async function getUserDocuments(userId) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Delete a document.
export async function deleteDocument(documentId) {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
}
