// Local private workspace. Each poll finishes before the next one starts.
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {setTimeout as pause} from "node:timers/promises";
import {fileURLToPath} from "node:url";
const exec=promisify(execFile);
const [folder,...markets]=process.argv.slice(2);
if(!folder||!markets.length||markets.some(m=>!["sa","ae","om","eg","iq"].includes(m))||new Set(markets).size!==markets.length)throw Error("Expected workspace and distinct market codes");
const run=fileURLToPath(new URL("run.mjs",import.meta.url));
async function command(args){
  const {stdout}=await exec(process.execPath,[run,...args],{timeout:10*60*1000,maxBuffer:4*1024*1024});
  return stdout.trim();
}
for(;;){
  let refreshed=false;
  for(const market of markets){
    try{await command(["sync",folder,market]);refreshed=true;console.log(new Date().toISOString(),market,"synchronized");}
    catch(error){console.error(market,error.stderr?.trim()||"Catalog poll failed");}
  }
  if(refreshed){try{console.log(await command(["board",folder]));}catch(error){console.error(error.stderr?.trim()||"Review generation failed");}}
  await pause(15*60*1000);
}
