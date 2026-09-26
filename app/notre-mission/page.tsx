import type { Metadata } from "next";
import MissionContent from "./MissionContent";

export const metadata: Metadata = {
  title: "Sawaka — About Us & Mission",
  description:
    "Discover Sawaka's mission, values, and vision: a collaborative platform connecting entrepreneurs, artisans, makers, suppliers, and communities.",
};

export default function MissionPage() {
  return <MissionContent />;
}
