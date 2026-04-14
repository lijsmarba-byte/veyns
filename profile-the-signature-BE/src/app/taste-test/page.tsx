import Image from "next/image";
import { mockUsers } from "@/data/mockUsers";

function clampToPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 100;
  return Math.round(value * 100);
}

export default function TasteTestPage() {
  const user = mockUsers.find((entry) => entry.userId === 1);

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink">Taste Test</h1>
        <p className="mt-4 text-sm text-meta">Mock user with id=1 was not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 border-b border-line pb-4">
        <h1 className="text-2xl font-semibold text-ink">Taste Test</h1>
        <p className="mt-2 text-sm text-meta">
          User {user.userId}: {user.name} ({user.email})
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-ink">Reference Set (30 Images)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {user.referenceSetForMainEdit.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-md border border-line bg-mist">
              <div className="relative aspect-square w-full">
                <Image
                  src={image.publicPath}
                  alt={`Reference ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />
              </div>
              <div className="px-2 py-1 text-xs text-meta">{index + 1}. {image.fileName}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-ink">Taste Thesis</h2>
        <p className="rounded-md border border-line bg-mist p-4 text-sm leading-6 text-ink">
          {user.tasteDescription.tasteThesis}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-ink">References</h2>
        <ul className="space-y-2">
          {user.tasteDescription.references.length === 0 ? (
            <li className="rounded-md border border-line bg-mist p-3 text-sm text-meta">
              No references generated yet.
            </li>
          ) : (
            user.tasteDescription.references.map((ref, idx) => (
              <li key={`${ref.type}-${ref.label}-${idx}`} className="rounded-md border border-line bg-mist p-3">
                <p className="text-sm font-medium text-ink">{ref.label}</p>
                <p className="mt-1 text-sm text-ink">{ref.note}</p>
                <p className="mt-1 text-xs text-meta">
                  type: {ref.type} | confidence: {ref.confidence.toFixed(2)} | evidence:{" "}
                  {ref.evidence_images.join(", ")}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Clusters</h2>
        <div className="space-y-6">
          {user.tasteAttributes.clusters.length === 0 ? (
            <div className="rounded-md border border-line bg-mist p-3 text-sm text-meta">
              No clusters generated yet.
            </div>
          ) : (
            user.tasteAttributes.clusters.map((cluster, clusterIdx) => (
              <article key={`${cluster.cluster_name}-${clusterIdx}`} className="rounded-md border border-line bg-mist p-4">
                <h3 className="text-base font-semibold text-ink">{cluster.cluster_name}</h3>
                <p className="mt-2 text-sm text-ink">{cluster.cluster_thesis}</p>

                <ul className="mt-4 space-y-2">
                  {cluster.attributes.map((attribute, attrIdx) => {
                    const scorePercent = clampToPercent(attribute.score);
                    return (
                      <li key={`${clusterIdx}-${attribute.key}-${attrIdx}`} className="rounded border border-line bg-paper p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">{attribute.label}</span>
                          <span className="text-xs text-meta">
                            score: {attribute.score.toFixed(2)} | confidence: {attribute.confidence.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${scorePercent}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-meta">evidence: {attribute.evidence_images.join(", ")}</p>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
