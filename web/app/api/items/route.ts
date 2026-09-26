export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  if (typeof body !== 'object' || body === null || !('text' in body) || typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 120) return Response.json({ error: 'invalid_text' }, { status: 400 });
  return Response.json({ id: crypto.randomUUID(), text: body.text.trim(), done: false }, { status: 201 });
}
