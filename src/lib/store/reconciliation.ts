export function compareOrderSnapshots(local: readonly {id:string;status:string}[], remote: readonly {id:string;status:string}[]) {
  const index = new Map<string,string>();
  for (const row of remote) {
    if (index.has(row.id)) throw new Error("Duplicate remote order");
    index.set(row.id,row.status);
  }
  const seen = new Set<string>();
  const differences: {id:string;kind:"missing_remote"|"status_mismatch"|"unmapped_remote"}[] = [];
  for (const row of local) {
    if (seen.has(row.id)) throw new Error("Duplicate local order");
    seen.add(row.id);
    if (!index.has(row.id)) differences.push({id:row.id,kind:"missing_remote"});
    else if (index.get(row.id)!==row.status) differences.push({id:row.id,kind:"status_mismatch"});
  }
  for (const row of remote) if (!seen.has(row.id)) differences.push({id:row.id,kind:"unmapped_remote"});
  return differences;
}
