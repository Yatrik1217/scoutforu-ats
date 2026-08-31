import { readFileSync } from "fs";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const B="resumes";
const hashRe=/^[0-9a-f]{64}\./;
const {data:rows}=await sb.from("talent_bank").select("id,resume_url").order("created_at");
let done=0,skip=0,fail=0,collide=0;
for(const r of rows){
  const old=r.resume_url||"";
  if(!old || hashRe.test(old)){skip++;continue;}
  try{
    const {data:blob,error:de}=await sb.storage.from(B).download(old);
    if(de||!blob){fail++;console.log("dl-fail",old,de?.message);continue;}
    const buf=Buffer.from(await blob.arrayBuffer());
    const ext=(old.split(".").pop()||"pdf").toLowerCase();
    const nw=createHash("sha256").update(buf).digest("hex")+"."+ext;
    if(nw===old){skip++;continue;}
    // upload hash-named (upsert true; if another row already produced it, that is fine)
    const {error:ue}=await sb.storage.from(B).upload(nw,buf,{contentType:blob.type||undefined,upsert:true});
    if(ue){fail++;console.log("up-fail",nw,ue.message);continue;}
    const {error:pe}=await sb.from("talent_bank").update({resume_url:nw}).eq("id",r.id);
    if(pe){fail++;console.log("ptr-fail",r.id,pe.message);continue;}
    // remove old object (best-effort; skip if it equals new)
    await sb.storage.from(B).remove([old]);
    done++;
    if(done%50===0)console.log("  ...",done,"renamed");
  }catch(e){fail++;console.log("err",old,e.message);}
}
console.log(`DONE renamed=${done} skipped=${skip} failed=${fail}`);
// verify
const {data:after}=await sb.from("talent_bank").select("resume_url");
let h=0,u=0,n=0;for(const r of after){const x=r.resume_url||"";if(!x)n++;else if(hashRe.test(x))h++;else u++;}
console.log(`verify: hash-named=${h} uuid-named=${u} null=${n}`);
