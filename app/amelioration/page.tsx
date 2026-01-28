"use client";
import { useState } from "react";

export default function AmeliorationPage() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      alert("Veuillez écrire un message.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, email }),
        }
      );

      // Tentative de lecture JSON
      let data = null;
      try {
        data = await res.json();
      } catch {
        alert("Réponse du serveur invalide.");
        setLoading(false);
        return;
      }

      // Vérifier succès
      if (data.success) {
        alert("Merci ! Votre message a été envoyé. 🙏");
        setEmail("");
        setMessage("");
      } else {
        alert(data.msg || "Erreur lors de l’envoi.");
      }
    } catch (err) {
      console.error("Erreur front:", err);
      alert("Erreur réseau : impossible de contacter le serveur.");
    }

    setLoading(false);
  };

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold mb-4 text-sawaka-800">
        Améliorer Sawaka
      </h1>

      <p className="text-sawaka-700 mb-6">
        Sawaka est en phase de test. Donnez-nous vos idées, vos suggestions,
        vos retours sur l&apos;expérience utilisateur ou les bugs rencontrés !
      </p>

      <input
        type="email"
        placeholder="Votre email (optionnel)"
        className="border w-full p-3 mb-4 rounded-lg"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <textarea
        placeholder="Votre message..."
        className="border w-full p-4 h-40 rounded-lg"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        onClick={handleSend}
        disabled={loading}
        className={`mt-4 bg-sawaka-600 text-white px-6 py-3 rounded-lg transition ${
          loading ? "opacity-50 cursor-not-allowed" : "hover:bg-sawaka-700"
        }`}
      >
        {loading ? "Envoi en cours..." : "Envoyer"}
      </button>
    </div>
  );
}
