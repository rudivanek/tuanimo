import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MemoryItem {
  key: string;
  value_enc: string;
  last_confirmed_at?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authUser) {
      throw new Error("Unauthorized: Auth session missing!");
    }
    const userId = authUser.id;
    );

    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "5");

      const { data: memories, error } = await supabaseClient
        .from("user_memory")
        .select("key, value_enc, last_confirmed_at, created_at")
        .eq("user_id", userId)
        .order("last_confirmed_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ memories: memories || [] }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (method === "POST" || method === "PUT") {
      const body = await req.json();
      const { key, value_enc } = body as MemoryItem;

      if (!key || !value_enc) {
        throw new Error("Missing required fields: key and value_enc");
      }

      const { data, error } = await supabaseClient
        .from("user_memory")
        .upsert({
          user_id: userId,
          key,
          value_enc,
          last_confirmed_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,key",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ memory: data }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (method === "DELETE") {
      const body = await req.json();
      const { key } = body;

      if (!key) {
        throw new Error("Missing required field: key");
      }

      const { error } = await supabaseClient
        .from("user_memory")
        .delete()
        .eq("user_id", userId)
        .eq("key", key);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    throw new Error("Method not allowed");

  } catch (error) {
    console.error("User memory error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: error.message === "Unauthorized" ? 401 :
                error.message === "Method not allowed" ? 405 : 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
