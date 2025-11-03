// app/products/page.tsx
import ProductsECClient from "@/components/productsEC/ProductsECClient";
import { seo } from "@/config/site";

export const metadata = seo.page("products");

export default function ProductsPage() {
  return <ProductsECClient />;
}
