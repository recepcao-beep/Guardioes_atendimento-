// supabase/functions/submit-internal-review/index.ts
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

    const { token, fields } = await req.json();

    // Fetch review invite first
    const { data: invite, error: inviteError } = await supabaseClient
      .from("review_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Token inválido ou inexistente." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (invite.status === "internal_completed") {
      return new Response(JSON.stringify({ error: "Este convite já recebeu uma avaliação interna." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Insert public rating
    const { data: review, error: reviewError } = await supabaseClient
      .from("internal_reviews")
      .insert({
        invite_id: invite.id,
        score: fields.score,
        comment: fields.comment,
        guest_name: fields.guest_name || null,
        room_number: fields.room_number || null,
        guest_email: fields.guest_email || null,
        consent_given: fields.consent_given
      })
      .select()
      .single();

    if (reviewError) {
      return new Response(JSON.stringify({ error: `Falha ao salvar avaliação: ${reviewError.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Lock status of review invite to internal_completed
    await supabaseClient
      .from("review_invites")
      .update({ status: "internal_completed" })
      .eq("id", invite.id);

    // Enter review completed event
    await supabaseClient.from("review_events").insert({
      invite_id: invite.id,
      event_type: "internal_review_completed",
      metadata: { score: fields.score, reviewer: fields.guest_name || "Anônimo" }
    });

    return new Response(JSON.stringify({ success: true, review }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
