'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Props = {
  onSuccess?: () => void;
};

export default function LoginForm({ onSuccess }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const API_URL =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://ecommerce-web-avec-tailwind.onrender.com');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    localStorage.removeItem('user');
    document.cookie = 'token=; Max-Age=0; path=/';

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Identifiants incorrects');

      if (data.token) {
        localStorage.setItem(
          'user',
          JSON.stringify({
            token: data.token,
            roles: data.roles,
            username: data.username || email.split('@')[0],
            firstName: data.firstName || '',
            lastName: data.lastName || '',
          })
        );
      }

      onSuccess?.();

      const redirect = searchParams.get('redirect');
      router.push(redirect || '/');
    } catch {
      alert('Erreur de connexion au serveur');
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-sawaka-800 mb-1">
          Email
        </label>
        <input
          type="email"
          placeholder="Votre email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-sawaka-800 mb-1">
          Mot de passe
        </label>
        <input
          type="password"
          placeholder="Votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <button type="submit" className="btn-primary w-full">
        Se connecter
      </button>
    </form>
  );
}
