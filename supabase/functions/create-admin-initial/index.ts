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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    // Build admin privilege client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { admin_initial_password, admin_email } = await req.json();
    const finalPassword = admin_initial_password || "0000";
    const finalEmail = admin_email || "admin@hotelreviews.internal";

    // 1. Create secure Auth User using Admin Auth API (this bypasses standard sign_up email verification requirements)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'Administrador' }
    });

    if (authError) {
      // If user already exists, just report success or handle elegantly
      if (authError.message.includes("already exists")) {
        return new Response(
          JSON.stringify({ success: true, message: "Administrador já existe na tabela de autenticação." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw authError;
    }

    // 2. Insert corresponding Profile record mapping the auth ID
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.user.id,
        full_name: "Administrador Geral",
        username: "admin",
        role: "admin",
        active: true,
        must_change_password: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "username" });

    if (profileError) throw profileError;

    // Log the initial system setup
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: authUser.user.id,
      action: "criação de super admin inicial",
      entity_type: "profiles",
      entity_id: authUser.user.id,
      metadata: { email: finalEmail, setup: "true" }
    });

    return new Response(
      JSON.stringify({ success: true, user_id: authUser.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
