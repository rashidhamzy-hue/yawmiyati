import {expect,it} from "vitest";
import {publicBrowserConfig,stagingPublicConfig} from "../lib/store/staging-public-config";
it("prefers configured deployment keys over browser staging defaults",()=>{
 expect(publicBrowserConfig("https://production.example","pub")).toEqual({origin:"https://production.example",key:"pub"});
});
it("provides only public credentials for the Yawmiyati Lovable staging preview",()=>{
 const c=publicBrowserConfig(undefined,undefined);
 expect(c.origin).toBe("https://skhtunkknshvolturqlm.supabase.co");
 expect(c.key).toMatch(/^sb_publishable_/);
 expect(JSON.stringify(stagingPublicConfig)).not.toMatch(/service_role|sk_test|anthropic|woo_secret/i);
});
