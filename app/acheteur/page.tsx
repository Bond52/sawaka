'use client';

import Link from "next/link";

export default function AcheteurPage() {
  return (
    <div>
      <h1>Bienvenue acheteur</h1>
      <p>Vous êtes maintenant connecté en tant qu&apos;acheteur.</p>

      <Link href="/acheteur/commandes">
        <button style={{ marginTop: "1rem" }}>
          📦 Voir mes commandes en cours
        </button>
      </Link>
    </div>
  );
}

