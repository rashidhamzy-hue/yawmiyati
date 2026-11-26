/**
 * Editorial lifestyle photography — externally hosted Unsplash photographs,
 * not supplier merchandise or evidence of Yawmiyati stock.
 * All seven photographs were checked as Unsplash License (free commercial use)
 * on 2026-11-20. Sources and authors: docs/EDITORIAL-IMAGE-SOURCES.md.
 *
 * These replace Lovable-only /__l5e/ asset pointers which do not work in
 * standalone GitHub/Vite deployment. Hosting is currently Unsplash CDN.
 * Self-hosted versions may replace these URLs without touching page code.
 * p1–p8 (legacy illustrative photos, never real merchandise) are bundled
 * from src/assets since the Lovable retirement on 26 Nov 2026.
 */
import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";
import p5 from "@/assets/p5.jpg";
import p6 from "@/assets/p6.jpg";
import p7 from "@/assets/p7.jpg";
import p8 from "@/assets/p8.jpg";

const photo=(id:string,width:number)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=78`;
export const img={
 "hero":photo("photo-1767720580810-58be50f89bf8",1800),
 "cat-home":photo("photo-1762529716272-b316f61502e7",1200),
 "cat-kitchen":photo("photo-1765341448915-57b22d2c53ae",1200),
 "cat-beauty":photo("photo-1778373620793-a369943bf9b3",1000),
 "cat-fashion":photo("photo-1559563458-527698bf5295",1000),
 "cat-wellness":photo("photo-1675149476008-83dbfa2ee917",1000),
 "cat-organize":photo("photo-1652349566831-1b41ce15ba6c",1000),
 "p1":p1,"p2":p2,"p3":p3,"p4":p4,
 "p5":p5,"p6":p6,"p7":p7,"p8":p8,
} as const;
export type ImgKey=keyof typeof img;
