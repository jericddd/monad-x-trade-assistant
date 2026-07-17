import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

type CardArtProps = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function CardArt({ src, alt, className, priority }: CardArtProps) {
  return (
    <div className={cn("mp-card-art shadow-card", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-mp-surface-raised text-mp-muted">
          <ImageIcon className="h-10 w-10" aria-hidden />
          <span className="sr-only">{alt}</span>
        </div>
      )}
    </div>
  );
}

export function PackCover({ src, alt, className }: CardArtProps) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl bg-mp-surface-raised shadow-card", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-mp-muted">
          <ImageIcon className="h-10 w-10" aria-hidden />
        </div>
      )}
    </div>
  );
}
