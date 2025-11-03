export const dynamic = "force-dynamic"; // キャッシュ回避（任意）

export async function GET() {
  return new Response(JSON.stringify({ ok: true, where: "app-router" }), {
    headers: { "content-type": "application/json" },
  });
}
