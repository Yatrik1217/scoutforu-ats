import { readFileSync } from "fs";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const B="resumes", hashRe=/^[0-9a-f]{64}\./;
const {data:rows}=await sb.from("talent_bank").select("id,resume_url").order("created_at");
let done=0,skip=0,fail=0;
for(const r of rows){
  const old=r.resume_url||"";
  if(!old||hashRe.test(old)){skip++;continue;}
  try{
    const {data:blob,error:de}=await sb.storage.from(B).download(old);
    if(de||!blob){fail++;continue;}
    const buf=Buffer.from(await blob.arrayBuffer());
    const ext=(old.split(".").pop()||"pdf").toLowerCase();
    const nw=createHash("sha256").update(buf).digest("hex")+"."+ext;
    if(nw===old){skip++;continue;}
    const {error:ue}=await sb.storage.from(B).upload(nw,buf,{contentType:blob.type||undefined,upsert:true});
    if(ue){fail++;continue;}
    const {error:pe}=await sb.from("talent_bank").update({resume_url:nw}).eq("id",r.id);
    if(pe){fail++;continue;}
    await sb.storage.from(B).remove([old]);
    done++;
  }catch(e){fail++;}
}
const {data:after}=await sb.from("talent_bank").select("resume_url");
let h=0,u=0;for(const r of after){if(hashRe.test(r.resume_url||""))h++;else u++;}
console.log(`DONE renamed=${done} skipped=${skip} failed=${fail} | final hash-named=${h} uuid-remaining=${u}`);
