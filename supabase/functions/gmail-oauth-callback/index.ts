import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "Missing code or redirect_uri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Gmail config for client credentials
    const { data: config, error: configError } = await supabase
      .from("gmail_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Gmail config not found. Save credentials first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      return new Response(
        JSON.stringify({ error: "Token exchange failed", details: errBody }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: "No refresh token received. Please revoke app access in Google Account settings and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's email address
    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let connectedEmail = "";
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      connectedEmail = profile.emailAddress || "";
    }

    // Save tokens to config
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("gmail_config")
      .update({
        refresh_token: refreshToken,
        access_token: accessToken,
        token_expiry: tokenExpiry,
        connected_email: connectedEmail,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to save tokens", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        connected_email: connectedEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
