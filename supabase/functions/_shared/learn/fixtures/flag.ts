// The local fixture flag. Fixtures may stand in for a live connection ONLY on a developer's machine: the flag must be
// "true", the request must come to a loopback host, and the code must not be running as a deployed function
// (Supabase sets DENO_DEPLOYMENT_ID there). A deployed function never serves fixture data, whatever the flag says.
export function fixturesAllowed(flag: string | undefined, requestUrl: string, deploymentId: string | undefined): boolean {
  if (flag !== "true" || deploymentId) return false;
  let host = "";
  try { host = new URL(requestUrl).hostname; } catch { return false; }
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
