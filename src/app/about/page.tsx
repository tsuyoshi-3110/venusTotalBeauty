// app/about/page.tsx
import AboutClient from "@/components/AboutClient";
import { seo } from "@/config/site";

export const metadata = seo.page("about");

export default function AboutPage() {
  return (
    <main className="px-4 py-4 max-w-4xl mx-auto">
      <AboutClient />
    </main>
  );
}
