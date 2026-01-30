'use client';

import LoginForm from '../auth/LoginForm';


type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LoginModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-xl"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-center mb-6">
          Connexion
        </h2>

        <LoginForm onSuccess={onClose} />

<p className="text-center text-sm mt-6 text-sawaka-700">
  Pas encore de compte ?{' '}
  <button
    type="button"
    onClick={() =>
      alert(
        "🚧 La création de compte n’est pas disponible.\n\nVous pouvez explorer la plateforme et les projets existants sans créer de compte."
      )
    }
    className="font-semibold text-sawaka-600 hover:text-sawaka-800 underline"
  >
    Créez-en un
  </button>
</p>
      </div>
    </div>
  );
}
