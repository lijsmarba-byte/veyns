export type MockReferenceVisual = {
  id: string;
  fileName: string;
  publicPath: string;
};

export type MockTasteAttribute = {
  key: string;
  label: string;
  score: number;
  confidence: number;
  evidence_images: number[];
};

export type MockTasteCluster = {
  cluster_name: string;
  cluster_thesis: string;
  attributes: MockTasteAttribute[];
};

export type MockTasteReference = {
  type: "era" | "designer" | "house_code" | "collection_reference";
  label: string;
  note: string;
  confidence: number;
  evidence_images: number[];
};

export type MockTasteDescription = {
  signatureTitle: string;
  tasteThesis: string;
  references: MockTasteReference[];
};

export type MockTasteAttributes = {
  clusters: MockTasteCluster[];
};

export type MockUserProfile = {
  userId: number;
  name: string;
  lastCalibrationDate: string;
  email: string;
  // Mock only. Real backend must store a password hash, never plain text.
  password: string;
  onboardingUploadSourcePath: string;
  referenceSetForMainEdit: MockReferenceVisual[];
  vector: string;
  tasteDescription: MockTasteDescription;
  tasteAttributes: MockTasteAttributes;
  futureUserBehavior: string;
};

const junaReferenceFileNames = [
  "034f25de557d511defc05229e3ae70d7.jpg",
  "03d2d86b391f3a3334967e6a8c626112.jpg",
  "189b43829c4b6ce6308e0be3af9c6bcc.jpg",
  "2354525200a4e639a5e9541697717d60.jpg",
  "38ee46decbafbe3361106aef2e2ec6e0.jpg",
  "3a7bde2d7953f3ac4b39649bbb19bbd9.jpg",
  "3e3138e9c740f3b7828389c7307d12b2.jpg",
  "486f6d65bcc1663b328f536880be6303.jpg",
  "5173883c6e1d995730c81c468f0ddde1.jpg",
  "5e68a5f5cce6ec19402922c0bcfe697b.jpg",
  "62346d087b1aa9716b61faf72b010293.jpg",
  "62639538b88be1149aa1cc855366801b.jpg",
  "6b341af2934bf880eebb2db241c826de.jpg",
  "767c3e41679df70085ca26b01d151e6e.jpg",
  "9059a92486f32e7623126324ce9e7a2b.jpg",
  "9258c7cb6d9ecf5a89b65845a218ed89.jpg",
  "a75aeb78f5595510019a957082ee084a.jpg",
  "ad1c99837c00dd5ef98637fe28ada332.jpg",
  "addf666564291372eb4f0f7721dfd477.jpg",
  "b1aa852cc3e24b3ef2f95eb55bda3428.jpg",
  "b24bdcc3e2263cb04821f88d439b9b81.jpg",
  "b2b1d1bbd49ec35da4aee13895632c12.jpg",
  "b785f365073ded34c88847ab1979bee8.jpg",
  "ba1ebe61b454e464baf14deb72ac3514.jpg",
  "bd06e9a508004db6f9c424e4784248c7.jpg",
  "ce02d4c3cdb4184b83822971e737a508.jpg",
  "d4e7ad888c357bee09f2b6d76c588b5a.jpg",
  "e70678f302b7f67359bc0176f162e4ab.jpg",
  "f4c9e9682f730de7dc436a9961782bea.jpg",
  "fd1adfc16d812dd8afabf2e1f00663e4.jpg",
];

const junaReferenceSet: MockReferenceVisual[] = junaReferenceFileNames.map(
  (fileName, index) => ({
    id: `juna-ref-${String(index + 1).padStart(2, "0")}`,
    fileName,
    publicPath: `/mock/users/juna/reference-set/${fileName}`,
  }),
);

export const mockUsers: MockUserProfile[] = [
  {
    userId: 1,
    name: "Emma",
    lastCalibrationDate: "2026-03-05",
    email: "lij.smarba@gmail.com",
    password: "juna1997",
    onboardingUploadSourcePath: "/Users/jilabrams/Desktop/mock pictures juna",
    referenceSetForMainEdit: junaReferenceSet,
    vector: "placeholder",
    tasteDescription: {
        "signatureTitle": "Contemporary Elegance",
        "tasteThesis": "Amidst urban landscapes, silhouettes reflect a blend of bold structure and soft drape, contrasting tailored lines with relaxed forms. This harmony is enhanced through luxurious materials like supple leather and cozy knits, resulting in a palette of rich hues such as Espresso and Oxblood, accented with subtle textures. Attention to detail is evident in refined hardware and statement accessories, evoking an attitude of effortless sophistication.",
        "references": []
      },
    tasteAttributes: {
        "clusters": [
          {
            "cluster_name": "Dramatic Tailoring",
            "cluster_thesis": "Bold cuts and sharp lines define a collection that challenges conventional silhouettes while maintaining wearability.",
            "attributes": [
              {
                "key": "dramatic_cut",
                "label": "Expanded shoulder lines",
                "score": 0.8,
                "confidence": 0.9,
                "evidence_images": [
                  3,
                  8,
                  13
                ]
              },
              {
                "key": "structured_line",
                "label": "Crisp tailored structures",
                "score": 0.9,
                "confidence": 0.85,
                "evidence_images": [
                  2,
                  12,
                  22
                ]
              },
              {
                "key": "waist_placement",
                "label": "High-rise designs",
                "score": 0.7,
                "confidence": 0.8,
                "evidence_images": [
                  6,
                  15
                ]
              },
              {
                "key": "surface_finish",
                "label": "Polished leather textures",
                "score": 0.85,
                "confidence": 0.9,
                "evidence_images": [
                  3,
                  18
                ]
              },
              {
                "key": "drape",
                "label": "Fluid forms",
                "score": 0.6,
                "confidence": 0.7,
                "evidence_images": [
                  1,
                  19
                ]
              },
              {
                "key": "hardware_details",
                "label": "Minimalist fastenings",
                "score": 0.55,
                "confidence": 0.6,
                "evidence_images": [
                  11,
                  27
                ]
              },
              {
                "key": "color_palette",
                "label": "Deep earthy tones",
                "score": 0.75,
                "confidence": 0.65,
                "evidence_images": [
                  1,
                  5,
                  7
                ]
              },
              {
                "key": "overall_attitude",
                "label": "Confident and poised",
                "score": 0.8,
                "confidence": 0.9,
                "evidence_images": [
                  2,
                  27
                ]
              }
            ]
          },
          {
            "cluster_name": "Casual Luxe",
            "cluster_thesis": "A blend of comfort and sophistication creates a casual yet polished aesthetic, ideal for modern living.",
            "attributes": [
              {
                "key": "silhouette_type",
                "label": "Relaxed shapes",
                "score": 0.7,
                "confidence": 0.8,
                "evidence_images": [
                  6,
                  10,
                  12
                ]
              },
              {
                "key": "material_type",
                "label": "Soft knitwear",
                "score": 0.9,
                "confidence": 0.85,
                "evidence_images": [
                  9,
                  21
                ]
              },
              {
                "key": "surface_texture",
                "label": "Textured fabrics",
                "score": 0.85,
                "confidence": 0.9,
                "evidence_images": [
                  4,
                  5
                ]
              },
              {
                "key": "transition_style",
                "label": "From day to night",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  12,
                  20
                ]
              },
              {
                "key": "accessory_style",
                "label": "Statement bags",
                "score": 0.75,
                "confidence": 0.7,
                "evidence_images": [
                  16,
                  24
                ]
              },
              {
                "key": "footwear",
                "label": "Chic heeled boots",
                "score": 0.65,
                "confidence": 0.6,
                "evidence_images": [
                  4,
                  12
                ]
              },
              {
                "key": "palette_diversity",
                "label": "Muted and soft shades",
                "score": 0.8,
                "confidence": 0.9,
                "evidence_images": [
                  3,
                  12
                ]
              },
              {
                "key": "overall_vibe",
                "label": "Effortless elegance",
                "score": 0.75,
                "confidence": 0.75,
                "evidence_images": [
                  8,
                  10
                ]
              }
            ]
          },
          {
            "cluster_name": "Layered Statements",
            "cluster_thesis": "Innovative layering creates visual interest and dynamic proportions, merging textures and styles effortlessly.",
            "attributes": [
              {
                "key": "layering_style",
                "label": "Dynamic textures",
                "score": 0.8,
                "confidence": 0.85,
                "evidence_images": [
                  2,
                  11,
                  25
                ]
              },
              {
                "key": "silhouette_variation",
                "label": "Oversized outerwear",
                "score": 0.85,
                "confidence": 0.9,
                "evidence_images": [
                  3,
                  26
                ]
              },
              {
                "key": "color_combination",
                "label": "Contrasting shades",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  9,
                  12
                ]
              },
              {
                "key": "accessory_integration",
                "label": "Balanced proportions",
                "score": 0.65,
                "confidence": 0.7,
                "evidence_images": [
                  14,
                  18
                ]
              },
              {
                "key": "overall_impact",
                "label": "Visual intrigue",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  15,
                  29
                ]
              },
              {
                "key": "layering_style",
                "label": "Varied lengths",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  4,
                  10
                ]
              },
              {
                "key": "functionality",
                "label": "Practical elegance",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  5,
                  27
                ]
              },
              {
                "key": "eye_catching_details",
                "label": "Unique closures",
                "score": 0.55,
                "confidence": 0.6,
                "evidence_images": [
                  5,
                  15
                ]
              }
            ]
          },
          {
            "cluster_name": "Refined Casual Wear",
            "cluster_thesis": "A study in balance, refined casual styles merge function with fashion for a contemporary feel.",
            "attributes": [
              {
                "key": "surface_finish",
                "label": "Soft and rich textures",
                "score": 0.8,
                "confidence": 0.85,
                "evidence_images": [
                  1,
                  12,
                  24
                ]
              },
              {
                "key": "silhouette_flare",
                "label": "Tailored yet comfortable",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  22,
                  30
                ]
              },
              {
                "key": "accessory_style",
                "label": "Minimalist jewelry",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  8,
                  17
                ]
              },
              {
                "key": "contrast_elements",
                "label": "Mixing textures",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  4,
                  15
                ]
              },
              {
                "key": "overall_feel",
                "label": "Timeless practicality",
                "score": 0.65,
                "confidence": 0.6,
                "evidence_images": [
                  2,
                  16
                ]
              },
              {
                "key": "tailoring_detail",
                "label": "Smooth finishes",
                "score": 0.5,
                "confidence": 0.6,
                "evidence_images": [
                  19,
                  26
                ]
              },
              {
                "key": "layering_approach",
                "label": "Effortless combinations",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  1,
                  15
                ]
              },
              {
                "key": "functional_design",
                "label": "Easy transitions",
                "score": 0.5,
                "confidence": 0.6,
                "evidence_images": [
                  11,
                  14
                ]
              }
            ]
          },
          {
            "cluster_name": "Chic Accessories",
            "cluster_thesis": "Key accessories deliver an impactful statement, enhancing the overall narrative of elegance and style.",
            "attributes": [
              {
                "key": "hardware_style",
                "label": "Sleek hardware accents",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  4,
                  16
                ]
              },
              {
                "key": "bag_style",
                "label": "Refined handbag silhouettes",
                "score": 0.85,
                "confidence": 0.9,
                "evidence_images": [
                  19,
                  23
                ]
              },
              {
                "key": "footwear_design",
                "label": "Elegantly structured heels",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  7,
                  28
                ]
              },
              {
                "key": "style_emphasis",
                "label": "Distinctive silhouettes",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  20,
                  30
                ]
              },
              {
                "key": "overall_statement",
                "label": "Finishing touches",
                "score": 0.8,
                "confidence": 0.9,
                "evidence_images": [
                  4,
                  25
                ]
              },
              {
                "key": "wearers_attention",
                "label": "Eye-catching elements",
                "score": 0.65,
                "confidence": 0.7,
                "evidence_images": [
                  4,
                  16
                ]
              },
              {
                "key": "color_interplay",
                "label": "Cohesive color schemes",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  7,
                  23
                ]
              },
              {
                "key": "narrative_depth",
                "label": "Elevated storytelling",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  2,
                  17
                ]
              }
            ]
          },
          {
            "cluster_name": "Layered Textures",
            "cluster_thesis": "The integration of multiple surfaces creates richness in style, playing with contrasts and dimensions.",
            "attributes": [
              {
                "key": "texture_exploration",
                "label": "Velvety and soft finishes",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  3,
                  11,
                  24
                ]
              },
              {
                "key": "contrast_play",
                "label": "Mixing supple and structured",
                "score": 0.85,
                "confidence": 0.88,
                "evidence_images": [
                  30,
                  22
                ]
              },
              {
                "key": "fabric_choices",
                "label": "Diverse material compositions",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  6,
                  14
                ]
              },
              {
                "key": "visual_depth",
                "label": "Layering for intrigue",
                "score": 0.65,
                "confidence": 0.7,
                "evidence_images": [
                  7,
                  17
                ]
              },
              {
                "key": "styling_approach",
                "label": "Thoughtfully curated",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  1,
                  23
                ]
              },
              {
                "key": "style_trend",
                "label": "Casual to polished shifts",
                "score": 0.55,
                "confidence": 0.6,
                "evidence_images": [
                  9,
                  26
                ]
              },
              {
                "key": "accessory_matching",
                "label": "Coordinated elements",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  4,
                  21
                ]
              },
              {
                "key": "visual_harmony",
                "label": "Balanced aesthetics",
                "score": 0.65,
                "confidence": 0.68,
                "evidence_images": [
                  12,
                  22
                ]
              }
            ]
          },
          {
            "cluster_name": "Subtle Minimalism",
            "cluster_thesis": "Understated elegance defines a minimalist approach, focusing on clean lines and essential forms.",
            "attributes": [
              {
                "key": "line_simplicity",
                "label": "Clean, unembellished lines",
                "score": 0.8,
                "confidence": 0.85,
                "evidence_images": [
                  2,
                  16
                ]
              },
              {
                "key": "color_focus",
                "label": "Monochromatic schemes",
                "score": 0.85,
                "confidence": 0.9,
                "evidence_images": [
                  5,
                  22
                ]
              },
              {
                "key": "aesthetic",
                "label": "Pure forms",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  13,
                  14
                ]
              },
              {
                "key": "overall_impression",
                "label": "Quiet sophistication",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  9,
                  18
                ]
              },
              {
                "key": "integrated_accessories",
                "label": "Discreet embellishments",
                "score": 0.65,
                "confidence": 0.7,
                "evidence_images": [
                  19,
                  30
                ]
              },
              {
                "key": "style_integration",
                "label": "Function meets aesthetics",
                "score": 0.5,
                "confidence": 0.6,
                "evidence_images": [
                  3,
                  12
                ]
              },
              {
                "key": "tailored_fit",
                "label": "Flattering silhouettes",
                "score": 0.65,
                "confidence": 0.68,
                "evidence_images": [
                  1,
                  13
                ]
              },
              {
                "key": "comfort_first",
                "label": "Wearable simplicity",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  8,
                  26
                ]
              }
            ]
          },
          {
            "cluster_name": "Structural Layers",
            "cluster_thesis": "Innovative shapes introduce unique perspectives on classic styles, emphasizing warmth with intricate layering.",
            "attributes": [
              {
                "key": "structured_layers",
                "label": "Multi-dimensional layering",
                "score": 0.9,
                "confidence": 0.95,
                "evidence_images": [
                  30,
                  19
                ]
              },
              {
                "key": "design_function",
                "label": "Optimized for layering",
                "score": 0.85,
                "confidence": 0.9,
                "evidence_images": [
                  11,
                  22
                ]
              },
              {
                "key": "overall_effect",
                "label": "Create visual narrative",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  4,
                  26
                ]
              },
              {
                "key": "decorative_elements",
                "label": "Artful detailing",
                "score": 0.65,
                "confidence": 0.68,
                "evidence_images": [
                  7,
                  17
                ]
              },
              {
                "key": "wearer_expression",
                "label": "Confident individuality",
                "score": 0.5,
                "confidence": 0.58,
                "evidence_images": [
                  9,
                  12
                ]
              },
              {
                "key": "narrative_style",
                "label": "Fresh interpretations",
                "score": 0.7,
                "confidence": 0.72,
                "evidence_images": [
                  3,
                  14
                ]
              },
              {
                "key": "artful_fusion",
                "label": "Combining traditional and modern",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  10,
                  20
                ]
              },
              {
                "key": "context_adaptability",
                "label": "Versatile applications",
                "score": 0.6,
                "confidence": 0.65,
                "evidence_images": [
                  3,
                  27
                ]
              }
            ]
          },
          {
            "cluster_name": "Eclectic Brevity",
            "cluster_thesis": "Short cuts and sharp lines create bold expressions of individuality within contemporary contexts.",
            "attributes": [
              {
                "key": "design_exploration",
                "label": "Playful proportions",
                "score": 0.8,
                "confidence": 0.85,
                "evidence_images": [
                  5,
                  10
                ]
              },
              {
                "key": "narrative_direction",
                "label": "Exploring the unconventional",
                "score": 0.75,
                "confidence": 0.8,
                "evidence_images": [
                  8,
                  30
                ]
              },
              {
                "key": "styling_expressions",
                "label": "Layered yet concise",
                "score": 0.65,
                "confidence": 0.7,
                "evidence_images": [
                  16,
                  24
                ]
              },
              {
                "key": "color_palette",
                "label": "Brilliant contrasts",
                "score": 0.6,
                "confidence": 0.63,
                "evidence_images": [
                  2,
                  22
                ]
              },
              {
                "key": "overall_seasonality",
                "label": "Timeless cuts for every season",
                "score": 0.5,
                "confidence": 0.55,
                "evidence_images": [
                  1,
                  22
                ]
              },
              {
                "key": "style_reference",
                "label": "Echoes of past designs",
                "score": 0.55,
                "confidence": 0.58,
                "evidence_images": [
                  12,
                  20
                ]
              },
              {
                "key": "fashion_current",
                "label": "Contemporary references",
                "score": 0.65,
                "confidence": 0.65,
                "evidence_images": [
                  4,
                  18
                ]
              },
              {
                "key": "wear_format",
                "label": "Daily versatility",
                "score": 0.55,
                "confidence": 0.58,
                "evidence_images": [
                  6,
                  8
                ]
              }
            ]
          },
          {
            "cluster_name": "Timeless Appeal",
            "cluster_thesis": "Classic forms and styles resonate within modern aesthetics, ensuring a lasting impact.",
            "attributes": [
              {
                "key": "classic_refinement",
                "label": "Enduring style elements",
                "score": 0.9,
                "confidence": 0.8,
                "evidence_images": [
                  3,
                  16
                ]
              },
              {
                "key": "cohesive_links",
                "label": "Bridging past and future",
                "score": 0.75,
                "confidence": 0.78,
                "evidence_images": [
                  4,
                  15
                ]
              },
              {
                "key": "cultural_influences",
                "label": "Incorporation of heritage",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  11,
                  24
                ]
              },
              {
                "key": "subtle_evolutions",
                "label": "Quiet updates to classics",
                "score": 0.6,
                "confidence": 0.68,
                "evidence_images": [
                  8,
                  26
                ]
              },
              {
                "key": "overall_signature",
                "label": "Unmistakable charisma",
                "score": 0.65,
                "confidence": 0.65,
                "evidence_images": [
                  1,
                  23
                ]
              },
              {
                "key": "functionality",
                "label": "Suitable for diverse occasions",
                "score": 0.55,
                "confidence": 0.6,
                "evidence_images": [
                  10,
                  19
                ]
              },
              {
                "key": "design_context",
                "label": "Reflects contemporary times",
                "score": 0.6,
                "confidence": 0.6,
                "evidence_images": [
                  7,
                  25
                ]
              },
              {
                "key": "style_character",
                "label": "Identifiable personality traits",
                "score": 0.7,
                "confidence": 0.75,
                "evidence_images": [
                  3,
                  22
                ]
              }
            ]
          }
        ]
      },
    futureUserBehavior: "placeholder",
  },
];

export const mockUserById = new Map(mockUsers.map((user) => [user.userId, user]));
