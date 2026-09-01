import type { Metadata } from "next";
import ComparePageClient from "./ComparePageClient";

export const metadata: Metadata = {
  title: "Competitor Comparison — ZYNTLOX",
  description: "Compare your website head-to-head against a competitor's — design, trust, UX, and SEO, side by side.",
};

export default function ComparePage() {
  return <ComparePageClient />;
}
