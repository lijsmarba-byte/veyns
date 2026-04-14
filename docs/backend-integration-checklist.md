# Backend Integration Checklist (Capsules + Saved Products)

Ziel: Die aktuelle UI-Logik (`acquire/save`, Capsule-Auswahl, `saved` Toggle) sauber mit einer echten User-Datenbank verbinden.

## 1) Datenmodell (Minimum)

### Tabelle `users`
- `id` (uuid, PK)
- `email` (text, unique)
- `created_at` (timestamptz)

### Tabelle `capsules`
- `id` (uuid, PK)
- `user_id` (uuid, FK -> `users.id`, index)
- `slug` (text) Beispiele: `main`, `capsule1`, `capsule2`, `capsule3`
- `name` (text) Beispiele: `Main Capsule`, `Capsule 1`
- `created_at` (timestamptz)
- Unique: (`user_id`, `slug`)

### Tabelle `products`
- `id` (text oder uuid, PK) muss zum Frontend-`itemId` passen
- `brand` (text)
- `title` (text)
- `image_url` (text)
- `price_label` (text)
- `created_at` (timestamptz)

### Tabelle `capsule_items`
- `id` (uuid, PK)
- `capsule_id` (uuid, FK -> `capsules.id`, index)
- `product_id` (FK -> `products.id`, index)
- `saved_at` (timestamptz)
- Unique: (`capsule_id`, `product_id`) verhindert Duplikate in derselben Capsule

## 2) IDs und Mapping-Regeln

Frontend darf nie nur mit Labeln arbeiten. Entscheidend ist immer die ID/Slug.

- UI Label: `Main Capsule` (nur Anzeige)
- Persistenz: `capsuleSlug` oder `capsuleId`
- Produkt: `itemId` aus `/src/data/mockCatalog.ts` wird `product_id`

Default-Mapping aus Gallery Edit:
- `main` -> `main`
- `edit1a` -> `capsule1`
- `edit1b` -> `capsule2`
- `edit1c` -> `capsule3`

## 3) API-Verträge (App Router Vorschlag)

### `GET /api/capsules`
Liefert Capsules des eingeloggten Users.

Response:
```json
{
  "capsules": [
    { "id": "uuid", "slug": "main", "name": "Main Capsule" }
  ]
}
```

### `GET /api/capsules/items?productIds=item-01,item-02`
Liefert Saved-Status für die sichtbaren Produkte.

Response:
```json
{
  "savedByProduct": {
    "item-01": { "capsuleId": "uuid", "capsuleSlug": "main", "savedAt": "..." },
    "item-02": null
  }
}
```

### `POST /api/capsules/items`
Speichert ein Produkt in gewählter Capsule.

Request:
```json
{
  "capsuleSlug": "capsule1",
  "productId": "item-01"
}
```

Response:
```json
{
  "ok": true,
  "saved": { "capsuleSlug": "capsule1", "productId": "item-01", "savedAt": "..." }
}
```

### `DELETE /api/capsules/items`
Entfernt Produkt aus Capsule (oder global für User, je nach Produktentscheidung).

Request:
```json
{
  "productId": "item-01"
}
```

Response:
```json
{
  "ok": true
}
```

## 4) Frontend-Stellen, die Backend brauchen

### `/src/components/unseen/GalleryHoverActions.tsx`
- Ersetzen:
  - `localStorage.getItem("unseen:saved-items")`
  - `localStorage.setItem("unseen:saved-items", ...)`
- Durch:
  - Initial Load: API-Status laden
  - Save (`+`): `POST /api/capsules/items`
  - Unsave (`saved` Klick): `DELETE /api/capsules/items`

Benötigte Daten im Component-State:
- `selectedCapsuleSlug`
- `isSaved`
- `savedCapsuleSlug` (optional, falls UI später anzeigen soll, wo gespeichert wurde)
- `isSaving` / `isRemoving` (für Disable/Spinner)
- `errorMessage` (wenn Request fehlschlägt)

### `/src/components/unseen/GalleryEditNav.tsx`
- Nutzt bereits `?edit=...` im URL-State.
- Wird weiter für Default-Mapping zur Capsule verwendet.

## 5) Auth/Ownership Regeln

Jeder Request braucht den eingeloggten User-Kontext:
- Backend muss `user_id` aus Session/JWT bestimmen.
- Nie `user_id` aus Client-Body vertrauen.

Pflichtchecks:
- Capsule gehört dem User.
- Produkt-ID existiert.
- Duplicate Save wird idempotent behandelt (durch Unique-Constraint + upsert/ignore).

## 6) Fehlerfälle (muss abgefangen werden)

- User nicht eingeloggt -> `401`
- Capsule nicht gefunden oder nicht vom User -> `404/403`
- Produkt unbekannt -> `404`
- Race/duplicate save -> `409` oder `200` idempotent
- Netzwerkfehler -> UI rollback von optimistic state

## 7) Schritt-für-Schritt Umsetzung

1. Migrationen für `capsules`, `products`, `capsule_items` erstellen.
2. Seed für Default-Capsules pro User (`main`, `capsule1`, `capsule2`, `capsule3`).
3. API-Routen im Next App Router anlegen (`/src/app/api/...`).
4. `GalleryHoverActions` von `localStorage` auf API umstellen.
5. Optimistic UI + Rollback bei Fehler implementieren.
6. Archive-Ansicht aus `capsule_items` rendern (statt nur Mock).
7. Logging/Telemetry für Save/Unsave Erfolg und Fehler.

## 8) Was du dir merken musst (Kurzfassung)

- Anzeigename ist nie die Wahrheit, immer `capsuleId`/`capsuleSlug`.
- Save/Unsave darf nur für eingeloggten User passieren.
- Duplikate in derselben Capsule per DB-Constraint verhindern.
- UI darf optimistisch sein, muss bei Fehler sauber zurückrollen.
