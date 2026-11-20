import {expect,it} from "vitest";
import {localShopAnswer,SHOP_ASSISTANT_SUGGESTIONS} from "../lib/store/shop-assistant";
it("explains categories without inventing products",()=>{
 expect(SHOP_ASSISTANT_SUGGESTIONS).toHaveLength(4);
 expect(localShopAnswer("كيف أختار القسم المناسب؟","sa",[])).toContain("المطبخ والقهوة");
 expect(localShopAnswer("هل توجد منتجات؟","sa",[])).toContain("لا توجد منتجات");
});
it("responds only with real displayed approved product titles",()=>{
 const rows=[{listing_id:"verified",slug:"approved",title:"منتج معتمد",price_minor:"1500",currency:"SAR"}];
 const answer=localShopAnswer("أريني المنتجات المتاحة","sa",rows);
 expect(answer).toContain("منتج معتمد");
 expect(answer).not.toContain("خصم");
});
it("does not guess unsupported shipping and prices",()=>{
 expect(localShopAnswer("كم يستغرق التوصيل؟","ae",[])).not.toMatch(/٢–٥ أيام|مجاني/);
 expect(localShopAnswer("هل لديك خصم؟","sa",[])).toContain("لا يمكنني");
});
