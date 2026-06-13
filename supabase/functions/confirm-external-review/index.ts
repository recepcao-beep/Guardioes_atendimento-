// supabase/functions/confirm-external-review/index.ts
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

    const { invite_id, notes, reference, actor_id, type } = await req.json();

    // Verify actor is an admin
    const { data: actorProfile, error: actorError } = await supabaseClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", actor_id)
      .single();

    if (actorError || !actorProfile || actorProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerenciar conciliação." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (type === "confirm") {
      // Create manual confirmation
      const { data: invite } = await supabaseClient
        .from("review_invites")
        .select("platform_id")
        .eq("id", invite_id)
        .single();

      const { data: confirmation, error: confError } = await supabaseClient
        .from("external_review_confirmations")
        .insert({
          invite_id,
          platform_id: invite.platform_id,
          confirmation_type: "manual",
          external_review_reference: reference || "Painel Administrativo",
          confirmed_by: actorProfile.full_name,
          notes
        })
        .select()
        .single();

      if (confError) {
        return new Response(JSON.stringify({ error: `Erro na conciliação: ${confError.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Update status on invite
      await supabaseClient
        .from("review_invites")
        .update({ status: "externally_verified_manual" })
        .eq("id", invite_id);

      // Audit log
      await supabaseClient.from("audit_logs").insert({
        actor_user_id: actor_id,
        action: "confirmação manual de avaliação externa",
        entity_type: "review_invites",
        entity_id: invite_id,
        metadata: { notes, reference }
      });

      return new Response(JSON.stringify({ confirmation }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } else if (type === "remove") {
      // Remove manual confirmation
      const { error: deleteError } = await supabaseClient
        .from("external_review_confirmations")
        .delete()
        .eq("invite_id", invite_id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: `Erro ao remover: ${deleteError.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Reset invite status back to opened
      await supabaseClient
        .from("review_invites")
        .update({ status: "opened" })
        .eq("id", invite_id);

      // Audit log
      await supabaseClient.from("audit_logs").insert({
        actor_user_id: actor_id,
        action: "remoção de confirmação",
        entity_type: "review_invites",
        entity_id: invite_id
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: "Interação inválida." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
