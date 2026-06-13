// supabase/functions/update-guardian/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { target_id, update_fields, actor_id } = await req.json();

    // Verify actor
    const { data: actorProfile, error: actorError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", actor_id)
      .single();

    if (actorError || !actorProfile || actorProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if updating password in auth list
    if (update_fields.password_new) {
      const { error: authError } = await supabaseClient.auth.admin.updateUserById(target_id, {
        password: update_fields.password_new
      });
      if (authError) {
        return new Response(JSON.stringify({ error: `Falha ao redefinir credencial de login: ${authError.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Filtering only columns to update in profiles
    const filteredUpdate: Record<string, any> = {};
    if (update_fields.full_name !== undefined) filteredUpdate.full_name = update_fields.full_name;
    if (update_fields.username !== undefined) filteredUpdate.username = update_fields.username;
    if (update_fields.sector_id !== undefined) filteredUpdate.sector_id = update_fields.sector_id;
    if (update_fields.active !== undefined) filteredUpdate.active = update_fields.active;
    if (update_fields.must_change_password !== undefined) filteredUpdate.must_change_password = update_fields.must_change_password;

    filteredUpdate.updated_at = new Date().toISOString();

    const { data: profile, error: dbError } = await supabaseClient
      .from("profiles")
      .update(filteredUpdate)
      .eq("id", target_id)
      .select()
      .single();

    if (dbError) {
      return new Response(JSON.stringify({ error: `Erro no banco de dados: ${dbError.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Register log
    await supabaseClient.from("audit_logs").insert({
      actor_user_id: actor_id,
      action: "edição de guardião",
      entity_type: "profiles",
      entity_id: target_id,
      metadata: { update_columns: Object.keys(filteredUpdate) }
    });

    return new Response(JSON.stringify({ user: profile }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
