// Node 24 runs the same TypeScript modules used by the owner dashboard.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith(".") && context.parentURL && !/\.[a-z]+$/i.test(specifier)){
    const file=new URL(specifier+".ts",context.parentURL);
    if(existsSync(file))return next(file.href,context);
  }
  return next(specifier,context);
}});
try { await import("./commands.ts"); }
catch(error){ console.error(error.message); process.exitCode=1; }
