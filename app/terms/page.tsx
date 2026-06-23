import type { Metadata } from "next";
import TermsContent from "./TermsContent";

export const metadata: Metadata = {
  title: "Sawaka Terms of Use",
  description: "Terms of Use for the Sawaka collaborative platform.",
};

export default function TermsPage() {
  return <TermsContent />;
}
