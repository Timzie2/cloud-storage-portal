
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Missing required Supabase environment variables.");
    return respond({ error: "Server configuration error." }, 500);
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return respond({ error: "Authentication required." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user?.id) {
    return respond({ error: "Invalid or expired session." }, 401);
  }

  let body: { query?: unknown };

  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  if (typeof body.query !== "string") {
    return respond({ error: "A search query is required." }, 400);
  }

  const query = body.query.trim().toLowerCase();

  if (query.length < 2) {
    return respond({ recipients: [] });
  }

  if (query.length > 254) {
    return respond({ error: "Search query is too long." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Use the existing restricted database function rather than
  // exposing auth.users to the frontend.
  const { data, error } = await adminClient.rpc(
    "search_registered_recipients",
    {
      p_query: query,
      p_exclude_user_id: user.id,
    },
  );

  if (error) {
    console.error("Recipient search failed:", error.message);
    return respond({ error: "Could not search NOVA accounts." }, 500);
  }

  const recipients = (data ?? []).map(
    (recipient: { email: string; display_name: string | null }) => ({
      email: recipient.email,
      display_name: recipient.display_name ?? "",
    }),
  );

  return respond({ recipients });
});
