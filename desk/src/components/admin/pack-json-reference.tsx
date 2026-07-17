const EXAMPLE_PACK_JSON = `{
  "name": "Monad Cards",
  "description": "Optional pack description",
  "cards": [
    {
      "id": "monad-card-1",
      "name": "Monad Card #1",
      "image": "images/card-1.png",
      "supplyType": "UNLIMITED"
    },
    {
      "id": "monad-card-2",
      "name": "Monad Card #2",
      "image": "images/card-2.png",
      "rarity": "Rare",
      "weight": 25,
      "supplyType": "LIMITED",
      "maxSupply": 100
    }
  ]
}`;

export function PackJsonReference() {
  return (
    <details className="group rounded-xl border border-mp-border bg-mp-surface-raised/30">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium text-mp-text [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>Pack JSON reference — what to include in your ZIP</span>
          <span
            className="text-mp-muted transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-mp-border px-4 py-4 text-sm text-mp-text-secondary">
        <section className="space-y-2">
          <h3 className="font-medium text-mp-text">ZIP layout</h3>
          <pre className="overflow-x-auto rounded-lg border border-mp-border bg-mp-bg/60 p-3 font-mono text-xs text-mp-violet-bright">
{`your-pack.zip
├── pack.json          ← required manifest
└── images/
    ├── card-1.png
    └── card-2.png`}
          </pre>
          <p>
            <code className="text-mp-violet-bright">pack.json</code> and{" "}
            <code className="text-mp-violet-bright">images/</code> must sit at the same level inside
            the ZIP. On Windows, zip the folder contents (not the parent folder).
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-mp-text">Required fields</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-mp-border text-mp-muted">
                  <th className="py-2 pr-4 font-medium">Field</th>
                  <th className="py-2 pr-4 font-medium">Level</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">cards</td>
                  <td className="py-2 pr-4">pack</td>
                  <td className="py-2 font-sans">Array of card objects (at least one)</td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">name</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">Display name shown in the app</td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">image</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">Path inside ZIP, e.g. images/card-1.png</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-mp-text">Optional fields</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-mp-border text-mp-muted">
                  <th className="py-2 pr-4 font-medium">Field</th>
                  <th className="py-2 pr-4 font-medium">Level</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">name</td>
                  <td className="py-2 pr-4">pack</td>
                  <td className="py-2 font-sans">Pack title (auto-detected on import)</td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">description</td>
                  <td className="py-2 pr-4">pack</td>
                  <td className="py-2 font-sans">Pack description</td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">id</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">
                    Stable unique ID — use a new ID for each new card batch
                  </td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">rarity</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">Label only (e.g. Common, Legendary)</td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">weight</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">
                    Pull rate weight — only used when Pull Rates is ON in Pack Management
                  </td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">supplyType</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">
                    UNLIMITED (default) or LIMITED — set before publish; not editable in admin
                    later
                  </td>
                </tr>
                <tr className="border-b border-mp-border/60">
                  <td className="py-2 pr-4 text-mp-violet-bright">maxSupply</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">Required when supplyType is LIMITED</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-mp-violet-bright">metadata</td>
                  <td className="py-2 pr-4">card</td>
                  <td className="py-2 font-sans">Extra NFT metadata (object)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-mp-text">Example pack.json</h3>
          <pre className="max-h-80 overflow-auto rounded-lg border border-mp-border bg-mp-bg/60 p-3 font-mono text-xs text-mp-text">
            {EXAMPLE_PACK_JSON}
          </pre>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-mp-text">Adding cards later</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Include only the new cards in pack.json — omit cards already imported.</li>
            <li>Give every new card a unique id (e.g. monad-card-11, monad-card-12).</li>
            <li>
              Card display numbers (#11, #12…) are assigned automatically when you publish.
            </li>
            <li>
              Images-only ZIPs are not supported — pack.json is always required.
            </li>
          </ul>
        </section>
      </div>
    </details>
  );
}
