import {expect,it} from "vitest";
import {localShopAnswer,SHOP_ASSISTANT_SUGGESTIONS} from "../lib/store/shop-assistant";
import {customerServiceCopy} from "../lib/store/customer-service-copy";
it("explains categories without inventing products",()=>{
 expect(SHOP_ASSISTANT_SUGGESTIONS).toHaveLength(4);
 expect(localShopAnswer("كيف أختار القسم المناسب؟","sa",[])).toContain("المطبخ والقهوة");
 expect(localShopAnswer("هل توجد منتجات؟","sa",[])).toContain("ما لقيت منتجات");
});
it("responds only with really displayed approved product titles",()=>{
 const rows=[{listing_id:"verified",slug:"approved",title:"منتج معتمد",price_minor:"1500",currency:"SAR"}];
 const answer=localShopAnswer("أريني المنتجات المتاحة","sa",rows);
 expect(answer).toContain("منتج معتمد");expect(answer).not.toContain("خصم");
});
it("does not invent unsupported shipping, offers or supplier return windows",()=>{
 expect(localShopAnswer("كم يستغرق التوصيل؟","ae",[])).toContain(customerServiceCopy.ae.shipping);
 expect(localShopAnswer("كم يستغرق التوصيل؟","ae",[])).not.toMatch(/٢–٥ أيام|مجاني/);
 expect(localShopAnswer("هل لديك خصم؟","sa",[])).toContain("لا يمكنني");
});
it("keeps assistant COD, shipping and returns consistent with published service copy",()=>{
 for(const market of ["sa","ae","om","eg","iq"] as const){
  expect(localShopAnswer("هل الدفع عند الاستلام؟",market,[])).toBe(customerServiceCopy[market].payment);
  expect(localShopAnswer("كم رسوم الشحن؟",market,[])).toContain(customerServiceCopy[market].shipping);
  expect(localShopAnswer("كيف الاسترجاع؟",market,[])).toBe(customerServiceCopy[market].returns);
  expect(localShopAnswer("كم رسوم الشحن؟",market,[])).not.toMatch(/٢٨ ر.س|١٩ درهماً|٣ ريالات|٩٥ جنيه|٧٬٠٠٠ دينار/);
 }
});
