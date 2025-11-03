// app/api/distance/route.ts
import { NextRequest } from "next/server";
import { distanceBetweenAddressesKm } from "@/utils/geo";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  if (!a || !b) return new Response("Missing params a,b", { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  try {
    const km = await distanceBetweenAddressesKm(a, b, apiKey);
    return Response.json({ km });
  } catch (e: any) {
    return new Response(e.message ?? "error", { status: 500 });
  }
}
