"use client";
import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function AmeliorationPage() {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      alert(t("alerts.feedbackWriteMessage"));
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

      let data = null;
      try {
        data = await res.json();
      } catch {
        alert(t("alerts.feedbackInvalidResponse"));
        setLoading(false);
        return;
      }

      if (data.success) {
        alert(t("alerts.feedbackSent"));
        setEmail("");
        setMessage("");
      } else {
        alert(data.msg || t("alerts.feedbackSendError"));
      }
    } catch (err) {
      console.error("Erreur front:", err);
      alert(t("alerts.feedbackNetworkError"));
    }

    setLoading(false);
  };

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold mb-4 text-sawaka-800">
        {t("feedback.title")}
      </h1>

      <p className="text-sawaka-700 mb-6">
        {t("feedback.subtitle")}
      </p>

      <input
        type="email"
        placeholder={t("feedback.emailOptional")}
        className="border w-full p-3 mb-4 rounded-lg"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <textarea
        placeholder={t("feedback.messagePlaceholder")}
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
        {loading ? t("feedback.sending") : t("feedback.send")}
      </button>
    </div>
  );
}
