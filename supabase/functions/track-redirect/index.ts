// supabase/functions/track-redirect/index.ts
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

    const { token } = await req.json();

    // Query invite
    const { data: invite, error: inviteError } = await supabaseClient
      .from("review_invites")
      .select("*, platforms(code, external_url)")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Token de convite inválido." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (invite.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Este convite foi cancelado." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const platform = invite.platforms;
    const now = new Date().toISOString();

    // Update invite counter and update status
    const { data: updatedinvite, error: updateError } = await supabaseClient
      .from("review_invites")
      .update({
        opened_count: invite.opened_count + 1,
        status: invite.status === "emitted" ? "opened" : invite.status,
        first_opened_at: invite.first_opened_at || now,
        last_opened_at: now
      })
      .eq("id", invite.id)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: "Falha ao registrar abertura." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Insert review event
    await supabaseClient.from("review_events").insert({
      invite_id: invite.id,
      event_type: "redirect_opened",
      metadata: { date: now, platform_code: platform.code }
    });

    // Determine target URL redirect
    let redirectUrl = platform.external_url;
    if (platform.code === "internal" && (!redirectUrl || redirectUrl.trim() === "" || redirectUrl.includes("avaliacao-interna"))) {
      redirectUrl = `/avaliacao-interna/${token}`;
    }

    return new Response(JSON.stringify({ url: redirectUrl, invite: updatedinvite }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
