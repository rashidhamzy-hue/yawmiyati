// Image URLs for the storefront (Lovable asset pointers).
import hero from "@/assets/hero.jpg.asset.json";
import cathome from "@/assets/cat-home.jpg.asset.json";
import catkitchen from "@/assets/cat-kitchen.jpg.asset.json";
import catbeauty from "@/assets/cat-beauty.jpg.asset.json";
import catfashion from "@/assets/cat-fashion.jpg.asset.json";
import catwellness from "@/assets/cat-wellness.jpg.asset.json";
import catorganize from "@/assets/cat-organize.jpg.asset.json";
import p1 from "@/assets/p1.jpg.asset.json";
import p2 from "@/assets/p2.jpg.asset.json";
import p3 from "@/assets/p3.jpg.asset.json";
import p4 from "@/assets/p4.jpg.asset.json";
import p5 from "@/assets/p5.jpg.asset.json";
import p6 from "@/assets/p6.jpg.asset.json";
import p7 from "@/assets/p7.jpg.asset.json";
import p8 from "@/assets/p8.jpg.asset.json";
export const img = {
  "hero": hero.url,
  "cat-home": cathome.url,
  "cat-kitchen": catkitchen.url,
  "cat-beauty": catbeauty.url,
  "cat-fashion": catfashion.url,
  "cat-wellness": catwellness.url,
  "cat-organize": catorganize.url,
  "p1": p1.url,
  "p2": p2.url,
  "p3": p3.url,
  "p4": p4.url,
  "p5": p5.url,
  "p6": p6.url,
  "p7": p7.url,
  "p8": p8.url,
} as const;
export type ImgKey = keyof typeof img;
