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
          details: errorData,
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

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        success: false,
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
