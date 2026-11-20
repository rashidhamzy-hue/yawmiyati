import type {MarketCode} from "./markets";
export const marketIdentity:Record<MarketCode,{name:string;fullName:string;flag:string;currencyLabel:string;currencyLong:string}>={
 sa:{name:"السعودية",fullName:"المملكة العربية السعودية",flag:"🇸🇦",currencyLabel:"ر.س",currencyLong:"ريال سعودي"},
 ae:{name:"الإمارات",fullName:"الإمارات العربية المتحدة",flag:"🇦🇪",currencyLabel:"د.إ",currencyLong:"درهم إماراتي"},
 om:{name:"عُمان",fullName:"سلطنة عُمان",flag:"🇴🇲",currencyLabel:"ر.ع",currencyLong:"ريال عُماني"},
 eg:{name:"مصر",fullName:"جمهورية مصر العربية",flag:"🇪🇬",currencyLabel:"ج.م",currencyLong:"جنيه مصري"},
 iq:{name:"العراق",fullName:"جمهورية العراق",flag:"🇮🇶",currencyLabel:"د.ع",currencyLong:"دينار عراقي"},
};
