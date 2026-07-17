"use client";

import { AdminCheckbox, formatPackCreatedAt, TrashButton } from "@/components/admin/pack-management-controls";
import { Spinner } from "@/components/ui/spinner";

export type AdminPackRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  websiteEnabled: boolean;
  xEnabled: boolean;
  featuredOnX: boolean;
  useAssetPullRates: boolean;
  totalCards: number;
  createdAt: string;
};

export type PackToggleField =
  | "active"
  | "websiteEnabled"
  | "xEnabled"
  | "featuredOnX"
  | "useAssetPullRates";

type PackManagementTableProps = {
  packs: AdminPackRow[];
  deletingId: string | null;
  onToggle: (pack: AdminPackRow, field: PackToggleField, value: boolean) => void;
  onDelete: (pack: AdminPackRow) => void;
};

const TOGGLE_FIELDS = [
  { key: "active" as const, label: "Active" },
  { key: "websiteEnabled" as const, label: "Website" },
  { key: "xEnabled" as const, label: "X" },
  { key: "featuredOnX" as const, label: "Featured" },
  { key: "useAssetPullRates" as const, label: "Pull Rates" },
];

export function PackManagementTable({
  packs,
  deletingId,
  onToggle,
  onDelete,
}: PackManagementTableProps) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-xs text-mp-text-secondary">Newest packs appear first.</p>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-mp-border text-left text-mp-text-secondary">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Created</th>
            <th className="py-2 pr-4 font-medium">Cards</th>
            {TOGGLE_FIELDS.map((field) => (
              <th key={field.key} className="py-2 pr-2 text-center font-medium">
                {field.label}
              </th>
            ))}
            <th className="py-2 pl-2 text-center font-medium">Delete</th>
          </tr>
        </thead>
        <tbody>
          {packs.length === 0 && (
            <tr>
              <td colSpan={9} className="py-8 text-center text-mp-text-secondary">
                No packs yet. Upload images above to create one.
              </td>
            </tr>
          )}
          {packs.map((pack, index) => (
            <tr key={pack.id} className="border-b border-mp-border/60">
              <td className="py-3 pr-4">
                <div className="font-medium text-mp-text">{pack.name}</div>
                {index === 0 && packs.length > 1 && (
                  <span className="mt-1 inline-block rounded-md bg-mp-violet/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mp-violet-bright">
                    Latest
                  </span>
                )}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap text-mp-text-secondary">
                {formatPackCreatedAt(pack.createdAt)}
              </td>
              <td className="py-3 pr-4 text-mp-text-secondary">{pack.totalCards}</td>
              {TOGGLE_FIELDS.map((field) => (
                <td key={field.key} className="py-3 pr-2 text-center">
                  <AdminCheckbox
                    checked={Boolean(pack[field.key])}
                    onChange={(value) => onToggle(pack, field.key, value)}
                    label={`${pack.name} ${field.label}`}
                  />
                </td>
              ))}
              <td className="py-3 pl-2 text-center">
                {deletingId === pack.id ? (
                  <div className="flex justify-center">
                    <Spinner label="Deleting…" />
                  </div>
                ) : (
                  <TrashButton
                    label={`Delete ${pack.name}`}
                    onClick={() => onDelete(pack)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
