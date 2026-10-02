import { supabase } from "./supabase";

export async function getStorageQuota(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("storage_limit_bytes")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("size_bytes")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (filesError) throw filesError;

  const storageUsed = (files ?? []).reduce(
    (total, file) => total + Number(file.size_bytes || 0),
    0
  );

  const storageLimit = Number(
    profile.storage_limit_bytes || 0
  );

  const usagePercentage =
    storageLimit > 0
      ? (storageUsed / storageLimit) * 100
      : 0;

  return {
    storageUsed,
    storageLimit,
    usagePercentage,
    isWarning: usagePercentage >= 80,
    isFull: storageUsed >= storageLimit,
  };
}