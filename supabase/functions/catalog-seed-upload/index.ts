import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-secret",
};

type Body = {
  bucket: "sounds" | "covers";
  path: string;
  contentType?: string;
  contentBase64: string;
  upsert?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const pushSecretHeader = req.headers.get("x-push-secret") ?? "";
  const { data: expectedSecret } = await admin.rpc("get_vault_secret", {
    p_name: "push_dispatch_secret",
  });
  const ok =
    !!expectedSecret &&
    pushSecretHeader.length > 0 &&
    pushSecretHeader === expectedSecret;
  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!body.path || !body.contentBase64 || !body.bucket) {
    return new Response(JSON.stringify({ error: "bucket, path, contentBase64 required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (body.bucket !== "sounds" && body.bucket !== "covers") {
    return new Response(JSON.stringify({ error: "Invalid bucket" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const bin = Uint8Array.from(atob(body.contentBase64), (c) => c.charCodeAt(0));
  const { error } = await admin.storage.from(body.bucket).upload(body.path, bin, {
    upsert: body.upsert !== false,
    contentType: body.contentType || "application/octet-stream",
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: pub } = admin.storage.from(body.bucket).getPublicUrl(body.path);
  return new Response(
    JSON.stringify({
      ok: true,
      path: body.path,
      publicUrl: body.bucket === "covers" ? pub.publicUrl : null,
      // sounds bucket is private — return path; client/DB can store public URL if policy allows
      url:
        body.bucket === "covers"
          ? pub.publicUrl
          : `${supabaseUrl}/storage/v1/object/public/${body.bucket}/${body.path}`,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
