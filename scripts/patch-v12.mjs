import { readFileSync, writeFileSync } from 'node:fs';

const paths=['public/admin/index.html','public/campo/index.html'];
const marker='APROAR_PATCH_V12_LABELS_ONLY';

for(const path of paths){
  let html=readFileSync(path,'utf8');
  if(html.includes(marker))continue;

  html=html.replace(/Termo de desconto \/ ocorrência/g,'Ocorrência de não devolução de EPI/fardamento');
  html=html.replace(/Visualizar termo de desconto/g,'Visualizar ocorrência de não devolução');
  html=html.replace(/Abrir termo de desconto/g,'Abrir ocorrência de não devolução');

  const idx=html.lastIndexOf('</script>');
  if(idx>=0) html=html.slice(0,idx)+'\n  /* '+marker+' */\n'+html.slice(idx);

  writeFileSync(path,html,'utf8');
  console.log('patched v12 labels',path);
}
