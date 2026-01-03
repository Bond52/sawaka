"use client";

import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative h-[70vh] w-full overflow-hidden">
      {/* Image de fond */}
      <img
        src="/images/hero-artisan.png"
        alt="Atelier artisanal"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Contenu */}
      <div className="relative z-10 h-full flex items-center">
        <div className="wrap text-white max-w-2xl ml-0 md:ml-12 lg:ml-20">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Donnez Vie à Vos Projets
          </h1>

         <p className="text-lg md:text-xl text-white/90 mb-6">
            Explorez des milliers de projets créatifs et trouvez l'accompagnement
            pour réaliser vos idées.
          </p>

          <Link
            href="/projets"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Explorer les Projets →
          </Link>
        </div>
      </div>
    </section>
  );
}
