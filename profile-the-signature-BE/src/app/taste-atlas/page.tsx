import TasteAtlas from "@/components/taste/TasteAtlas";
import { mockUsers } from "@/data/mockUsers";

export default function TasteAtlasPage() {
  const user = mockUsers.find((entry) => entry.userId === 1);

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink">Taste Atlas</h1>
        <p className="mt-3 text-sm text-meta">Mock user with id=1 not found.</p>
      </main>
    );
  }

  return <TasteAtlas user={user} />;
}
