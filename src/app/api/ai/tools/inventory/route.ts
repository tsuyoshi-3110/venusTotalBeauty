// app/api/ai/tools/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchInventory, inventoryPassages, fetchInventory } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { siteKey, query, topN } = (await req.json()) as {
      siteKey?: string;
      query?: string;
      topN?: number;
    };

    if (!siteKey) return NextResponse.json({ error: "siteKey is required" }, { status: 400 });

    const items =
      typeof query === "string" && query.trim()
        ? await searchInventory(siteKey, query, Math.min(Math.max(topN || 10, 1), 30))
        : await fetchInventory(siteKey);

    const passages = inventoryPassages(items);
    const generatedAt = new Date().toISOString();

    return NextResponse.json({ items, passages, generatedAt });
  } catch (err: any) {
    console.error("/api/ai/tools/inventory error", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
