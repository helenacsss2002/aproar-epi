import { readFileSync, writeFileSync } from 'node:fs';

const paths=['public/admin/index.html','public/campo/index.html'];

for(const path of paths){
  let html=readFileSync(path,'utf8');
  if(html.includes('APROAR_PATCH_V11_DEMAND_SNAPSHOT')) continue;

  const marker="/* APROAR_PATCH_V10_RETURN_HISTORY */";
  const helper=`/* APROAR_PATCH_V11_DEMAND_SNAPSHOT */\n  function demandSnapshotV11(d){\n    return {id:d.id,nome:d.nome,matricula:d.matricula||'',cpf:d.cpf||'',funcao:d.funcao||'Colaborador',obra:d.obra||'',unidade:d.unidade||'',kit:(d.kit||[]).map(function(x){return {item:x.item,ca:x.ca||'—',qtd:Number(x.qtd||1)};})};\n  }\n  function previousDemandV11(key,record){\n    var live=null;try{live=getDemand(key);}catch(e){}\n    return live||(record&&record.demandSnapshot)||null;\n  }\n`;
  html=html.replace(marker,helper+'  '+marker);

  const oldStart="    (DEMANDS||[]).forEach(function(prev){\n      if(!prev||String(prev.id)===String(d.id)||!sameCollaboratorV10(prev,d))return;\n      var pr=state.deliveries&&state.deliveries[prev.id];\n      if(!pr||!Array.isArray(pr.deliveredQty))return;\n      var pt=pr.time?new Date(pr.time).getTime():0;\n      if(pt&&pt>=now)return;\n      (prev.kit||[]).forEach(function(it,i){\n        var q=Number(pr.deliveredQty[i]||0);\n        if(q>0)candidates.push({item:it.item,ca:it.ca||'—',remaining:q,time:pt,sourceDemandId:prev.id,family:epiFamilyV10(it.item)});\n      });\n    });";
  const newStart="    Object.keys(state.deliveries||{}).forEach(function(key){\n      var pr=state.deliveries[key],prev=previousDemandV11(key,pr);\n      if(!prev||String(prev.id)===String(d.id)||!sameCollaboratorV10(prev,d)||!pr||!Array.isArray(pr.deliveredQty))return;\n      var pt=pr.time?new Date(pr.time).getTime():0;\n      if(pt&&pt>=now)return;\n      (prev.kit||[]).forEach(function(it,i){\n        var q=Number(pr.deliveredQty[i]||0);\n        if(q>0)candidates.push({item:it.item,ca:it.ca||'—',remaining:q,time:pt,sourceDemandId:prev.id,family:epiFamilyV10(it.item)});\n      });\n    });";
  html=html.replace(oldStart,newStart);

  const saveNeedle="rec.reason=f.reason;rec.time=new Date();rec.coords=f.coords;rec.coordsSim=f.coordsSim;rec.offline=state.offline;rec.deliveredBy='Davi';rec.signatureData=f.signatureData;";
  html=html.replace(saveNeedle,saveNeedle+"rec.demandSnapshot=demandSnapshotV11(d);");

  writeFileSync(path,html,'utf8');
  console.log('patched v11',path);
}
