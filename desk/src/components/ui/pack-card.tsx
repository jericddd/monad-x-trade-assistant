import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PackCover } from "@/components/ui/card-art";

export type PackCardData = {
  id: string;
  slug: string;
  name: string;
  coverImage?: string | null;
  totalCards: number;
  useAssetPullRates?: boolean;
};

export function PackCard({ pack, className }: { pack: PackCardData; className?: string }) {
  return (
    <Card className={cn("group flex flex-col overflow-hidden mp-hover-lift hover:border-mp-violet/40", className)}>
      <div className="overflow-hidden">
        <PackCover
          src={pack.coverImage}
          alt={pack.name}
          className="rounded-none transition-transform duration-500 ease-mp-out group-hover:scale-105"
        />
      </div>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div>
          <h2 className="truncate font-display text-lg font-bold text-mp-text" title={pack.name}>
            {pack.name}
          </h2>
          <p className="text-sm text-mp-text-secondary">{pack.totalCards} cards</p>
          <p className="text-xs text-mp-muted">
            {pack.useAssetPullRates ? "Asset pull rates" : "Equal odds"}
          </p>
        </div>
        <div className="mt-auto flex gap-2">
          <Link href={`/packs/${pack.slug}`} className="flex-1">
            <Button variant="secondary" className="w-full" size="sm">
              Details
            </Button>
          </Link>
          <Link href={`/packs/${pack.slug}`} className="flex-1">
            <Button className="w-full" size="sm">
              Open
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function PackCardCompact({ pack }: { pack: PackCardData }) {
  return (
    <Link href={`/packs/${pack.slug}`} className="group block">
      <Card className="overflow-hidden mp-hover-lift group-hover:border-mp-violet/40">
        <div className="overflow-hidden">
          <PackCover
            src={pack.coverImage}
            alt={pack.name}
            className="aspect-video rounded-none transition-transform duration-500 ease-mp-out group-hover:scale-105"
          />
        </div>
        <CardContent className="space-y-2">
          <h3 className="truncate font-semibold text-mp-text" title={pack.name}>
            {pack.name}
          </h3>
          <p className="text-sm text-mp-text-secondary">{pack.totalCards} cards</p>
          <Button variant="secondary" size="sm" className="w-full" tabIndex={-1}>
            View Pack
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
