import type { Metadata } from "next";
import PrivacyContent from "./PrivacyContent";

export const metadata: Metadata = {
  title: "Sawaka Privacy Policy",
  description:
    "Privacy Policy explaining how Sawaka collects, uses, stores, and protects personal information.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
