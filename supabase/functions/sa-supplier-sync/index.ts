// Legacy TasteWP Saudi supplier integration retired at owner request on 2026-11-20.
// Keep the endpoint inert for old clients until its deployment can be removed from Supabase.
Deno.serve(() => new Response(JSON.stringify({error:"Legacy Saudi test supplier integration retired"}),{
 status:410,
 headers:{"content-type":"application/json","cache-control":"no-store","x-robots-tag":"noindex"},
}));
