import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetPasswordRequest {
  email: string;
  new_password: string;
}

const ADMIN_ROLES = ["ADMIN", "MANAGER"];

/**
 * Resolves the caller from the Authorization header and confirms they are an
 * active administrator. Returns null when the caller is not authorized.
 */
async function requireAdminCaller(
  req: Request,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ id: string; email: string; role_id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === serviceKey) return null;

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!userRes.ok) return null;
  const authUser = await userRes.json();
  if (!authUser?.id) return null;

  const staffRes = await fetch(
    `${supabaseUrl}/rest/v1/app_users?auth_user_id=eq.${authUser.id}&select=id,email,role_id,is_active`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  );
  if (!staffRes.ok) return null;
  const rows = await staffRes.json();
  const staff = Array.isArray(rows) ? rows[0] : null;
  if (!staff || staff.is_active === false) return null;
  if (!ADMIN_ROLES.includes(staff.role_id)) return null;

  return { id: authUser.id, email: staff.email, role_id: staff.role_id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = await requireAdminCaller(req, supabaseUrl, supabaseServiceKey);
    if (!admin) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authorized" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, new_password }: ResetPasswordRequest = await req.json();

    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, new_password" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Resetting password for email: ${email}`);

    // First, find the user by email
    const getUserResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      }
    );

    if (!getUserResponse.ok) {
      const errorData = await getUserResponse.json();
      console.error("Failed to lookup user:", errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to lookup user",
        }),
        {
          status: getUserResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const usersData = await getUserResponse.json();
    const user = usersData.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      console.error(`No auth user found with email: ${email}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "User not found in authentication system",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = user.id;
    console.log(`Found user: ${userId}, updating password...`);

    // Update the user's password using Supabase Admin API
    const updateResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify({
          password: new_password,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error("Password update failed:", errorData);

      let errorMessage = errorData.msg || errorData.message || "Failed to update password";

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          status: updateResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const updatedUser = await updateResponse.json();
    console.log(`Password updated successfully for user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password updated successfully",
        user_id: userId,
        email: updatedUser.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in reset-auth-user-password function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
