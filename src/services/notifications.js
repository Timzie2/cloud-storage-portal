import { supabase } from "./supabase";

/**
 * Get the current user's notifications.
 */
export async function getNotifications(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

/**
 * Get the number of unread notifications.
 */
export async function getUnreadNotificationCount(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;

  return count ?? 0;
}

/**
 * Mark one notification as read.
 */
export async function markNotificationAsRead(notificationId) {
  if (!notificationId) {
    throw new Error("Notification ID is required.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsAsRead(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
}

/**
 * Create a notification for the current user.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedFileId = null,
}) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!type || !title || !message) {
    throw new Error(
      "Notification type, title, and message are required."
    );
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      related_file_id: relatedFileId,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}