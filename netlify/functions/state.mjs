import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
function verifyToken(req){
  const h=req.headers.get("authorization")||""; if(!h.startsWith("Bearer "))return null;
  const token=h.slice(7),parts=token.split(".");if(parts.length!==2)return null;
  const [raw,sig]=parts; const expected=createHmac("sha256",process.env.DATABASE_URL).update(raw).digest("base64url");
  const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  try{const p=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));if(!p.exp||p.exp<Math.floor(Date.now()/1000))return null;return p;}catch{return null;}
}
async function ensureSchema(sql){
  await sql`CREATE TABLE IF NOT EXISTS app_demand_state (demand_key TEXT PRIMARY KEY, record JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS app_meta_state (key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT 'null'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}
async function readState(sql){
  const rows=await sql`SELECT demand_key, record FROM app_demand_state ORDER BY demand_key`;
  const meta=await sql`SELECT key, value FROM app_meta_state WHERE key IN ('collaborators','deletedIds')`;
  const deliveries={}; for(const r of rows)deliveries[r.demand_key]=r.record;
  let collaborators=[],deletedIds=[]; for(const m of meta){if(m.key==='collaborators'&&Array.isArray(m.value))collaborators=m.value;if(m.key==='deletedIds'&&Array.isArray(m.value))deletedIds=m.value;}
  return {version:2,savedAt:new Date().toISOString(),deliveries,deletedIds,collaborators};
}
export default async (req) => {
  if(!process.env.DATABASE_URL)return json({error:"DATABASE_URL não configurada"},500);
  const auth=verifyToken(req);if(!auth)return json({error:"Sessão inválida ou expirada"},401);
  const sql=neon(process.env.DATABASE_URL);await ensureSchema(sql);
  if(req.method==="GET")return json({ok:true,exists:true,state:await readState(sql),role:auth.role});
  if(req.method!=="POST")return json({error:"Método não permitido"},405);
  let body={};try{body=await req.json();}catch{return json({error:"JSON inválido"},400);}
  const deliveries=(body.deliveries&&typeof body.deliveries==='object')?body.deliveries:{};
  for(const [key,record] of Object.entries(deliveries)){
    const payload=JSON.stringify(record??{});
    await sql`INSERT INTO app_demand_state (demand_key,record,updated_at) VALUES (${String(key)},${payload}::jsonb,NOW()) ON CONFLICT (demand_key) DO UPDATE SET record=EXCLUDED.record, updated_at=NOW()`;
  }
  if(Array.isArray(body.removedKeys))for(const key of body.removedKeys)await sql`DELETE FROM app_demand_state WHERE demand_key=${String(key)}`;
  if(Array.isArray(body.collaborators)){
    const payload=JSON.stringify(body.collaborators);
    await sql`INSERT INTO app_meta_state (key,value,updated_at) VALUES ('collaborators',${payload}::jsonb,NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  }
  if(Array.isArray(body.deletedIds)){
    const payload=JSON.stringify(body.deletedIds);
    await sql`INSERT INTO app_meta_state (key,value,updated_at) VALUES ('deletedIds',${payload}::jsonb,NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  }
  return json({ok:true,state:await readState(sql),role:auth.role});
};
