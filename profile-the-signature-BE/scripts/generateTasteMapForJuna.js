const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, "..");
const IMAGE_DIR = fs.existsSync(path.join(REPO_ROOT, "public", "mock", "users", "juna", "reference-set"))
  ? path.join(REPO_ROOT, "public", "mock", "users", "juna", "reference-set")
  : path.join(WORKSPACE_ROOT, "public", "mock", "users", "juna", "reference-set");
const MOCK_USERS_PATH = fs.existsSync(path.join(REPO_ROOT, "src", "data", "mockUsers.ts"))
  ? path.join(REPO_ROOT, "src", "data", "mockUsers.ts")
  : path.join(WORKSPACE_ROOT, "src", "data", "mockUsers.ts");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PROMPT_TEXT = `SYSTEM STYLE RULES (in user text ok):
- elite fashion archivist, image-first, grounded in visible evidence
- no stereotypes or person labels, no trend labels
- no brand names in thesis
- palette: single words allowed only if editorial (Oxblood, Ecru, Espresso, Graphite, Alabaster, Cognac, Pewter). Never plain Green/Red/Black/Brown/Blue.
- avoid simple category words (bag, shoe, jacket, dress, jeans). Use silhouette, cut, line, waist placement, surface finish, hardware, drape, etc.
- references allowed only as inference in a separate references block with confidence + evidence.

TASK:
Given 30 images indexed 1..30, return JSON:
{
  "signature_title":"string",
  "taste_thesis":"string",
  "clusters":[
    {
      "cluster_name":"string",
      "cluster_thesis":"string",
      "attributes":[
        {"key":"snake_case","label":"string","score":0.0,"confidence":0.0,"evidence_images":[1,2,3]}
      ]
    }
  ],
  "references":[
    {"type":"era|designer|house_code|collection_reference","label":"string","note":"string","confidence":0.0,"evidence_images":[1,2,3]}
  ]
}

SIGNATURE TITLE RULES:
- 1 to 5 words, editorial and elegant
- must NOT include the user name
- no commas, no "in ..." phrasing, no sentence structure
- output as a standalone title phrase only

THESIS RULES:
- 2 to 3 sentences, single paragraph, coherent, no bullets, no colons
- arc: scene (if supported) -> silhouette logic -> material/surface -> palette -> hardware/details -> attitude
- no name-dropping in thesis

CLUSTERS:
- 10 to 14 clusters
- each cluster 8 to 14 attributes
- cluster_name 2 to 6 words, editorial, not generic
- attribute label: 1 to 6 words, editorial, high-end
- evidence_images: 1 to 6 ints from 1..30
- score 0..1, confidence 0..1, if uncertain score=0 and confidence=0
- keys must be snake_case and stable

REFERENCES:
- optional but encouraged
- must be framed as inference (reads adjacent to..., echoes codes of...)
- always include confidence and evidence_images

Return ONLY the JSON.`;

const RESPONSE_SCHEMA = {
  name: "taste_map_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["signature_title", "taste_thesis", "clusters", "references"],
    properties: {
      signature_title: { type: "string" },
      taste_thesis: { type: "string" },
      clusters: {
        type: "array",
        minItems: 10,
        maxItems: 14,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["cluster_name", "cluster_thesis", "attributes"],
          properties: {
            cluster_name: { type: "string" },
            cluster_thesis: { type: "string" },
            attributes: {
              type: "array",
              minItems: 8,
              maxItems: 14,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["key", "label", "score", "confidence", "evidence_images"],
                properties: {
                  key: { type: "string", pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$" },
                  label: { type: "string" },
                  score: { type: "number", minimum: 0, maximum: 1 },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  evidence_images: {
                    type: "array",
                    minItems: 1,
                    maxItems: 6,
                    items: { type: "integer", minimum: 1, maximum: 30 },
                  },
                },
              },
            },
          },
        },
      },
      references: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "label", "note", "confidence", "evidence_images"],
          properties: {
            type: {
              type: "string",
              enum: ["era", "designer", "house_code", "collection_reference"],
            },
            label: { type: "string" },
            note: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence_images: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: { type: "integer", minimum: 1, maximum: 30 },
            },
          },
        },
      },
    },
  },
};

function loadEnvLocalIfPresent() {
  const envPath = fs.existsSync(path.join(REPO_ROOT, ".env.local"))
    ? path.join(REPO_ROOT, ".env.local")
    : path.join(WORKSPACE_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function mimeFromExt(ext) {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  throw new Error(`Unsupported extension: ${ext}`);
}

function getReferenceImages() {
  if (!fs.existsSync(IMAGE_DIR)) {
    throw new Error(`Image directory not found: ${IMAGE_DIR}`);
  }
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const files = fs
    .readdirSync(IMAGE_DIR)
    .filter((file) => allowed.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 30);

  if (files.length === 0) {
    throw new Error("No supported reference images found.");
  }

  return files.map((fileName, index) => {
    const absPath = path.join(IMAGE_DIR, fileName);
    const ext = path.extname(fileName);
    const mime = mimeFromExt(ext);
    const b64 = fs.readFileSync(absPath).toString("base64");
    return {
      index: index + 1,
      fileName,
      dataUrl: `data:${mime};base64,${b64}`,
    };
  });
}

function toLiteral(value, baseIndent) {
  const json = JSON.stringify(value, null, 2);
  const indent = " ".repeat(baseIndent);
  return json
    .split("\n")
    .map((line, i) => (i === 0 ? line : `${indent}${line}`))
    .join("\n");
}

function findObjectEnd(source, startIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
      inSingle = true;
      continue;
    }
    if (inSingle && ch === "'") {
      inSingle = false;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
      inDouble = true;
      continue;
    }
    if (inDouble && ch === '"') {
      inDouble = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function patchMockUsers(generated) {
  const src = fs.readFileSync(MOCK_USERS_PATH, "utf8");
  const userMarker = "userId: 1";
  const markerIndex = src.indexOf(userMarker);
  if (markerIndex < 0) {
    throw new Error("Could not find userId: 1 in mockUsers.ts");
  }

  const objStart = src.lastIndexOf("{", markerIndex);
  if (objStart < 0) {
    throw new Error("Could not locate start of user object for userId: 1");
  }

  const objEnd = findObjectEnd(src, objStart);
  if (objEnd < 0) {
    throw new Error("Could not locate end of user object for userId: 1");
  }

  const userBlock = src.slice(objStart, objEnd + 1);
  const sanitizeSignatureTitle = (raw, userName) => {
    const source = typeof raw === "string" ? raw : "";
    const escaped = userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return source
      .replace(new RegExp(`^\\s*${escaped}\\s*,\\s*`, "i"), "")
      .replace(new RegExp(`^\\s*${escaped}\\s+`, "i"), "")
      .replace(/[.!?]+$/g, "")
      .trim();
  };

  const userNameMatch = userBlock.match(/name:\s*"([^"]+)"/);
  const userName = userNameMatch?.[1] || "User";
  const signatureTitle = sanitizeSignatureTitle(generated.signature_title, userName);

  const descLiteral = toLiteral(
    {
      signatureTitle,
      tasteThesis: generated.taste_thesis,
      references: generated.references,
    },
    6,
  );
  const attrsLiteral = toLiteral(
    {
      clusters: generated.clusters,
    },
    6,
  );

  const withDescription = userBlock.replace(
    /tasteDescription:\s*[\s\S]*?,\n(\s*)tasteAttributes:/m,
    `tasteDescription: ${descLiteral},\n$1tasteAttributes:`,
  );
  if (withDescription === userBlock) {
    throw new Error("Failed to patch tasteDescription for userId: 1");
  }

  const withAttributes = withDescription.replace(
    /tasteAttributes:\s*[\s\S]*?,\n(\s*)futureUserBehavior:/m,
    `tasteAttributes: ${attrsLiteral},\n$1futureUserBehavior:`,
  );
  if (withAttributes === withDescription) {
    throw new Error("Failed to patch tasteAttributes for userId: 1");
  }

  const patched = `${src.slice(0, objStart)}${withAttributes}${src.slice(objEnd + 1)}`;
  fs.writeFileSync(MOCK_USERS_PATH, patched, "utf8");
}

async function callOpenRouter(images) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const userContent = [{ type: "text", text: PROMPT_TEXT }];
  images.forEach((img) => {
    userContent.push({
      type: "image_url",
      image_url: { url: img.dataUrl, detail: "low" },
    });
  });

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: "Output ONLY valid JSON matching the schema. No markdown. No extra text.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter request failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const messageContent = json?.choices?.[0]?.message?.content;
  const raw =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
        : "";

  try {
    return JSON.parse(raw);
  } catch {
    console.log(raw);
    throw new Error("Failed to parse model JSON response.");
  }
}

async function main() {
  loadEnvLocalIfPresent();
  const images = getReferenceImages();
  const generated = await callOpenRouter(images);
  patchMockUsers(generated);
  console.log("Taste map generated and mockUsers.ts updated for userId=1");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
