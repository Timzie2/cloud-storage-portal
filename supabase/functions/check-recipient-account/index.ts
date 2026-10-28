
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: object, status = 200) {
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

  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return respond({ error: "Please sign in first." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("Required Supabase environment variables are missing.");
    return respond({ error: "Server configuration error." }, 500);
  }

  try {
    const token = authHeader.slice("Bearer ".length);

    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await userClient.auth.getUser(token);

    if (authError || !authData.user) {
      return respond({ error: "Your session is invalid or expired." }, 401);
    }

    const body = await req.json();
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return respond({ error: "Enter a valid email address." }, 400);
    }

    if (email === authData.user.email?.toLowerCase()) {
      return respond({ error: "You cannot share a file with yourself." }, 400);
    }

    // This privileged client is server-side only.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Account lookup will be connected to a restricted database function
    // in the next step. Do not expose auth.users to the browser.
    const { data, error } = await adminClient.rpc(
      "lookup_registered_recipient",
      { p_email: email },
    );

    if (error) {
      console.error("Recipient lookup failed:", error.message);
      return respond({ error: "Could not verify this recipient." }, 500);
    }

    const recipient = Array.isArray(data) ? data[0] : null;

    if (!recipient) {
      return respond({
        registered: false,
        message: "No matching NOVA account was found.",
      });
    }

    return respond({
      registered: true,
      display_name: recipient.display_name ?? null,
    });
  } catch (error) {
    console.error("Recipient verification failed:", error);
    return respond({ error: "Could not verify this recipient." }, 500);
  }
});
