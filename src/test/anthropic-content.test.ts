import {expect,it,vi} from "vitest";
import {createAnthropicContentProvider} from "../lib/store/anthropic-content.server";
import {prepareContent} from "../lib/store/research-evidence";
const brief=prepareContent("sa",[{id:"f",statement:"500 ml",source:"verified fixture",verified:true}],"storefront");
const configuration={apiKey:"fixture-secret-is-not-real",model:"test-model",rates:{inputMicrousdPerToken:2n,outputMicrousdPerToken:4n}};
it("sends only verified facts and returns JSON draft plus configured cost",async()=>{
 const request=vi.fn(async()=>Response.json({stop_reason:"end_turn",content:[{type:"text",text:JSON.stringify({segments:[{text:"٥٠٠ مل",factIds:["f"]}]})}],usage:{input_tokens:10,output_tokens:5}}));
 const run=createAnthropicContentProvider(configuration,request);
 const result=await run(brief,{maxOutputTokens:1200,reservationMicrousd:100n});
 expect(result.actualMicrousd).toBe(40n);
 expect(request.mock.calls[0][0].toString()).toContain("api.anthropic.com/v1/messages");
 expect(JSON.parse(String(request.mock.calls[0][1]?.body)).messages[0].content).toContain("verified fixture");
});
it("reports overruns to the caller for accounting rather than erasing usage",async()=>{
 const request=async()=>Response.json({stop_reason:"end_turn",content:[{type:"text",text:'{"segments":[{"text":"verified","factIds":["f"]}]}' }],usage:{input_tokens:20,output_tokens:20}});
 const result=await createAnthropicContentProvider(configuration,request as typeof fetch)(brief,{maxOutputTokens:100,reservationMicrousd:50n});
 expect(result.actualMicrousd).toBe(120n);
});
it("fails closed on truncated results and unapproved endpoints",async()=>{
 expect(()=>createAnthropicContentProvider({...configuration,apiOrigin:"https://attacker.example"})).toThrow();
 const incomplete=async()=>Response.json({stop_reason:"max_tokens",content:[{type:"text",text:"{}"}],usage:{input_tokens:10,output_tokens:10}});
 await expect(createAnthropicContentProvider(configuration,incomplete as typeof fetch)(brief,{maxOutputTokens:100,reservationMicrousd:100n})).rejects.toThrow();
});
