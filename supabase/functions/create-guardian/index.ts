// supabase/functions/create-guardian/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the request body
    const { full_name, username, password_initial, sector_id, active, must_change_password, actor_id } = await req.json();

    // Verify actor is an admin
    const { data: actorProfile, error: actorError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", actor_id)
      .single();

    if (actorError || !actorProfile || actorProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso não autorizado. Apenas administradores podem criar guardiões." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if username already exists
    const { data: existingUser } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingUser) {
      return new Response(JSON.stringify({ error: "Nome de usuário já está em uso." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Use admin auth to create standard authentication user with fake email representation
    const fakeEmail = `${username.toLowerCase()}@hotelreviews.internal`;
    const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
      email: fakeEmail,
      password: password_initial,
      email_confirm: true,
      user_metadata: { role: "guardian", full_name }
    });

    if (authError || !authUser.user) {
      return new Response(JSON.stringify({ error: `Erro ao registrar no Auth: ${authError?.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Insert user profile in public.profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        id: authUser.user.id,
        full_name,
        username,
        role: "guardian",
        sector_id,
        active,
        must_change_password
      })
      .select()
      .single();

    if (profileError) {
      // rollback auth user if profile insertion failed
      await supabaseClient.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: `Erro ao criar perfil: ${profileError.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Log action to audit_logs
    await supabaseClient.from("audit_logs").insert({
      actor_user_id: actor_id,
      action: "criação de guardião",
      entity_type: "profiles",
      entity_id: profile.id,
      metadata: { full_name, username }
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
