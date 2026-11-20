/**
 * Editorial lifestyle photography — externally hosted Unsplash photographs,
 * not supplier merchandise or evidence of Yawmiyati stock.
 * All seven photographs were checked as Unsplash License (free commercial use)
 * on 2026-11-20. Sources and authors: docs/EDITORIAL-IMAGE-SOURCES.md.
 *
 * These replace Lovable-only /__l5e/ asset pointers which do not work in
 * standalone GitHub/Vite deployment. Hosting is currently Unsplash CDN.
 * Self-hosted versions may replace these URLs without touching page code.
 */
import p1 from "@/assets/p1.jpg.asset.json";
import p2 from "@/assets/p2.jpg.asset.json";
import p3 from "@/assets/p3.jpg.asset.json";
import p4 from "@/assets/p4.jpg.asset.json";
import p5 from "@/assets/p5.jpg.asset.json";
import p6 from "@/assets/p6.jpg.asset.json";
import p7 from "@/assets/p7.jpg.asset.json";
import p8 from "@/assets/p8.jpg.asset.json";

const photo=(id:string,width:number)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=78`;
export const img={
 "hero":photo("photo-1767720580810-58be50f89bf8",1800),
 "cat-home":photo("photo-1762529716272-b316f61502e7",1200),
 "cat-kitchen":photo("photo-1765341448915-57b22d2c53ae",1200),
 "cat-beauty":photo("photo-1778373620793-a369943bf9b3",1000),
 "cat-fashion":photo("photo-1559563458-527698bf5295",1000),
 "cat-wellness":photo("photo-1675149476008-83dbfa2ee917",1000),
 "cat-organize":photo("photo-1652349566831-1b41ce15ba6c",1000),
 "p1":p1.url,"p2":p2.url,"p3":p3.url,"p4":p4.url,
 "p5":p5.url,"p6":p6.url,"p7":p7.url,"p8":p8.url,
} as const;
export type ImgKey=keyof typeof img;
