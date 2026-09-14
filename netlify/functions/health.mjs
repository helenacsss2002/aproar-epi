import { neon } from "@neondatabase/serverless";
export default async () => {
  try{
    if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL não configurada");
    const sql=neon(process.env.DATABASE_URL);const rows=await sql`SELECT NOW() AS now`;
    return new Response(JSON.stringify({ok:true,database:"Neon",now:rows[0]?.now||null}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  }catch(e){return new Response(JSON.stringify({ok:false,error:e.message}),{status:500,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});}
};
