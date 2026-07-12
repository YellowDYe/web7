import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateAuthUserRequest {
  email: string;
  password: string;
  full_name: string;
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

    const { email, password, full_name }: CreateAuthUserRequest = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, full_name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Creating auth user for email: ${email}`);
    console.log(`Password length: ${password.length} characters`);

    const createUserResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: full_name,
          },
        }),
      }
    );

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      console.error("Auth user creation failed:", errorData);

      let errorMessage = errorData.msg || errorData.message || "Failed to create auth user";

      if (errorMessage.toLowerCase().includes("already registered")) {
        errorMessage = "User already exists in authentication system";
      } else if (errorMessage.toLowerCase().includes("invalid email")) {
        errorMessage = "Invalid email address";
      } else if (errorMessage.toLowerCase().includes("password")) {
        errorMessage = "Password does not meet requirements";
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorData,
        }),
        {
          status: createUserResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authUser = await createUserResponse.json();
    console.log(`Auth user created successfully: ${authUser.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        auth_user_id: authUser.id,
        email: authUser.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in create-auth-user function:", error);

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
