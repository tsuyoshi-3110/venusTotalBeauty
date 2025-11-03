// app/products/page.tsx
import type { Metadata } from "next";
import ProductsClient from "@/components/products/ProductsClient";
import { seo } from "@/config/site";

export const metadata: Metadata = seo.page("products");

export default function ProductsPage() {
  return <ProductsClient />;
}
