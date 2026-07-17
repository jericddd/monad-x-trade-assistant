"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { OpenPackButton } from "@/components/packs/pack-reveal";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";

export function PackDetailClient({ slug }: { slug: string }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader label="Checking login…" />;

  if (!user) {
    return (
      <Button size="lg" onClick={() => (window.location.href = "/api/auth/x")}>
        Log in with X to Open
      </Button>
    );
  }

  return <OpenPackButton slug={slug} />;
}
