"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

export function usePendingCard() {
  const { user } = useAuth();
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasPending(false);
      return;
    }
    fetch("/api/collection")
      .then((r) => r.json())
      .then((data) => setHasPending(Boolean(data.pending)))
      .catch(() => setHasPending(false));
  }, [user]);

  return { hasPending };
}
