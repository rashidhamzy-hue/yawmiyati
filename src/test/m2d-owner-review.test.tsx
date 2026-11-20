import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
// @ts-ignore Local-only Node module, not included in application compilation.
import { assertLocalPreviewSettings, authorizeLocalPreviewRequest, LOCAL_PREVIEW_FLAG } from "../../scripts/m2d-local-access.mjs";
import { LocalOwnerReviewWorkspace } from "./m2d-owner-review-workspace";

const secret = "local-preview-secret-m2d-0123456789abcdef";
const auth = "Basic " + Buffer.from("owner:" + secret).toString("base64");
const settings = { flag: LOCAL_PREVIEW_FLAG, hostname:"127.0.0.1", secret, nodeEnv:"development" };

describe("M2D server-side local-only access",()=>{
  it("requires exact environment, loopback binding and strong ephemeral secret",()=>{
    expect(()=>assertLocalPreviewSettings(settings)).not.toThrow();
    expect(()=>assertLocalPreviewSettings({...settings,flag:""})).toThrow("local_owner_preview_disabled");
    expect(()=>assertLocalPreviewSettings({...settings,hostname:"0.0.0.0"})).toThrow();
    expect(()=>assertLocalPreviewSettings({...settings,hostname:"localhost"})).toThrow();
    expect(()=>assertLocalPreviewSettings({...settings,nodeEnv:"production"})).toThrow();
    expect(()=>assertLocalPreviewSettings({...settings,secret:"short"})).toThrow();
  });
  it("authenticates every HTTP GET/HEAD, including module assets; rejects other methods and hosts",()=>{
    const headers={host:"127.0.0.1:4174",authorization:auth};
    expect(authorizeLocalPreviewRequest(headers,"GET",secret)).toBe(true);
    expect(authorizeLocalPreviewRequest(headers,"HEAD",secret)).toBe(true);
    for(const method of ["POST","PUT","DELETE","OPTIONS"])expect(authorizeLocalPreviewRequest(headers,method,secret)).toBe(false);
    expect(authorizeLocalPreviewRequest({...headers,host:"evil.example:4174"},"GET",secret)).toBe(false);
    expect(authorizeLocalPreviewRequest({...headers,host:"localhost:4174"},"GET",secret)).toBe(false);
    expect(authorizeLocalPreviewRequest({...headers,authorization:undefined},"GET",secret)).toBe(false);
    expect(authorizeLocalPreviewRequest({...headers,authorization:"Basic "+Buffer.from("owner:wrong").toString("base64")},"GET",secret)).toBe(false);
    expect(authorizeLocalPreviewRequest({...headers,authorization:"Bearer fake"},"GET",secret)).toBe(false);
    expect(authorizeLocalPreviewRequest({...headers,authorization:"Basic A".repeat(1000)},"GET",secret)).toBe(false);
  });
});

describe("M2D offline owner review workspace",()=>{
  it("displays unmistakable local/synthetic disclaimers without customer inputs or pay buttons",()=>{
    const {container}=render(<LocalOwnerReviewWorkspace/>);
    expect(screen.getByText("LOCAL OWNER REVIEW · SIMULATION ONLY")).toBeTruthy();
    expect(screen.getByText("DEMO · SIMULATION ONLY")).toBeTruthy();
    expect(container.querySelector('input[type="email"],input[type="tel"],input[type="password"]')).toBeNull();
    expect(screen.queryByRole("button",{name:/شراء الآن|إتمام الشراء/})).toBeNull();
    expect(screen.getByRole("combobox",{name:"دولة التجربة"}).hasAttribute("disabled")).toBe(true);
    expect(container.querySelector('[data-testid="local-owner-review"]')).toBeTruthy();
  });
  it("keeps review findings scoped to market and surface and exports no PII",()=>{
    render(<LocalOwnerReviewWorkspace/>);
    fireEvent.change(screen.getByRole("combobox",{name:"تقييم rtl"}),{target:{value:"pass"}});
    expect(screen.getByText("1 / 5 عناصر تمت مراجعتها")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox",{name:"بلد مراجعة المالك"}),{target:{value:"om"}});
    expect(screen.getByRole("combobox",{name:"تقييم rtl"})).toHaveProperty("value","not_reviewed");
    expect(screen.getByRole("combobox",{name:"دولة التجربة"})).toHaveProperty("value","om");
    fireEvent.click(screen.getByRole("button",{name:"محاكاة السلة والدفع عند الاستلام"}));
    expect(screen.getByRole("combobox",{name:"دولة اختبار الدفع"}).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("combobox",{name:"تقييم safety"}),{target:{value:"needs_fix"}});
    fireEvent.click(screen.getByRole("button",{name:"تحضير تقرير المراجعة المحلي"}));
    const report=JSON.parse((screen.getByTestId("local-review-report") as HTMLTextAreaElement).value);
    expect(report.synthetic).toBe(true);
    expect(report.mode).toBe("SIMULATION_ONLY");
    expect(report.checks).toHaveLength(50);
    expect(report.checks.find((v:{market:string;surface:string;criterion:string})=>v.market==="sa"&&v.surface==="catalog"&&v.criterion==="rtl").status).toBe("pass");
    expect(report.checks.find((v:{market:string;surface:string;criterion:string})=>v.market==="om"&&v.surface==="cod"&&v.criterion==="safety").status).toBe("needs_fix");
    expect(JSON.stringify(report)).not.toMatch(/@|phone|address|email|password|token/i);
  });
  it("does not call fetch when switching country, showing COD and generating review",()=>{
    const spy=vi.spyOn(globalThis,"fetch");
    try {
      render(<LocalOwnerReviewWorkspace/>);
      fireEvent.change(screen.getByRole("combobox",{name:"بلد مراجعة المالك"}),{target:{value:"iq"}});
      fireEvent.click(screen.getByRole("button",{name:"محاكاة السلة والدفع عند الاستلام"}));
      fireEvent.click(screen.getByRole("button",{name:"تحضير تقرير المراجعة المحلي"}));
      expect(spy).not.toHaveBeenCalled();
    }finally{spy.mockRestore();}
  });
});
