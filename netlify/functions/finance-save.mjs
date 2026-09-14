import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
}

function verifyToken(req){
  const h=req.headers.get("authorization")||"";
  if(!h.startsWith("Bearer "))return null;
  const token=h.slice(7),parts=token.split(".");
  if(parts.length!==2)return null;
  const [raw,sig]=parts;
  const expected=createHmac("sha256",process.env.DATABASE_URL).update(raw).digest("base64url");
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  try{
    const p=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));
    if(!p.exp||p.exp<Math.floor(Date.now()/1000))return null;
    return p;
  }catch{return null;}
}

async function ensureSchema(sql){
  await sql`CREATE TABLE IF NOT EXISTS app_demand_state (demand_key TEXT PRIMARY KEY, record JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}

export default async (req)=>{
  if(req.method!=="POST")return json({error:"Método não permitido"},405);
  if(!process.env.DATABASE_URL)return json({error:"DATABASE_URL não configurada"},500);

  const auth=verifyToken(req);
  if(!auth)return json({error:"Sessão inválida ou expirada"},401);
  if(auth.role!=="financeiro")return json({error:"Acesso permitido apenas ao Financeiro"},403);

  let body={};
  try{body=await req.json();}catch{return json({error:"JSON inválido"},400);}

  const demandKey=String(body.demandKey||"").trim();
  const decision=String(body.decision||"").trim();
  const amount=String(body.amount||"").trim();
  const competence=String(body.competence||"").trim();
  const note=String(body.note||"").trim();

  if(!demandKey)return json({error:"Demanda não informada"},400);
  if(decision!=="yes"&&decision!=="no")return json({error:"Situação financeira inválida"},400);

  const sql=neon(process.env.DATABASE_URL);
  await ensureSchema(sql);

  const rows=await sql`SELECT record FROM app_demand_state WHERE demand_key=${demandKey} LIMIT 1`;
  if(!rows.length)return json({error:"Demanda não encontrada no banco"},404);

  const record=rows[0].record&&typeof rows[0].record==="object"?rows[0].record:{};
  const effected=decision==="yes";
  const status=effected?"Desconto efetivado":"Desconto não efetivado";
  const now=new Date().toISOString();

  record.finance={
    by:"Financeiro",
    time:now,
    effected,
    status,
    amount,
    competence,
    note
  };
  record.status="concluded";
  if(record.discountTerm&&typeof record.discountTerm==="object")record.discountTerm.status=status;
  if(!Array.isArray(record.history))record.history=[];
  record.history.push({
    time:now,
    by:"Financeiro",
    title:status,
    text:(effected?"Desconto registrado como efetivado.":"Financeiro registrou que o desconto não foi efetivado.")+
      (amount?` Valor: R$ ${amount}.`:"")+
      (competence?` Competência: ${competence}.`:"")+
      (note?` ${note}`:"")
  });

  const payload=JSON.stringify(record);
  await sql`UPDATE app_demand_state SET record=${payload}::jsonb, updated_at=NOW() WHERE demand_key=${demandKey}`;

  return json({ok:true,record,demandKey,status});
};
