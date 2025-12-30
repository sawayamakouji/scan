type Env = {
  MASTER_KV: KVNamespace;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const csvText = await context.env.MASTER_KV.get("each-to-case.csv");
  if (!csvText) {
    return context.next();
  }

  const updatedAt = await context.env.MASTER_KV.get("each-to-case.csv.updatedAt");
  const headers: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Cache-Control": "no-store"
  };
  if (updatedAt) {
    headers["X-Master-Updated-At"] = updatedAt;
  }

  return new Response(csvText, {
    status: 200,
    headers
  });
};
