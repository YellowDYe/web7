import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const banxicoRate = await fetchBanxico();
    if (banxicoRate) {
      return new Response(
        JSON.stringify({
          rate: banxicoRate.rate,
          source: "banxico",
          date: banxicoRate.date,
          currency_from: "USD",
          currency_to: "MXN",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fallbackRate = await fetchFrankfurter();
    if (fallbackRate) {
      return new Response(
        JSON.stringify({
          rate: fallbackRate.rate,
          source: "frankfurter",
          date: fallbackRate.date,
          currency_from: "USD",
          currency_to: "MXN",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Could not fetch exchange rate from any source",
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getBanxicoToken(): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("banxico_config")
      .select("api_token, is_active")
      .maybeSingle();

    if (error || !data || !data.is_active || !data.api_token) return null;
    return data.api_token;
  } catch {
    return null;
  }
}

async function fetchBanxico(): Promise<{ rate: number; date: string } | null> {
  try {
    const token = await getBanxicoToken();
    if (!token) return null;

    const response = await fetch(
      "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno",
      {
        headers: {
          "Bmx-Token": token,
          Accept: "application/json",
          "Accept-Encoding": "gzip",
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const series = data?.bmx?.series?.[0];
    const datum = series?.datos?.[0];

    if (!datum?.dato || datum.dato === "N/E") return null;

    const rate = parseFloat(datum.dato);
    if (isNaN(rate) || rate <= 0) return null;

    return { rate, date: datum.fecha };
  } catch {
    return null;
  }
}

async function fetchFrankfurter(): Promise<{ rate: number; date: string } | null> {
  try {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=MXN"
    );

    if (!response.ok) return null;

    const data = await response.json();
    const rate = data?.rates?.MXN;

    if (!rate || rate <= 0) return null;

    return { rate, date: data.date };
  } catch {
    return null;
  }
}
