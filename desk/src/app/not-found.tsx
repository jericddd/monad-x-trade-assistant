import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 py-16 text-center animate-fade-in">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-mx-text">Page not found</h1>
        <p className="max-w-sm text-mx-muted">
          That page doesn&apos;t exist. Head back to the MonEx trade desk.
        </p>
      </div>
      <Link href="/">
        <Button>Go to Trade Desk</Button>
      </Link>
    </div>
  );
}
