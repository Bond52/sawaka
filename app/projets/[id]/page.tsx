"use client";

export default function ProjetDetailPage() {
  // 🔹 MOCK projet unique (pour l’instant)
  const projet = {
    titre: "Faire parler les plantes avec Arduino 🌿🤖",
    auteur: "Pascal Ebong",
    ville: "Ebolowa (Sud)",
    categorie: "Électronique",
    image: "/images/arduino_flower.jpeg",
    description: `
Ce projet vise à créer un dispositif Arduino capable de mesurer
l’humidité du sol et la luminosité d’une plante, puis de traduire
ces données en signaux lumineux ou sonores.

L’objectif est pédagogique, écologique et artistique.
    `,
    materiaux: [
      "Capteur d’humidité du sol",
      "LED RGB",
      "Résistances",
      "Fils Dupont",
      "Plante en pot",
    ],
    outils: [
      "Arduino Uno",
      "Ordinateur",
      "Logiciel Arduino IDE",
      "Fer à souder (optionnel)",
    ],
    etapes: [
      {
        titre: "Préparer les composants",
        contenu: `
Rassembler tous les composants électroniques nécessaires.
Vérifier le fonctionnement du capteur d’humidité.
        `,
      },
      {
        titre: "Brancher le capteur",
        contenu: `
Connecter le capteur d’humidité sur l’Arduino.
Tester les valeurs dans le moniteur série.
        `,
      },
      {
        titre: "Ajouter les LED",
        contenu: `
Configurer les LED pour changer de couleur
selon le niveau d’humidité détecté.
        `,
      },
    ],
  };

  return (
    <div className="wrap py-12">
      {/* ===== HEADER ===== */}
      <div className="max-w-4xl mx-auto mb-8">
        <p className="text-xs uppercase text-sawaka-500 mb-2">
          {projet.categorie}
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-sawaka-800 mb-2">
          {projet.titre}
        </h1>

        <p className="text-sm text-sawaka-600">
          par <strong>{projet.auteur}</strong> • 📍 {projet.ville}
        </p>
      </div>

      {/* ===== IMAGE PRINCIPALE ===== */}
      <div className="max-w-4xl mx-auto mb-10">
        <img
          src={projet.image}
          alt={projet.titre}
          className="w-full rounded-xl shadow-md"
        />
      </div>

      {/* ===== CONTENU ===== */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ===== COLONNE GAUCHE (contenu principal) ===== */}
        <div className="md:col-span-2 space-y-8">
          {/* DESCRIPTION */}
          <section>
            <h2 className="text-xl font-semibold text-sawaka-700 mb-3">
              À propos du projet
            </h2>
            <p className="text-sawaka-700 whitespace-pre-line">
              {projet.description}
            </p>
          </section>

          {/* ÉTAPES */}
          <section>
            <h2 className="text-xl font-semibold text-sawaka-700 mb-4">
              Étapes du projet
            </h2>

            <div className="space-y-6">
              {projet.etapes.map((e, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 bg-white shadow-sm"
                >
                  <h3 className="font-semibold text-sawaka-800 mb-2">
                    Étape {index + 1} — {e.titre}
                  </h3>
                  <p className="text-sawaka-700 whitespace-pre-line">
                    {e.contenu}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ===== COLONNE DROITE (sidebar Instructables-like) ===== */}
        <aside className="space-y-6">
          {/* MATÉRIAUX */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-sawaka-700 mb-2">
              🧱 Matériaux
            </h3>
            <ul className="list-disc pl-5 text-sm text-sawaka-700 space-y-1">
              {projet.materiaux.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>

          {/* OUTILS */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-sawaka-700 mb-2">
              🔧 Outils
            </h3>
            <ul className="list-disc pl-5 text-sm text-sawaka-700 space-y-1">
              {projet.outils.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="border rounded-lg p-4 bg-sawaka-50 text-center">
            <p className="text-sm text-sawaka-700 mb-3">
              Intéressé par ce projet ?
            </p>

            <button
              onClick={() =>
                alert("🚫 La collaboration nécessite un compte.")
              }
              className="w-full bg-sawaka-600 hover:bg-sawaka-700 text-white py-2 rounded-lg transition"
            >
              📩 Contacter le porteur du projet
            </button>

            <p className="mt-3 text-xs text-sawaka-500 italic">
              Ceci est un projet communautaire en cours.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
