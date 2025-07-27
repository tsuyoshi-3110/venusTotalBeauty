import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";

const PRICE_ID = process.env.STRIPE_DEFAULT_PRICE_ID!;
const DOMAIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
  "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { siteKey } = await req.json();
    console.log("✅ create-subscription called with siteKey:", siteKey);

    const snap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    if (!snap.exists) {
      console.error("❌ siteKey not found in Firestore");
      return NextResponse.json({ error: "siteKey not found" }, { status: 404 });
    }

    const customerId = snap.data()?.stripeCustomerId;
    console.log("✅ stripeCustomerId:", customerId);

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${DOMAIN}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}`,
      metadata: { siteKey },
    });

    console.log("✅ session created:", session.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("❌ create-subscription error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
