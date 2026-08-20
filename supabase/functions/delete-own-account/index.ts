import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller's identity from the JWT
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authenticated user from the token
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseServiceKey },
    });

    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUser = await userRes.json();
    if (!authUser?.id) {
      return new Response(
        JSON.stringify({ error: "Could not identify user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authUser.id;
    console.log(`[delete-own-account] User ${userId} requesting account deletion`);

    // Deactivate the customer record (preserve order history)
    const deactivateRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?auth_user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          account_status: "deleted",
          auth_user_id: null,
          customer_email: `deleted_${Date.now()}@removed.local`,
          customer_phone: "",
        }),
      }
    );

    if (!deactivateRes.ok) {
      const errText = await deactivateRes.text();
      console.error(`[delete-own-account] Failed to deactivate customer:`, errText);
      return new Response(
        JSON.stringify({ error: "Failed to deactivate account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-own-account] Customer record deactivated for user ${userId}`);

    // Delete the auth user
    const deleteRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    if (!deleteRes.ok) {
      const errData = await deleteRes.text();
      console.error(`[delete-own-account] Failed to delete auth user:`, errData);
      return new Response(
        JSON.stringify({ error: "Account deactivated but login removal failed. Contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-own-account] Auth user ${userId} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[delete-own-account] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
