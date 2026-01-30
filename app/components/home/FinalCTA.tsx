"use client";

export default function FinalCTA() {
  return (
    <div className="max-w-5xl mx-auto mt-12">
      <div className="bg-sawaka-50 p-6 rounded-lg border border-sawaka-200 text-center">
        <p className="text-sawaka-700 text-lg">
          🎉 <strong>Vous avez maintenant une vision claire de votre projet ?</strong>
          <br />
          Vous pouvez créer et publier votre projet sur Sawaka.
        </p>

        <button
          onClick={() =>
            alert(
              "🚫 La création de projet nécessite un compte. Fonctionnalité indisponible pour l'instant."
            )
          }
          className="mt-4 bg-sawaka-600 hover:bg-sawaka-700 text-white px-5 py-3 rounded-lg transition"
        >
          ➕ Créer mon projet
        </button>
      </div>
    </div>
  );
}
