import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Paths that should never appear in the sitemap (functional/account pages)
const EXCLUDED_PATHS = new Set([
  "/account",
  "/cart",
  "/checkout",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/order",
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get site_url from cms_settings
    const { data: settingData } = await supabase
      .from("cms_settings")
      .select("value")
      .eq("setting_name", "site_url")
      .maybeSingle();

    let siteUrl = "https://holadieta.mx";
    if (settingData?.value) {
      const raw = typeof settingData.value === "string"
        ? settingData.value
        : JSON.stringify(settingData.value).replace(/^"|"$/g, "");
      if (raw) siteUrl = raw.replace(/\/$/, "");
    }

    // Fetch published CMS pages
    const { data: pages, error: pagesError } = await supabase
      .from("cms_pages")
      .select("path, updated_at")
      .eq("published", true)
      .order("path");

    if (pagesError) throw pagesError;

    // Fetch published blog posts
    const { data: posts, error: postsError } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (postsError) throw postsError;

    // Build URL entries
    const urls: string[] = [];

    for (const page of pages || []) {
      if (EXCLUDED_PATHS.has(page.path)) continue;
      const lastmod = page.updated_at ? new Date(page.updated_at).toISOString() : null;
      const loc = `${siteUrl}${page.path === "/" ? "" : page.path}`;
      urls.push(
        `  <url>\n    <loc>${escapeXml(loc)}</loc>${
          lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
        }\n  </url>`
      );
    }

    for (const post of posts || []) {
      const lastmod = post.updated_at
        ? new Date(post.updated_at).toISOString()
        : post.published_at
        ? new Date(post.published_at).toISOString()
        : null;
      const loc = `${siteUrl}/blog/${post.slug}`;
      urls.push(
        `  <url>\n    <loc>${escapeXml(loc)}</loc>${
          lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
        }\n  </url>`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
