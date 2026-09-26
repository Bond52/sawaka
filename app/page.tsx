"use client";

import HeroSection from "./components/home/HeroSection";
import ProjectExplorer from "./components/home/ProjectExplorer";
import FeaturedProjects from "./components/home/FeaturedProjects";
import FeaturedProducts from "./components/home/FeaturedProducts";
// import FinalCTA from "./components/home/FinalCTA"; // ⛔ toujours masqué

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <div className="wrap pt-8 space-y-14">
        <ProjectExplorer />
        <FeaturedProjects />
        <FeaturedProducts />
        {/* <FinalCTA /> */}
      </div>
    </>
  );
}
