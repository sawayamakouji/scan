type Env = {
  MASTER_KV: KVNamespace;
  ADMIN_PASSWORD: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const form = await context.request.formData();
  const password = String(form.get("password") ?? "");
  const file = form.get("file");

  if (!password || password !== context.env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(file instanceof File)) {
    return new Response("CSV file is required.", { status: 400 });
  }

  const csvText = await file.text();
  if (!csvText.trim()) {
    return new Response("CSV is empty.", { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  await context.env.MASTER_KV.put("each-to-case.csv", csvText);
  await context.env.MASTER_KV.put("each-to-case.csv.updatedAt", updatedAt);

  return new Response(JSON.stringify({ ok: true, updatedAt }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
