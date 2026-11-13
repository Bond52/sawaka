"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readStoredUser } from "@/app/lib/authUser";

/** Sends anonymous visitors to the existing login page, preserving the return path. */
export function useRequireMember(): boolean {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!readStoredUser()) {
      const next = pathname || "/mes-projets";
      router.replace(`/login?redirect=${encodeURIComponent(next)}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

  return ready;
}
