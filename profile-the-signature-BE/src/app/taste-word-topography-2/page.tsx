import TasteWordSunburst20 from "@/components/taste/TasteWordSunburst20";
import { mockUsers } from "@/data/mockUsers";

export default function TasteWordTopography2Page() {
  const juna = mockUsers.find((entry) => entry.userId === 1);

  if (!juna) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink">Taste Word Topography 2.0</h1>
        <p className="mt-3 text-sm text-meta">Mock user with id=1 not found.</p>
      </main>
    );
  }

  return <TasteWordSunburst20 user={juna} />;
}
