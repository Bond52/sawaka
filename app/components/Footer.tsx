import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-sawaka-900 text-sm">
      <div className="wrap flex flex-col md:flex-row items-center justify-between gap-4 py-4">

        {/* GAUCHE */}
        <div className="flex items-center gap-3 text-white">
          <span>© {new Date().getFullYear()} Sawaka</span>
          <span className="opacity-50">|</span>
          <span>Cameroun</span>
        </div>

        {/* DROITE */}
        <div className="flex flex-wrap items-center gap-5 justify-center">
          <Link
            href="/notre-mission"
            className="!text-white hover:underline hover:!text-white"
          >
            Notre mission
          </Link>

          <Link
            href="/conditions-utilisation"
            className="!text-white hover:underline hover:!text-white"
          >
            Conditions d’utilisation
          </Link>

          <Link
            href="/confidentialite"
            className="!text-white hover:underline hover:!text-white"
          >
            Confidentialité
          </Link>

          <Link
            href="/publicite"
            className="!text-white hover:underline hover:!text-white"
          >
            Publicité
          </Link>
        </div>

      </div>
    </footer>
  );
}
