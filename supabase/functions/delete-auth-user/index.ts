import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteAuthUserRequest {
  email?: string;
  auth_user_id?: string;
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

    const { email, auth_user_id }: DeleteAuthUserRequest = await req.json();

    if (!email && !auth_user_id) {
      return new Response(
        JSON.stringify({ error: "Either email or auth_user_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let targetUserId = auth_user_id;

    // If email is provided but not auth_user_id, lookup the user
    if (email && !auth_user_id) {
      console.log(`Looking up auth user by email: ${email}`);

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
            error: "Failed to lookup user",
            details: errorData,
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
        console.log(`No auth user found with email: ${email}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "No auth user found with this email (already deleted or never created)",
            auth_user_id: null,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      targetUserId = user.id;
      console.log(`Found auth user: ${targetUserId}`);
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Could not determine user ID for deletion" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Deleting auth user: ${targetUserId}`);

    const deleteUserResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${targetUserId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      }
    );

    if (!deleteUserResponse.ok) {
      const errorData = await deleteUserResponse.json();
      console.error("Auth user deletion failed:", errorData);

      let errorMessage = errorData.msg || errorData.message || "Failed to delete auth user";

      if (errorMessage.toLowerCase().includes("not found") || deleteUserResponse.status === 404) {
        console.log("Auth user not found (may have been already deleted)");
        return new Response(
          JSON.stringify({
            success: true,
            message: "Auth user not found (already deleted)",
            auth_user_id: targetUserId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorData,
        }),
        {
          status: deleteUserResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Auth user deleted successfully: ${targetUserId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Auth user deleted successfully",
        auth_user_id: targetUserId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in delete-auth-user function:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});