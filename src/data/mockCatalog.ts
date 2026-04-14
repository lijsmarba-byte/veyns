export type MockCatalogItem = {
  id: string;
  idxLabel: string;
  brand: string;
  price: string;
  imgSrc: string;
  status: "new" | "pre-owned";
  artsyName: string;
  artsyDesc: string;
  cuePalette: string;
  cueSurface: string;
  cueStructure: string;
  cueAccent: string;
};

export type MockCatalogSection = {
  key: string;
  title: string;
  items: MockCatalogItem[];
};

type MockCatalogItemBase = Omit<MockCatalogItem, "status">;
type MockCatalogSectionBase = {
  key: string;
  title: string;
  items: MockCatalogItemBase[];
};

const rawSections: MockCatalogSectionBase[] = [
  {
    "key": "OUTER",
    "title": "Outer",
    "items": [
      {
        "id": "item-01",
        "idxLabel": "[01]",
        "brand": "La DoubleJ",
        "price": "1560 EUR",
        "imgSrc": "/mock/OUTER/P01130772 Background Removed.png",
        "artsyName": "Floral Cascade",
        "artsyDesc": "An expanse of pure silk, rendered in shades of russet and cream, defines this fluid form. The material drapes with a satin sheen, gathering at the waist before falling into a wide, curvilinear silhouette.",
        "cuePalette": "Russet, Teal, Cream",
        "cueSurface": "Satin Sheen, Fluid Drape",
        "cueStructure": "Wide Leg, Gathered Waist",
        "cueAccent": "Curvilinear Motif, Bold Border"
      },
      {
        "id": "item-02",
        "idxLabel": "[02]",
        "brand": "Prada",
        "price": "3180 EUR",
        "imgSrc": "/mock/OUTER/P01136185 Background Removed.png",
        "artsyName": "Refined Simplicity",
        "artsyDesc": "Polished calf leather, deeply hued in ebony, conforms to a streamlined form. Fine grain and subtle stitching detail a low profile structure, its edges burnished with use.",
        "cuePalette": "Ebony, Charcoal",
        "cueSurface": "Polished Leather, Fine Grain",
        "cueStructure": "Low Profile, Streamlined Form",
        "cueAccent": "Subtle Stitching, Burnished Edge"
      },
      {
        "id": "item-03",
        "idxLabel": "[03]",
        "brand": "Danielle Frankel",
        "price": "4220 EUR",
        "imgSrc": "/mock/OUTER/P01139660 Background Removed.png",
        "artsyName": "Ephemeral Bloom",
        "artsyDesc": "A diffuse volume is achieved through layers of weightless tulle and acetate blends. The structure is anchored by a ruched bodice, presenting a soft focus aesthetic in shades of ivory and pale pearl.",
        "cuePalette": "Ivory, Pale Pearl",
        "cueSurface": "Weightless Tulle, Soft Focus",
        "cueStructure": "Ruched Bodice, Layered Skirt",
        "cueAccent": "Diffuse Volume, Delicate Gathering"
      },
      {
        "id": "item-04",
        "idxLabel": "[04]",
        "brand": "Faithfull",
        "price": "2540 EUR",
        "imgSrc": "/mock/OUTER/P01140007 Background Removed.png",
        "artsyName": "Desert Horizon",
        "artsyDesc": "Woven from a textured linen and rayon blend in sandstone tones, this open design presents a defined waist. Horn buttons and braided ties fasten a V-neckline over a matte finish.",
        "cuePalette": "Khaki, Sandstone",
        "cueSurface": "Textured Linen, Matte Finish",
        "cueStructure": "Defined Waist, Open Front",
        "cueAccent": "Horn Buttons, Braided Ties"
      },
      {
        "id": "item-05",
        "idxLabel": "[05]",
        "brand": "Valentino Garavani",
        "price": "3310 EUR",
        "imgSrc": "/mock/OUTER/P01164178 Background Removed.png",
        "artsyName": "Coastal Echo",
        "artsyDesc": "Woven leather in shades of sky blue and beige creates a textured surface, accented by studded details. An ankle strap secures the form, balanced over a wedge heel bound with rope.",
        "cuePalette": "Sky Blue, Beige",
        "cueSurface": "Woven Leather, Textured Sole",
        "cueStructure": "Ankle Strap, Wedge Heel",
        "cueAccent": "Studded Detail, Rope Binding"
      },
      {
        "id": "item-06",
        "idxLabel": "[06]",
        "brand": "Jean Paul Gaultier",
        "price": "3110 EUR",
        "imgSrc": "/mock/OUTER/P01169587 Background Removed.png",
        "artsyName": "Optical Illusion",
        "artsyDesc": "Fine mesh, rippled in texture and smoky in hue, clings to a close silhouette. A subtle, wavy pattern is embedded within the translucent material, tracing the fitted form.",
        "cuePalette": "Charcoal, Smoke, Silvered Grey",
        "cueSurface": "Fine Mesh, Rippled Texture, Sheer",
        "cueStructure": "Close Silhouette, Fitted Form, Linear",
        "cueAccent": "Wavy Pattern, Logo Script, Delicate"
      },
      {
        "id": "item-07",
        "idxLabel": "[07]",
        "brand": "Amina Muaddi",
        "price": "4250 EUR",
        "imgSrc": "/mock/OUTER/P01057219 Background Removed.png",
        "artsyName": "Bronze Embellishment",
        "artsyDesc": "The polished sheen of satin, rendered in burnt sienna, defines a sculpted curve. A high heel and slingback configuration support the streamlined form, embellished with crystalline details.",
        "cuePalette": "Burnt Sienna, Copper, Tawny",
        "cueSurface": "Satin Sheen, Polished Leather, Smooth",
        "cueStructure": "Slingback Curve, High Heel, Streamlined",
        "cueAccent": "Crystalline Detail, Bow Motif, Metallic"
      },
      {
        "id": "item-41",
        "idxLabel": "[41]",
        "brand": "Christopher Esber",
        "price": "1560 EUR",
        "imgSrc": "/mock/OUTER/P01078426 Background Removed.png",
        "artsyName": "Solar Bloom",
        "artsyDesc": "A column of polyamide and elastane, possessing a liquid drape, is interrupted by an open cavity. Gathered ruches contribute to the form’s sculpted waist and are presented in shades of tangerine, ochre, and saffron.",
        "cuePalette": "Tangerine, Ochre, Saffron",
        "cueSurface": "Supple Stretch, Liquid Drape",
        "cueStructure": "Sculpted Waist, Column Silhouette",
        "cueAccent": "Gathered Ruches, Open Cavity"
      },
      {
        "id": "item-42",
        "idxLabel": "[42]",
        "brand": "Jil Sander",
        "price": "3180 EUR",
        "imgSrc": "/mock/OUTER/P01099445 Background Removed.png",
        "artsyName": "Blurred Edges",
        "artsyDesc": "A relaxed, boxy form is created from a textured knit of alpaca wool and wool, its surface exhibiting a fuzzy pile. Subtle ribbing and a raw hemline define the edges of this structure, presented in shades of charcoal, graphite, and ash.",
        "cuePalette": "Charcoal, Graphite, Ash",
        "cueSurface": "Textured Knit, Fuzzy Pile",
        "cueStructure": "Relaxed Shoulders, Boxy Fit",
        "cueAccent": "Raw Hemline, Subtle Rib"
      },
      {
        "id": "item-43",
        "idxLabel": "[43]",
        "brand": "Christopher Esber",
        "price": "4220 EUR",
        "imgSrc": "/mock/OUTER/P01130669 Background Removed.png",
        "artsyName": "Amethyst Cascade",
        "artsyDesc": "Fluid bias-cut jersey, smooth to the touch, defines an elongated line, supported by slender straps. An asymmetrical cut creates a dynamic interplay of form and void, appearing in the lavender, periwinkle, and lilac.",
        "cuePalette": "Lavender, Periwinkle, Lilac",
        "cueSurface": "Smooth Jersey, Fluid Bias",
        "cueStructure": "Slender Straps, Elongated Line",
        "cueAccent": "Asymmetrical Cut, Defined Waist"
      },
      {
        "id": "item-44",
        "idxLabel": "[44]",
        "brand": "Valentino Garavani",
        "price": "2540 EUR",
        "imgSrc": "/mock/OUTER/P01131309 Background Removed.png",
        "artsyName": "Rose Quartz",
        "artsyDesc": "A minimalist form, flat in profile, is constructed from polished leather with a subtle metallic sheen. Delicate straps secure the foot, embellished with studs that catch the light, presented in blush, coral, and peach.",
        "cuePalette": "Blush, Coral, Peach",
        "cueSurface": "Metallic Sheen, Polished Leather",
        "cueStructure": "Flat Profile, Minimalist Form",
        "cueAccent": "Studded Embellishment, Delicate Straps"
      },
      {
        "id": "item-45",
        "idxLabel": "[45]",
        "brand": "Dries Van Noten",
        "price": "3310 EUR",
        "imgSrc": "/mock/OUTER/P01162560 Background Removed.png",
        "artsyName": "Winter Haze",
        "artsyDesc": "An oversized silhouette is rendered in a textured blend of mohair and wool, the bouclé surface creating a tactile experience. A notched lapel and button closure define the structure, presented in the neutral tones of oatmeal, taupe, and stone.",
        "cuePalette": "Oatmeal, Taupe, Stone",
        "cueSurface": "Bouclé Texture, Wool Blend",
        "cueStructure": "Oversized Silhouette, Straight Cut",
        "cueAccent": "Notched Lapel, Button Closure"
      },
      {
        "id": "item-46",
        "idxLabel": "[46]",
        "brand": "Aquazzura",
        "price": "3110 EUR",
        "imgSrc": "/mock/OUTER/P01119195 Background Removed.png",
        "artsyName": "Midnight Embellishment",
        "artsyDesc": "A pointed silhouette is constructed from bouclé fabric, exhibiting a fine glitter across its surface. A curved strap secures the form, accented by sleek hardware, presented in shades of onyx, charcoal, and jet.",
        "cuePalette": "Onyx, Charcoal, Jet",
        "cueSurface": "Textured Bouclé, Fine Glitter",
        "cueStructure": "Pointed Silhouette, Curved Strap",
        "cueAccent": "Sleek Hardware, Subtle Shine"
      }
    ]
  },
  {
    "key": "UPPER",
    "title": "Upper",
    "items": [
      {
        "id": "item-08",
        "idxLabel": "[08]",
        "brand": "Celine Eyewear",
        "price": "3500 EUR",
        "imgSrc": "/mock/UPPER/P01107824 Background Removed.png",
        "artsyName": "Chromatic Outline",
        "artsyDesc": "Glossy acetate, smoothly finished in rose quartz, frames a bold oval contour. Reflective surfaces emphasize a minimalist geometric form, punctuated by a solid hue.",
        "cuePalette": "Fuchsia, Magenta, Rose Quartz",
        "cueSurface": "Glossy Acetate, Smooth Finish, Reflective",
        "cueStructure": "Oval Frame, Bold Contour, Rounded",
        "cueAccent": "Solid Hue, Geometric Form, Minimalist"
      },
      {
        "id": "item-09",
        "idxLabel": "[09]",
        "brand": "Frescobol Carioca",
        "price": "3010 EUR",
        "imgSrc": "/mock/UPPER/P01119173 Background Removed.png",
        "artsyName": "Coastal Drift",
        "artsyDesc": "Woven from natural fiber canvas in shades of ecru and sand, this structure maintains a relaxed profile. A jute sole and woven trim establish a casual aesthetic, emphasizing its low form.",
        "cuePalette": "Ecru, Sand, Linen White",
        "cueSurface": "Canvas Texture, Natural Fiber, Matte",
        "cueStructure": "Low Profile, Slip On, Relaxed",
        "cueAccent": "Jute Sole, Woven Trim, Casual"
      },
      {
        "id": "item-10",
        "idxLabel": "[10]",
        "brand": "Jacquemus",
        "price": "1670 EUR",
        "imgSrc": "/mock/UPPER/P01123965 Background Removed.png",
        "artsyName": "Barely There",
        "artsyDesc": "Translucent mesh, a blend of viscose, cotton, and polyester, conforms to the exposed form. Delicate straps secure a fluid structure, accentuated by minimal coverage and subdued tones.",
        "cuePalette": "Ebony, Shadow, Jet",
        "cueSurface": "Translucent Mesh, Fine Knit, Soft",
        "cueStructure": "Sculpted Cups, Minimal Coverage, Fluid",
        "cueAccent": "Strappy Detail, Exposed Form, Subdued"
      },
      {
        "id": "item-11",
        "idxLabel": "[11]",
        "brand": "Yeprem",
        "price": "1840 EUR",
        "imgSrc": "/mock/UPPER/P01129258 Background Removed.png",
        "artsyName": "Gilded Arc",
        "artsyDesc": "A confluence of eighteen-karat white and yellow gold forms an open casing, strung with a scatter of carefully angled diamonds. The stones, a composition of round and marquise cuts, possess a combined weight and capture a pale gold effulgence, while delicate lines from the fine chain accentuate the form's inherent smoothness.",
        "cuePalette": "Pale Gold, Ivory",
        "cueSurface": "Bright Polish, Smooth Curve",
        "cueStructure": "Open Casing, Delicate Line",
        "cueAccent": "Diamond Scatter, Fine Chain"
      },
      {
        "id": "item-12",
        "idxLabel": "[12]",
        "brand": "Stone and Strand",
        "price": "3630 EUR",
        "imgSrc": "/mock/UPPER/P01136626 Background Removed.png",
        "artsyName": "Lunar Bloom",
        "artsyDesc": "Ten-karat gold, bearing a subtle grain, is shaped into a minimalist pendant suspended from a fine link. Minute diamonds are closely set against the surface, their dispersed presence offering a faint dustiness.",
        "cuePalette": "Rose Gold, Pearl",
        "cueSurface": "Subtle Grain, Soft Sheen",
        "cueStructure": "Minimalist Pendant, Fine Link",
        "cueAccent": "Diamond Dust, Delicate Loop"
      },
      {
        "id": "item-13",
        "idxLabel": "[13]",
        "brand": "McQueen",
        "price": "1570 EUR",
        "imgSrc": "/mock/UPPER/P01142567 Background Removed.png",
        "artsyName": "Sculpted Silhouette",
        "artsyDesc": "Dense wool, subtly informed by elastane, constructs a defined form, retaining structure through a fitted waist and defined shoulders. Button detailing and a structured lapel mark the surface, its matte finish absorbing available light.",
        "cuePalette": "Jet, Charcoal",
        "cueSurface": "Woven Texture, Matte Finish",
        "cueStructure": "Defined Shoulder, Fitted Waist",
        "cueAccent": "Button Detailing, Structured Lapel"
      },
      {
        "id": "item-14",
        "idxLabel": "[14]",
        "brand": "Brunello Cucinelli",
        "price": "3510 EUR",
        "imgSrc": "/mock/UPPER/P00912547 Background Removed.png",
        "artsyName": "Terra Lines",
        "artsyDesc": "A construction of cotton and polyamide delivers a crisp texture, rendered in stripes of rust and cream. Relaxed volume defines its open form, and a button placket runs vertically along its center.",
        "cuePalette": "Rust, Cream",
        "cueSurface": "Crisp Cotton, Vertical Stripe",
        "cueStructure": "Relaxed Volume, Short Sleeve",
        "cueAccent": "Contrast Trim, Button Placket"
      },
      {
        "id": "item-47",
        "idxLabel": "[47]",
        "brand": "Blumarine",
        "price": "4250 EUR",
        "imgSrc": "/mock/UPPER/P01085106 Background Removed.png",
        "artsyName": "Blush Gathering",
        "artsyDesc": "Viscose jersey drapes and gathers to form a ruched bodice, extending to a tiered hemline of sheer tulle. A halter neckline defines the upper structure, all rendered in the rose quartz, pale pink, and soft peach.",
        "cuePalette": "Rose Quartz, Pale Pink, Soft Peach",
        "cueSurface": "Draped Jersey, Sheer Tulle",
        "cueStructure": "Ruched Bodice, Tiered Hemline",
        "cueAccent": "Halter Neckline, Delicate Volume"
      },
      {
        "id": "item-48",
        "idxLabel": "[48]",
        "brand": "Bottega Veneta",
        "price": "3500 EUR",
        "imgSrc": "/mock/UPPER/P01124006 Background Removed.png",
        "artsyName": "Sculpted Terrain",
        "artsyDesc": "Dark shades of brown define the exterior of this constructed form, referencing terrestrial mapping through layered paneling. Supple calf leather yields to a robust rubber composition, articulated by a weighty sole and elastic gussets that suggest articulated movement. Echoes of umber and espresso blend across the surface, suggesting geological strata.",
        "cuePalette": "Dark Chocolate, Espresso, Umber",
        "cueSurface": "Supple Leather, Polished Finish",
        "cueStructure": "Chunky Sole, Elastic Gussets",
        "cueAccent": "Stacked Heel, Defined Profile"
      },
      {
        "id": "item-49",
        "idxLabel": "[49]",
        "brand": "Valentino Garavani",
        "price": "3010 EUR",
        "imgSrc": "/mock/UPPER/P01124009 Background Removed.png",
        "artsyName": "Metallic Bow",
        "artsyDesc": "A liquid sheen coats the metallic leather, reflecting light across the slender structure. Polished silver gives form to both the subtle fastening and an oversized bow, anchoring the delicate arrangement of straps. Platinum and pewter tones coalesce into a bright, cool presence.",
        "cuePalette": "Silver, Platinum, Pewter",
        "cueSurface": "Liquid Leather, Smooth Grain",
        "cueStructure": "Thong Strap, Block Heel",
        "cueAccent": "Oversized Bow, Polished Metal"
      },
      {
        "id": "item-50",
        "idxLabel": "[50]",
        "brand": "Brunello Cucinelli",
        "price": "1670 EUR",
        "imgSrc": "/mock/UPPER/P01124968 Background Removed.png",
        "artsyName": "Earthen Traverse",
        "artsyDesc": "Buffed leather, in tones of stone and umber, provides a durable outer layer to this structured construction. Woven laces secure the ankle, complementing hardware with a burnished character, while a robust sole anchors the whole to the earth. Softness from wool and cashmere intersects the more rugged leather.",
        "cuePalette": "Stone, Umber, Flax",
        "cueSurface": "Buffed Leather, Corded Texture",
        "cueStructure": "Ankle Support, Robust Sole",
        "cueAccent": "Burnished Hardware, Woven Laces"
      },
      {
        "id": "item-51",
        "idxLabel": "[51]",
        "brand": "Dolce&Gabbana",
        "price": "1840 EUR",
        "imgSrc": "/mock/UPPER/P01136627 Background Removed.png",
        "artsyName": "Sculpted Silhouette",
        "artsyDesc": "Dense, dark wool forms a structured silhouette distinguished by a high waist and wide leg. A crisp gabardine surface is defined by a pressed crease, streamlining the form, and secured with a buttoned closure. Graphite and jet hues engage in a near monochrome study.",
        "cuePalette": "Jet, Graphite, Charcoal",
        "cueSurface": "Crisp Gabardine, Clean Finish",
        "cueStructure": "High Waisted, Wide Leg",
        "cueAccent": "Buttoned Closure, Pressed Crease"
      },
      {
        "id": "item-52",
        "idxLabel": "[52]",
        "brand": "Alaïa",
        "price": "3630 EUR",
        "imgSrc": "/mock/UPPER/P01148993 Background Removed.png",
        "artsyName": "Amorous Gesture",
        "artsyDesc": "A curved form of supple black leather suggests a contained volume, secured by twin, circumferential zippers. A slender strap provides the means of transport, while a knotted detail introduces tension, its polished hardware reflecting the surrounding darkness. The surface is a study in ebony and onyx.",
        "cuePalette": "Onyx, Ebony, Raven",
        "cueSurface": "Supple Leather, Smooth Grain",
        "cueStructure": "Curved Form, Slender Strap",
        "cueAccent": "Knotted Detail, Polished Fasteners"
      },
      {
        "id": "item-53",
        "idxLabel": "[53]",
        "brand": "Saint Laurent",
        "price": "1570 EUR",
        "imgSrc": "/mock/UPPER/P01107112 Background Removed.png",
        "artsyName": "Lucent Drape",
        "artsyDesc": "Fluid silk satin drapes with a delicate sheen, its surface broken only by covered buttons down a loosely structured form. A self-tie collar allows for variable configuration, while the palette leans toward an expanse of ivory and pearl. Cream tones permeate the reflective material.",
        "cuePalette": "Ivory, Pearl, Cream",
        "cueSurface": "Satin Face, Fluid Sheen",
        "cueStructure": "Loose Silhouette, Wide Sleeves",
        "cueAccent": "Tie Neck, Covered Buttons"
      }
    ]
  },
  {
    "key": "LOWER",
    "title": "Lower",
    "items": [
      {
        "id": "item-15",
        "idxLabel": "[15]",
        "brand": "Faithfull",
        "price": "1910 EUR",
        "imgSrc": "/mock/LOWER/P01115286 Background Removed.png",
        "artsyName": "Coastal Drift",
        "artsyDesc": "Viscose, cotton, nylon, and elastane combine in a ribbed knit, creating an object with a softly textured surface displaying a vibrant striped pattern. A polo collar and buttoned placket define it, while the form possesses a boxy dimensionality.",
        "cuePalette": "Coral, Ochre",
        "cueSurface": "Ribbed Knit, Soft Texture",
        "cueStructure": "Boxy Fit, Polo Collar",
        "cueAccent": "Striped Pattern, Buttoned Placket"
      },
      {
        "id": "item-16",
        "idxLabel": "[16]",
        "brand": "Jacquemus",
        "price": "4300 EUR",
        "imgSrc": "/mock/LOWER/P01115467 Background Removed.png",
        "artsyName": "Crisp White Geometry",
        "artsyDesc": "Clean poplin, composed entirely of cotton, falls in a boxy silhouette with broad shoulders. A concealed button placket maintains the form’s smoothness and is cinched at the waist with a belt.",
        "cuePalette": "Ivory, Chalk, Stone",
        "cueSurface": "Clean Poplin, Subtle Sheen",
        "cueStructure": "Boxy Silhouette, Broad Shoulder",
        "cueAccent": "Golden Button, Sharp Collar"
      },
      {
        "id": "item-17",
        "idxLabel": "[17]",
        "brand": "Loro Piana",
        "price": "1680 EUR",
        "imgSrc": "/mock/LOWER/P01115533 Background Removed.png",
        "artsyName": "Amber Ribbed Descent",
        "artsyDesc": "Entirely of cashmere, a cardigan draped in caramel and ochre tones exhibits a textural knit with a warm pile. Horn buttons secure a relaxed form, while side slit pockets are integrated into the structure.",
        "cuePalette": "Caramel, Ochre, Burnt Sienna",
        "cueSurface": "Textured Knit, Warm Pile",
        "cueStructure": "Relaxed Cardigan, Shawl Collar",
        "cueAccent": "Horn Buttons, Subtle Texture"
      },
      {
        "id": "item-18",
        "idxLabel": "[18]",
        "brand": "Dior Eyewear",
        "price": "840 EUR",
        "imgSrc": "/mock/LOWER/P01118173 Background Removed.png",
        "artsyName": "Reflective Night Vision",
        "artsyDesc": "Smooth acetate constructs a cat-eye frame, tinted to a dark shade and accentuated by gold studs. The angularity of the brow extends to the polished temples.",
        "cuePalette": "Jet, Graphite, Charcoal",
        "cueSurface": "Smooth Acetate, Dark Tint",
        "cueStructure": "Cat Eye Frame, Angular Brow",
        "cueAccent": "Gold Studs, Polished Temples"
      },
      {
        "id": "item-19",
        "idxLabel": "[19]",
        "brand": "JW Anderson",
        "price": "1740 EUR",
        "imgSrc": "/mock/LOWER/P01150121 Background Removed.png",
        "artsyName": "Silvered Surface Tension",
        "artsyDesc": "Suede, in shades of pearl and stone, forms a low profile, the rounded toe complemented by a delicate strap. Minute crystal embellishments sparsely cover the surface, providing a subtle iridescence.",
        "cuePalette": "Pearl, Stone, Taupe",
        "cueSurface": "Suede Grain, Subtle Iridescence",
        "cueStructure": "Low Profile, Rounded Toe",
        "cueAccent": "Crystal Embellishment, Delicate Strap"
      },
      {
        "id": "item-20",
        "idxLabel": "[20]",
        "brand": "Plan C",
        "price": "3040 EUR",
        "imgSrc": "/mock/LOWER/P01091749 Background Removed.png",
        "artsyName": "Cascading Obsidian Waves",
        "artsyDesc": "Supple crepe, wholly of viscose, flows in a columnar form—a dark and fluid drape punctuated by ruffled detailing at the waist. The surface absorbs nearly all light, appearing as a single, unbroken depth.",
        "cuePalette": "Ebony, Ink, Raven",
        "cueSurface": "Supple Crepe, Fluid Drape",
        "cueStructure": "Off Shoulder, Columnar Form",
        "cueAccent": "Ruffled Neckline, Soft Volume"
      },
      {
        "id": "item-54",
        "idxLabel": "[54]",
        "brand": "Valentino",
        "price": "3510 EUR",
        "imgSrc": "/mock/LOWER/P01107015 Background Removed.png",
        "artsyName": "Naval Authority",
        "artsyDesc": "The density of virgin wool composes a double-breasted form, accentuated by structured shoulders and gilded buttons. A dark palette of midnight and slate is interrupted only by glints of gold hardware and the subtle sheen of viscose, revealing layered textures within the structure. The fabric exhibits a dense weave.",
        "cuePalette": "Midnight, Ink, Slate",
        "cueSurface": "Woolen Cloth, Dense Weave",
        "cueStructure": "Double Breasted, Peak Lapel",
        "cueAccent": "Gilded Buttons, Structured Shoulders"
      },
      {
        "id": "item-55",
        "idxLabel": "[55]",
        "brand": "Gianvito Rossi",
        "price": "1910 EUR",
        "imgSrc": "/mock/LOWER/P01107019 Background Removed.png",
        "artsyName": "Crimson Reverie",
        "artsyDesc": "Smooth calf leather in a cardinal hue defines a low-profile structure, secured with delicate hardware and a buckled ankle closure. A rounded toe offers a softened edge to the substantial form while polished surfaces reflect a saturated red. The warm tones embody a concentrated energy.",
        "cuePalette": "Cardinal, Cherry, Scarlet",
        "cueSurface": "Smooth Calf, Polished Finish",
        "cueStructure": "Low Profile, Rounded Toe",
        "cueAccent": "Buckled Ankle, Delicate Hardware"
      },
      {
        "id": "item-56",
        "idxLabel": "[56]",
        "brand": "Chloé",
        "price": "4300 EUR",
        "imgSrc": "/mock/LOWER/P01114282 Background Removed.png",
        "artsyName": "Winter Bloom",
        "artsyDesc": "A columnar form of wool and cashmere possesses a delicate open knit, revealing a nuanced surface of textural stitches. Chalk and ivory create a lightness, contrasted by the subtle weight of the material, enhanced by a ruffled shoulder detail. A fine gauge lends a delicate sheen.",
        "cuePalette": "Ivory, Chalk, Snow",
        "cueSurface": "Open Knit, Fine Gauge",
        "cueStructure": "Columnar Silhouette, Long Line",
        "cueAccent": "Ruffled Shoulders, Delicate Sheen"
      },
      {
        "id": "item-57",
        "idxLabel": "[57]",
        "brand": "Christopher Esber",
        "price": "1680 EUR",
        "imgSrc": "/mock/LOWER/P01114319 Background Removed.png",
        "artsyName": "Ember Cascade",
        "artsyDesc": "Slender leather straps support a sculpted heel, accented with the raw, textured edges of fringed detail. Buckled closures secure the construction, in shades of umber and russet, which evoke earthy tones. A supple leather surface denotes a sense of relaxed fluidity.",
        "cuePalette": "Chocolate, Umber, Russet",
        "cueSurface": "Supple Leather, Raw Edge",
        "cueStructure": "Slender Strap, Sculpted Heel",
        "cueAccent": "Fringed Detail, Buckled Closure"
      },
      {
        "id": "item-58",
        "idxLabel": "[58]",
        "brand": "Jimmy Choo",
        "price": "840 EUR",
        "imgSrc": "/mock/LOWER/P01115823 Background Removed.png",
        "artsyName": "Citrus Horizon",
        "artsyDesc": "Woven fibers of orange and terracotta converge in a substantial form, supported by a raised, cork foundation. Metallic silver hardware punctuates the surface, a geometric counterpoint to the broad expanse of the structure, suggesting a deliberate stride.",
        "cuePalette": "Terracotta, Tangerine, Coral",
        "cueSurface": "Woven Raffia, Cork Base",
        "cueStructure": "Platform Sole, Broad Stride",
        "cueAccent": "Metallic Buckle, Geometric Detail"
      },
      {
        "id": "item-59",
        "idxLabel": "[59]",
        "brand": "Brunello Cucinelli",
        "price": "1740 EUR",
        "imgSrc": "/mock/LOWER/P01139969 Background Removed.png",
        "artsyName": "Gilded Ascent",
        "artsyDesc": "Burnished metallic leather, possessing a supple grain, forms an enveloping structure around the foot. Knit trims and faceted brass beads, catching the light with a honeyed glow, trace angular lines along the surface, secured by woven lacings.",
        "cuePalette": "Gold Leaf, Bronze, Honey",
        "cueSurface": "Metallic Leather, Supple Grain",
        "cueStructure": "Chunky Sole, Ankle Wrap",
        "cueAccent": "Woven Laces, Angular Profile"
      },
      {
        "id": "item-60",
        "idxLabel": "[60]",
        "brand": "Roxanne First",
        "price": "3040 EUR",
        "imgSrc": "/mock/LOWER/P01107862 Background Removed.png",
        "artsyName": "Ephemeral Bloom",
        "artsyDesc": "Rose gold, alloyed to fourteen karats, descends in a delicate chain, culminating in a cluster of pavé-set pink sapphires. The stones, each a fraction of a carat, emit a pale luminescence against the polished facets of the metal.",
        "cuePalette": "Rose, Garnet, Pale Gold",
        "cueSurface": "Polished Facets, Delicate Chain",
        "cueStructure": "Linear Descent, Central Focus",
        "cueAccent": "Gemstone Cluster, Fine Link"
      }
    ]
  },
  {
    "key": "SILHOUETTE",
    "title": "Silhouette",
    "items": [
      {
        "id": "item-21",
        "idxLabel": "[21]",
        "brand": "Vince",
        "price": "1360 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01085154 Background Removed.png",
        "artsyName": "Linear Descent",
        "artsyDesc": "Dense knit forms a long, streamlined silhouette, presented in shades of graphite and ebony. Vertical texture defines the surface, subtly articulated by delicate frills at the edges and smooth, dark material composition containing cotton, polyester, and elastane.",
        "cuePalette": "Onyx, Charcoal, Graphite",
        "cueSurface": "Fine Ribbing, Dense Knit",
        "cueStructure": "Long Line, Streamlined Cut",
        "cueAccent": "Vertical Texture, Minimal Form"
      },
      {
        "id": "item-22",
        "idxLabel": "[22]",
        "brand": "Loro Piana",
        "price": "2520 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01107131 Background Removed.png",
        "artsyName": "Cashmere Cloud",
        "artsyDesc": "An expanse of soft cashmere in ecru and stone provides a relaxed form. The subtle texture of the pile engages a rounded neck, while cable knit patterns create visual interest in the warm, neutral tone.",
        "cuePalette": "Ecru, Oat, Stone",
        "cueSurface": "Soft Pile, Subtle Texture",
        "cueStructure": "Relaxed Fit, Rounded Neck",
        "cueAccent": "Cable Knit, Warm Tone"
      },
      {
        "id": "item-23",
        "idxLabel": "[23]",
        "brand": "Loewe",
        "price": "870 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01112238 Background Removed.png",
        "artsyName": "Retro Motion",
        "artsyDesc": "Panels of ivory suede and white technical fabric compose a low profile form, accented by leather detailing. A curved sole extends upward, defined by grooved rubber that curls into a segmented structure.",
        "cuePalette": "Ivory, Cream, Tan",
        "cueSurface": "Smooth Suede, Clean Canvas",
        "cueStructure": "Low Profile, Curved Sole",
        "cueAccent": "Gum Rubber, Wavy Detail"
      },
      {
        "id": "item-24",
        "idxLabel": "[24]",
        "brand": "McQueen",
        "price": "2480 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01145257 Background Removed.png",
        "artsyName": "Iridescent Cascade",
        "artsyDesc": "A delicate arc of polished facets and a flowing chain suspend clustered elements. Silver and gold links bind the faux pearls, creating a gradated descent of shimmering material.",
        "cuePalette": "Cream, Champagne, Silver",
        "cueSurface": "Polished Facets, Fluid Chain",
        "cueStructure": "Gradated Descent, Delicate Arc",
        "cueAccent": "Crystallized Clusters, Gilded Links"
      },
      {
        "id": "item-25",
        "idxLabel": "[25]",
        "brand": "Loro Piana",
        "price": "2030 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01146483 Background Removed.png",
        "artsyName": "Urban Silhouette",
        "artsyDesc": "Matte twill structured into a rounded crown and subtly piped, presents a dark surface. An embroidered emblem anchors a slate and ivory color scheme in a resilient polyethylene membrane.",
        "cuePalette": "Charcoal, Slate, Ivory",
        "cueSurface": "Matte Twill, Crisp Brim",
        "cueStructure": "Rounded Crown, Structured Visor",
        "cueAccent": "Embroidered Emblem, Subtle Piping"
      },
      {
        "id": "item-61",
        "idxLabel": "[61]",
        "brand": "Gabriela Hearst",
        "price": "1360 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01146510 Background Removed.png",
        "artsyName": "Winter Cloud",
        "artsyDesc": "An expanse of ivory cashmere, loosely knit, yields a voluminous form with a relaxed, dropped shoulder. The material possesses a soft pile, its surface subtly textured, suggesting warmth and ease.",
        "cuePalette": "Cream, Chalk, Ivory",
        "cueSurface": "Lofty Knit, Soft Pile",
        "cueStructure": "Oversized Volume, Dropped Shoulder",
        "cueAccent": "Textured Weave, Relaxed Silhouette"
      },
      {
        "id": "item-62",
        "idxLabel": "[62]",
        "brand": "Christopher Esber",
        "price": "2520 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01155597 Background Removed.png",
        "artsyName": "Twisted Orbit",
        "artsyDesc": "Jet-black cotton jersey is sculpted into an asymmetric drape, the fabric possessing a subtle sheen. A gold-toned embellishment, precisely positioned, anchors the minimalist form with a metallic accent.",
        "cuePalette": "Jet, Onyx, Charcoal",
        "cueSurface": "Smooth Jersey, Subtle Sheen",
        "cueStructure": "Sculpted Twist, Asymmetric Drape",
        "cueAccent": "Metallic Hardware, Minimalist Form"
      },
      {
        "id": "item-63",
        "idxLabel": "[63]",
        "brand": "Lemaire",
        "price": "870 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01158857 Background Removed.png",
        "artsyName": "Shadowed Ease",
        "artsyDesc": "Dark leather, treated to a supple finish, conforms to a streamlined profile. A low heel and rounded toe contribute to the overall smoothness, the surface marked only by clean, deliberate seams.",
        "cuePalette": "Ebony, Graphite, Umber",
        "cueSurface": "Pebbled Leather, Supple Finish",
        "cueStructure": "Streamlined Profile, Low Heel",
        "cueAccent": "Rounded Toe, Clean Seam"
      },
      {
        "id": "item-64",
        "idxLabel": "[64]",
        "brand": "The Attico",
        "price": "2480 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01159255 Background Removed.png",
        "artsyName": "Bronze Embrace",
        "artsyDesc": "Copper-toned goat leather, polished to a sheen, forms delicate straps that trace the foot and ascend the leg. The flat sole provides a grounding base to the intricate lacework, creating a sculpted bed for the foot.",
        "cuePalette": "Terracotta, Copper, Rust",
        "cueSurface": "Metallic Leather, Polished Sheen",
        "cueStructure": "Delicate Strap, Flat Sole",
        "cueAccent": "Lace-Up Detail, Sculpted Bed"
      },
      {
        "id": "item-65",
        "idxLabel": "[65]",
        "brand": "Loro Piana",
        "price": "2030 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01160410 Background Removed.png",
        "artsyName": "Woven Grid Descent",
        "artsyDesc": "Silk sablé, a pale beige hue, is rendered into a series of fine pleats, creating vertical channels that define the form. A subtle checkering pattern is woven into the fabric, lending a delicate texture to the linear descent.",
        "cuePalette": "Cream, Russet, Pale Beige",
        "cueSurface": "Fine Pleats, Textured Weave",
        "cueStructure": "Linear Descent, Vertical Channels",
        "cueAccent": "Subtle Checkering, Delicate Lines"
      },
      {
        "id": "item-66",
        "idxLabel": "[66]",
        "brand": "Gucci",
        "price": "2660 EUR",
        "imgSrc": "/mock/SILHOUETTE/P01166002 Background Removed.png",
        "artsyName": "Botanical Reverie",
        "artsyDesc": "Lustrous silk twill, saturated in burgundy, serves as a flat plane for a dense arrangement of floral motifs. Insect forms intertwine with lush blooms, creating a vibrant surface alive with color and detail.",
        "cuePalette": "Burgundy, Emerald, Rose",
        "cueSurface": "Satin Sheen, Floral Print",
        "cueStructure": "Dense Arrangement, Flat Plane",
        "cueAccent": "Insect Motifs, Lush Bloom"
      },
      {
        "id": "item-67",
        "idxLabel": "[67]",
        "brand": "Balenciaga",
        "price": "1330 EUR",
        "imgSrc": "/mock/SILHOUETTE/P00996469 Background Removed.png",
        "artsyName": "Neutral Horizon",
        "artsyDesc": "A blend of cotton and polyester creates a textured knit, forming a relaxed silhouette with subtle ribbing. A vertical zip closure defines the front of the structure, offering a minimalist form in shades of ivory and stone.",
        "cuePalette": "Ivory, Chalk, Stone",
        "cueSurface": "Textured Knit, Soft Pile",
        "cueStructure": "Relaxed Silhouette, Vertical Zip",
        "cueAccent": "Subtle Ribbing, Minimalist Form"
      }
    ]
  },
  {
    "key": "GROUND",
    "title": "Ground",
    "items": [
      {
        "id": "item-26",
        "idxLabel": "[26]",
        "brand": "Oscar de la Renta",
        "price": "2660 EUR",
        "imgSrc": "/mock/GROUND/P01115803%20Background%20Removed.png",
        "artsyName": "Botanical Reverie",
        "artsyDesc": "Voluminous sleeves give shape to an indigo and porcelain surface, exhibiting flowing silk. A fitted waist and delicate butterfly detailing accentuate the cotton-blend poplin layered with full cotton lining.",
        "cuePalette": "Indigo, Porcelain, Verdant",
        "cueSurface": "Flowing Silk, Soft Drape",
        "cueStructure": "Voluminous Sleeves, Fitted Waist",
        "cueAccent": "Floral Motif, Butterfly Detail"
      },
      {
        "id": "item-27",
        "idxLabel": "[27]",
        "brand": "Jil Sander",
        "price": "1330 EUR",
        "imgSrc": "/mock/GROUND/P01126050 Background Removed.png",
        "artsyName": "Minimalist Shelter",
        "artsyDesc": "Structured in a boxy form, a high neck and angular collar build an umber and chocolate silhouette. Geometric seams define the smooth cotton surface in an artful, minimalist composition.",
        "cuePalette": "Umber, Chocolate, Taupe",
        "cueSurface": "Smooth Cotton, Matte Finish",
        "cueStructure": "Boxy Form, High Neck",
        "cueAccent": "Geometric Seams, Angular Collar"
      },
      {
        "id": "item-28",
        "idxLabel": "[28]",
        "brand": "Bottega Veneta",
        "price": "1810 EUR",
        "imgSrc": "/mock/GROUND/P01130519 Background Removed.png",
        "artsyName": "Sculpted Terrain",
        "artsyDesc": "Supple calf leather forms a streamlined profile held aloft by a chunky sole. Lugged rubber treads grip a dark surface, accentuated by elastic gussets and a subtle polished sheen.",
        "cuePalette": "Ebony, Jet, Shadow",
        "cueSurface": "Supple Leather, Polished Sheen",
        "cueStructure": "Streamlined Profile, Chunky Sole",
        "cueAccent": "Elastic Gussets, Rugged Tread"
      },
      {
        "id": "item-29",
        "idxLabel": "[29]",
        "brand": "Valentino",
        "price": "1000 EUR",
        "imgSrc": "/mock/GROUND/P01139054 Background Removed.png",
        "artsyName": "Crimson Aperture",
        "artsyDesc": "Silk crepe drapes into a slightly a-line silhouette, presented in saturated terracotta and russet tones. Golden hardware accents folded pockets on this flowing form.",
        "cuePalette": "Scarlet, Terracotta, Russet",
        "cueSurface": "Supple Crepe, Matte Finish",
        "cueStructure": "Slightly A-Line, Boxy Silhouette",
        "cueAccent": "Golden Hardware, Folded Pockets"
      },
      {
        "id": "item-30",
        "idxLabel": "[30]",
        "brand": "Miu Miu",
        "price": "3380 EUR",
        "imgSrc": "/mock/GROUND/P01163665 Background Removed.png",
        "artsyName": "Pearlized Constellation",
        "artsyDesc": "Velvet pile and patent leather combine in a curved structure, anchored by a block heel. Polished studs and chain embellishments decorate the smooth, dark exterior of this slingback form.",
        "cuePalette": "Onyx, Pearl, Silver",
        "cueSurface": "Velvet Pile, Patent Leather",
        "cueStructure": "Curved Slingback, Block Heel",
        "cueAccent": "Chain Embellishment, Polished Studs"
      },
      {
        "id": "item-31",
        "idxLabel": "[31]",
        "brand": "Rabanne",
        "price": "1990 EUR",
        "imgSrc": "/mock/GROUND/P01168094 Background Removed.png",
        "artsyName": "Ivory Reverie",
        "artsyDesc": "A pale expanse of polyester defines this form, possessing a weightless quality suggestive of drifting vapor. Delicate scalloped edges and fine eyelet detailing trace the column silhouette, while a buttoned placket anchors the structure with a subtle linearity.",
        "cuePalette": "Cream, Pearl, Vanilla",
        "cueSurface": "Delicate Scallop, Fine Eyelet",
        "cueStructure": "Column Silhouette, Gentle Gather",
        "cueAccent": "Buttoned Placket, Ruffled Hem"
      },
      {
        "id": "item-32",
        "idxLabel": "[32]",
        "brand": "Miu Miu",
        "price": "1190 EUR",
        "imgSrc": "/mock/GROUND/P01086690 Background Removed.png",
        "artsyName": "Amethyst Bloom",
        "artsyDesc": "Lustrous satin, rendered in shades of plum, forms an elevated stance with a curved platform. Strappy construction and a large bow detail create a playful tension against the polished sheen, hinting at a retro sensibility.",
        "cuePalette": "Plum, Lavender, Lilac",
        "cueSurface": "Satin Sheen, Polished Finish",
        "cueStructure": "Curved Platform, Elevated Stance",
        "cueAccent": "Bow Detail, Strappy Form"
      },
      {
        "id": "item-68",
        "idxLabel": "[68]",
        "brand": "The Attico",
        "price": "1810 EUR",
        "imgSrc": "/mock/GROUND/P01106285 Background Removed.png",
        "artsyName": "Emerald Radiance",
        "artsyDesc": "Metallic green leather forms a sharply defined structure, the surface reflecting light with a high gloss. Ankle straps, secured by buckles, bisect the open toe, creating a tension between constraint and exposure, while the cylindrical heels rise with a lacquered finish.",
        "cuePalette": "Chartreuse, Lime, Jade",
        "cueSurface": "Metallic Sheen, High Gloss",
        "cueStructure": "Sculpted Heel, Open Toe",
        "cueAccent": "Ankle Strap, Bold Curve"
      },
      {
        "id": "item-69",
        "idxLabel": "[69]",
        "brand": "Etro",
        "price": "1000 EUR",
        "imgSrc": "/mock/GROUND/P01125177 Background Removed.png",
        "artsyName": "Paisley Cascade",
        "artsyDesc": "A slim, elongated form is draped in pure silk jacquard, its surface alive with a repeating motif in shades of ebony, gold, and sapphire. Fringed edges define the perimeter of the material, accentuating its fluid drape and intricate detail.",
        "cuePalette": "Ebony, Gold, Sapphire",
        "cueSurface": "Silk Jacquard, Fluid Drape",
        "cueStructure": "Elongated Form, Repeating Motif",
        "cueAccent": "Intricate Detail, Fringed Edges"
      },
      {
        "id": "item-70",
        "idxLabel": "[70]",
        "brand": "Blumarine",
        "price": "3380 EUR",
        "imgSrc": "/mock/GROUND/P01128250 Background Removed.png",
        "artsyName": "Autumnal Embrace",
        "artsyDesc": "Dense shearling, a combination of chestnut, tawny, and umber tones, creates a shaggy texture and rounded silhouette. An open front reveals a polyester lining beneath the substantial pile, contrasting with the hook-fastening closure.",
        "cuePalette": "Chestnut, Tawny, Umber",
        "cueSurface": "Dense Pile, Shaggy Texture",
        "cueStructure": "Rounded Silhouette, Compact Form",
        "cueAccent": "High Collar, Open Front"
      },
      {
        "id": "item-71",
        "idxLabel": "[71]",
        "brand": "Asceno",
        "price": "1990 EUR",
        "imgSrc": "/mock/GROUND/P01130192 Background Removed.png",
        "artsyName": "Verdant Cascade",
        "artsyDesc": "Crinkled linen, in varying shades of emerald and chartreuse, falls in a fluid drape, gathering at the neckline and expanding to a voluminous hem. Tiered ruffles accentuate the silhouette, creating a sense of airy movement.",
        "cuePalette": "Emerald, Chartreuse, Lime",
        "cueSurface": "Crinkled Linen, Fluid Drape",
        "cueStructure": "Gathered Neckline, Voluminous Hem",
        "cueAccent": "Tiered Ruffle, Halter Style"
      },
      {
        "id": "item-72",
        "idxLabel": "[72]",
        "brand": "Brunello Cucinelli",
        "price": "1190 EUR",
        "imgSrc": "/mock/GROUND/P01158548 Background Removed.png",
        "artsyName": "Coastal Drift",
        "artsyDesc": "Smooth suede, in tones of stone and taupe, forms a low profile with a rounded toe. Shearling, both as trim and lining, offers a soft nap, while signature Monili beads provide subtle texture and a delicate sheen.",
        "cuePalette": "Stone, Taupe, Sand",
        "cueSurface": "Suede Grain, Soft Nap",
        "cueStructure": "Low Profile, Rounded Toe",
        "cueAccent": "Shearling Trim, Lace Closure"
      },
      {
        "id": "item-73",
        "idxLabel": "[73]",
        "brand": "Winnie New York",
        "price": "2580 EUR",
        "imgSrc": "/mock/GROUND/P01166664 Background Removed.png",
        "artsyName": "Washed Horizon",
        "artsyDesc": "Pale indigo and sky blue cotton composes a relaxed form, marked by patchwork panels and raw edges. Visible topstitching delineates the straight legs, and utility pockets punctuate the faded denim surface.",
        "cuePalette": "Pale Indigo, Sky Blue",
        "cueSurface": "Faded Denim, Raw Edge",
        "cueStructure": "Straight Leg, Relaxed Fit",
        "cueAccent": "Patchwork Panels, Utility Pockets"
      },
      {
        "id": "item-74",
        "idxLabel": "[74]",
        "brand": "Balenciaga",
        "price": "1130 EUR",
        "imgSrc": "/mock/GROUND/P01170520 Background Removed.png",
        "artsyName": "Rosy Bloom",
        "artsyDesc": "A compact silhouette is constructed from a bouclé knit, its surface dense with a subtle sheen in shades of pale rose and cream. The defined waist contrasts with the textured surface, creating a contained form.",
        "cuePalette": "Pale Rose, Cream, Blush",
        "cueSurface": "Bouclé Knit, Dense Pile",
        "cueStructure": "Compact Silhouette, Defined Waist",
        "cueAccent": "Textured Surface, Subtle Sheen"
      },
      {
        "id": "item-75",
        "idxLabel": "[75]",
        "brand": "Zegna",
        "price": "1990 EUR",
        "imgSrc": "/mock/GROUND/P01100969%20Background%20Removed.png",
        "artsyName": "Urban Drift",
        "artsyDesc": "A streamlined profile is achieved through the combination of fabric and smooth leather, presented in charcoal, stone, and off-white. A low profile is emphasized by minimalist lines and a contrasting sole, while triple-crossed elastics define the structure.",
        "cuePalette": "Charcoal, Stone, Off White",
        "cueSurface": "Suede Upper, Smooth Leather",
        "cueStructure": "Streamlined Profile, Low Profile",
        "cueAccent": "Contrast Sole, Minimalist Lines"
      }
    ]
  },
  {
    "key": "ARTIFACTS",
    "title": "Artifacts",
    "items": [
      {
        "id": "item-33",
        "idxLabel": "[33]",
        "brand": "Rebecca Vallance",
        "price": "2580 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01127220 Background Removed.png",
        "artsyName": "Pale Authority",
        "artsyDesc": "A boxy contour is established through a twill structure, possessing a smooth surface and a blend of polyester and viscose. Tonal buttons punctuate the front of this form, while patch pockets suggest a utilitarian grounding.",
        "cuePalette": "Butter, Bisque, Cream",
        "cueSurface": "Structured Twill, Smooth Finish",
        "cueStructure": "Boxy Contour, Double Breasted",
        "cueAccent": "Buttoned Front, Patch Pockets"
      },
      {
        "id": "item-34",
        "idxLabel": "[34]",
        "brand": "Norma Kamali",
        "price": "1130 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01131706 Background Removed.png",
        "artsyName": "Whispered Layers",
        "artsyDesc": "Semi-sheer lace and textured mesh cascade in tiered layers, creating a fluid drape with a delicate lightness. Ribbon detailing and ruffled edges accentuate the form, revealing a structure defined by elasticity and nylon.",
        "cuePalette": "Snow, Ivory, Chalk",
        "cueSurface": "Sheer Lace, Textured Mesh",
        "cueStructure": "Tiered Cascade, Fluid Drape",
        "cueAccent": "Ribbon Bow, Ruffled Edge"
      },
      {
        "id": "item-35",
        "idxLabel": "[35]",
        "brand": "Toteme",
        "price": "1990 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01140039 Background Removed.png",
        "artsyName": "Shadow Stream",
        "artsyDesc": "Canvas and leather converge in a streamlined profile, a study in minimalist form and contrast. Supple leather trims define the edges, while graphite and onyx tones suggest a subdued, grounded presence.",
        "cuePalette": "Onyx, Graphite, Coal",
        "cueSurface": "Canvas Texture, Leather Trim",
        "cueStructure": "Streamlined Profile, Low Profile",
        "cueAccent": "Contrast Piping, Minimalist Form"
      },
      {
        "id": "item-36",
        "idxLabel": "[36]",
        "brand": "Citizens of Humanity",
        "price": "4140 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01145582 Background Removed.png",
        "artsyName": "Indigo Wash",
        "artsyDesc": "Woven from a blend of cotton, this form possesses a softly worn surface and a relaxed silhouette. A boxy cut and buttoned placket contribute to its casual structure, reflecting the subtle nuances of indigo-dyed denim.",
        "cuePalette": "Denim Blue, Faded Indigo",
        "cueSurface": "Softly Worn, Distressed Finish",
        "cueStructure": "Relaxed Silhouette, Boxy Cut",
        "cueAccent": "Buttoned Placket, Patch Pocket"
      },
      {
        "id": "item-37",
        "idxLabel": "[37]",
        "brand": "Alexandre Vauthier",
        "price": "3490 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01145719 Background Removed.png",
        "artsyName": "Liquid Chrome",
        "artsyDesc": "A highly polished, metallic surface reflects light with an arresting sheen, forming a slouching silhouette that culminates in a pointed toe. The structure is sharply defined by a stiletto heel and secured with a zip closure.",
        "cuePalette": "Mirror Silver, Metallic Sheen",
        "cueSurface": "High Polish, Reflective Coating",
        "cueStructure": "Pointed Toe, Slouching Form",
        "cueAccent": "Stiletto Heel, Zip Closure"
      },
      {
        "id": "item-38",
        "idxLabel": "[38]",
        "brand": "JW Anderson",
        "price": "2050 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01151263 Background Removed.png",
        "artsyName": "Coral Embellishment",
        "artsyDesc": "Bright coral goat leather is punctuated by chunky, transparent chain links, creating a striking juxtaposition of texture and form. A low profile and slip-on style offer a casual counterpoint to the assertive chain detail.",
        "cuePalette": "Bright Coral, Clear Acrylic",
        "cueSurface": "Pebbled Leather, Smooth Finish",
        "cueStructure": "Slip-On Style, Low Profile",
        "cueAccent": "Chain Detail, Cork Sole"
      },
      {
        "id": "item-39",
        "idxLabel": "[39]",
        "brand": "Ruslan Baginskiy",
        "price": "3720 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01151268 Background Removed.png",
        "artsyName": "Golden Halo",
        "artsyDesc": "Woven entirely from natural straw, this circular form casts a wide shadow with its gently sloping brim. The coarse weave reveals the material’s inherent texture, suggesting a connection to the earth and its raw materials.",
        "cuePalette": "Wheat, Honey, Sandstone",
        "cueSurface": "Coarse Weave, Natural Fiber",
        "cueStructure": "Wide Brim, Gentle Slope",
        "cueAccent": "Woven Texture, Circular Form"
      },
      {
        "id": "item-40",
        "idxLabel": "[40]",
        "brand": "Dries Van Noten",
        "price": "3500 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01121893 Background Removed.png",
        "artsyName": "Floral Reverie",
        "artsyDesc": "A linen-blend jacquard material drapes with a subtle sheen, defining a tailored silhouette with a defined shoulder. A botanical motif is woven into the fabric, hinting at a delicate pattern within the structure.",
        "cuePalette": "Seafoam, Jade, Celadon",
        "cueSurface": "Slight Sheen, Fluid Drape",
        "cueStructure": "Tailored Silhouette, Defined Shoulder",
        "cueAccent": "Botanical Motif, Subtle Pattern"
      },
      {
        "id": "item-76",
        "idxLabel": "[76]",
        "brand": "Givenchy",
        "price": "4140 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01123273 Background Removed.png",
        "artsyName": "Ebony Geometry",
        "artsyDesc": "Dark brown calfskin defines an architectural form with rigid volume, its smooth, fine grain surface accented by gold-toned hardware. Sculpted handles and an adjustable, detachable shoulder strap complete the structure.",
        "cuePalette": "Deep Espresso, Polished Ebony",
        "cueSurface": "Smooth Calfskin, Fine Grain",
        "cueStructure": "Architectural Form, Rigid Volume",
        "cueAccent": "Gold Hardware, Sculpted Handles"
      },
      {
        "id": "item-77",
        "idxLabel": "[77]",
        "brand": "Dolce&Gabbana",
        "price": "3490 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01132479 Background Removed.png",
        "artsyName": "Shadow Play",
        "artsyDesc": "Stretch-fused fabric, in jet black, adheres to the body in a second skin fit, punctuated by asymmetric lines and exposed zippers. Cutout details disrupt the surface, revealing glimpses of the form beneath.",
        "cuePalette": "Jet Black, Onyx",
        "cueSurface": "Stretch Knit, Supple Finish",
        "cueStructure": "Second Skin Fit, Cutout Details",
        "cueAccent": "Asymmetric Lines, Exposed Zippers"
      },
      {
        "id": "item-78",
        "idxLabel": "[78]",
        "brand": "Valentino Garavani",
        "price": "2050 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01133354 Background Removed.png",
        "artsyName": "Nocturnal Garden",
        "artsyDesc": "Jet black calf leather forms a delicate structure, secured by a buckle around the ankle. A glossy sheen coats the surface, punctuated by crystal embellishments arranged in a floral motif, evoking a sense of contained opulence.",
        "cuePalette": "Jet, Crimson, Pearl",
        "cueSurface": "Patent Leather, Glossy Sheen",
        "cueStructure": "Delicate Straps, Stiletto Heel",
        "cueAccent": "Crystal Embellishments, Floral Motif"
      },
      {
        "id": "item-79",
        "idxLabel": "[79]",
        "brand": "Oscar de la Renta",
        "price": "3720 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01137970 Background Removed.png",
        "artsyName": "Solar Radiance",
        "artsyDesc": "A luminous yellow wool-blend fabric drapes with a smooth satin surface and a crepe-like backing. The fitted bodice gives way to flared sleeves, creating a volume that suggests a fleeting, honeyed warmth.",
        "cuePalette": "Lemon, Butter, Honeyed Gold",
        "cueSurface": "Smooth Satin, Crepe Back",
        "cueStructure": "Fitted Bodice, Flared Sleeves",
        "cueAccent": "Draped Volume, Keyhole Neckline"
      },
      {
        "id": "item-80",
        "idxLabel": "[80]",
        "brand": "Fusalp",
        "price": "3500 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01146020 Background Removed.png",
        "artsyName": "Subtle Descent",
        "artsyDesc": "Sleek jersey, a fine gauge knit, clings to a streamlined form in shades of onyx and charcoal. A metallic zip bisects the structure, offering a minimalist point of access.",
        "cuePalette": "Onyx, Charcoal, Graphite",
        "cueSurface": "Fine Gauge Knit, Sleek Jersey",
        "cueStructure": "Streamlined Silhouette, Fitted Form",
        "cueAccent": "Metallic Zip, Minimalist Closure"
      },
      {
        "id": "item-81",
        "idxLabel": "[81]",
        "brand": "Isabel Marant",
        "price": "1990 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01151191 Background Removed.png",
        "artsyName": "Worn Horizon",
        "artsyDesc": "Organic cotton, washed to an ink wash and stone grey, exhibits a distressed surface with raw edges. Exposed hardware punctuates the low rise and relaxed waist, suggesting a casual, utilitarian strength.",
        "cuePalette": "Ink Wash, Stone Grey, Faded Black",
        "cueSurface": "Distressed Denim, Raw Edge",
        "cueStructure": "Low Rise, Relaxed Waist",
        "cueAccent": "Exposed Hardware, Zippered Fly"
      },
      {
        "id": "item-82",
        "idxLabel": "[82]",
        "brand": "Victoria Beckham",
        "price": "4140 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01156567 Background Removed.png",
        "artsyName": "Verdant Field",
        "artsyDesc": "A textured weave of viscose and a trace of elastane creates a crisp twill, dyed in shades of lime and chartreuse. A pressed crease defines the straight leg and high waist, establishing a tailored formality.",
        "cuePalette": "Lime, Chartreuse, Jade",
        "cueSurface": "Textured Weave, Crisp Twill",
        "cueStructure": "Straight Leg, High Waist",
        "cueAccent": "Pressed Crease, Tailored Finish"
      },
      {
        "id": "item-83",
        "idxLabel": "[83]",
        "brand": "Loro Piana",
        "price": "3490 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01173315 Background Removed.png",
        "artsyName": "Ivory Cascade",
        "artsyDesc": "Cotton, silk, wool, linen, viscose, and polyester intertwine in a quilted texture, draping softly in shades of ecru and cream. A braided drawstring cinches the gathered waist, offering a delicate relief to the volume.",
        "cuePalette": "Ecru, Cream, Pearl",
        "cueSurface": "Quilted Texture, Soft Drape",
        "cueStructure": "Wide Leg, Gathered Waist",
        "cueAccent": "Braided Drawstring, Delicate Relief"
      },
      {
        "id": "item-84",
        "idxLabel": "[84]",
        "brand": "Alex Perry",
        "price": "2050 EUR",
        "imgSrc": "/mock/ARTIFACTS/P01118119 Background Removed.png",
        "artsyName": "Burnt Horizon",
        "artsyDesc": "Grained leather, in shades of umber and sable, forms a compact silhouette with a defined waist. Subtle creasing and a raw edge suggest a history of wear, a suppleness earned over time.",
        "cuePalette": "Charcoal, Umber, Sable",
        "cueSurface": "Distressed Grain, Supple Sheen",
        "cueStructure": "Defined Waist, Compact Form",
        "cueAccent": "Subtle Creasing, Raw Edge"
      }
    ]
  }
];

const PRE_OWNED_ITEM_IDS = new Set<string>(["item-03", "item-17", "item-52", "item-79"]);

export const sections: MockCatalogSection[] = rawSections.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    status: PRE_OWNED_ITEM_IDS.has(item.id) ? "pre-owned" : "new",
  })),
}));

export const archiveCapsuleIds = ["main", "capsule1", "capsule2", "capsule3"] as const;
export type ArchiveCapsuleId = (typeof archiveCapsuleIds)[number];

const ARCHIVE_ITEMS_PER_CAPSULE = 10;
const ARCHIVE_PREVIEW_SHORT_CAPSULE_ITEMS = 4;

function seededShuffle<T>(input: T[], seed: number): T[] {
  let state = seed >>> 0;
  const arr = [...input];

  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function takeWithWrap<T>(items: T[], start: number, size: number): T[] {
  if (items.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < size; i += 1) {
    out.push(items[(start + i) % items.length]);
  }
  return out;
}

const shuffledArchiveItems = seededShuffle(
  sections.flatMap((section) => section.items),
  190734,
);

export const archiveCapsuleItems: Record<ArchiveCapsuleId, MockCatalogItem[]> = {
  main: takeWithWrap(shuffledArchiveItems, 0, ARCHIVE_ITEMS_PER_CAPSULE),
  capsule1: takeWithWrap(shuffledArchiveItems, ARCHIVE_ITEMS_PER_CAPSULE, ARCHIVE_ITEMS_PER_CAPSULE),
  capsule2: [],
  capsule3: takeWithWrap(shuffledArchiveItems, ARCHIVE_ITEMS_PER_CAPSULE * 3, ARCHIVE_PREVIEW_SHORT_CAPSULE_ITEMS),
};
