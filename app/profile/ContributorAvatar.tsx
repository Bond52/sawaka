"use client";

import { useEffect, useState } from "react";

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

type Props = {
  name: string;
  photoUrl?: string | null;
  alt: string;
  imageTestId: string;
};

export default function ContributorAvatar({
  name,
  photoUrl,
  alt,
  imageTestId,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        className="h-24 w-24 shrink-0 rounded-full object-cover"
        data-testid={imageTestId}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
      aria-hidden
      data-testid="contributor-profile-avatar"
    >
      {initials(name)}
    </div>
  );
}
