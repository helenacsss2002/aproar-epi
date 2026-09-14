import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const PASSWORD_HASHES = {
  davi: "33a039f2e07bffcd49bffec1cda9d2509caed483102dd34d339fd5a862668410",
  erivaldo: "a774b3d7d6af05eb01b15056dc2c3d86afc6d827a3d2f6e4b22a4c06e0a8504c",
  suprimentos: "4c1978f20363c5944b4c1d879619d91a51f149d18d2118a9d0e080c94c0c9ad4",
  financeiro: "480dad84808c6a20151c647cae36f2314af40c1e4552f3f4b748fd7c596cca88"
};

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}
function sha256(text){return createHash("sha256").update(String(text||""),"utf8").digest("hex");}
function safeEqual(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb);}
function sign(payload){const raw=Buffer.from(JSON.stringify(payload)).toString("base64url");const sig=createHmac("sha256",process.env.DATABASE_URL).update(raw).digest("base64url");return `${raw}.${sig}`;}

export default async (req) => {
  if(req.method!=="POST")return json({error:"Método não permitido"},405);
  if(!process.env.DATABASE_URL)return json({error:"DATABASE_URL não configurada"},500);
  let body={};try{body=await req.json();}catch{return json({error:"JSON inválido"},400);}
  const role=String(body.role||"").toLowerCase();
  if(!PASSWORD_HASHES[role])return json({error:"Perfil inválido"},400);
  if(!safeEqual(sha256(body.password),PASSWORD_HASHES[role]))return json({error:"Credenciais inválidas"},401);
  const now=Math.floor(Date.now()/1000);
  const token=sign({role,iat:now,exp:now+12*60*60});
  return json({ok:true,role,token});
};
