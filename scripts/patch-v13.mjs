import { readFileSync, writeFileSync } from 'node:fs';

const paths=['public/admin/index.html','public/campo/index.html'];
const marker='APROAR_PATCH_V13_FINANCE_ENDPOINT';

const oldDesktop="var btn=this;btn.disabled=true;btn.textContent='Salvando...';savePersistentState();var syncOk=await pushServerState(true);if(!syncOk){state.desktopFlash='Não foi possível salvar no banco. Tente novamente.';btn.disabled=false;btn.textContent='Salvar retorno e concluir';alert('Não foi possível salvar o retorno do Financeiro no banco de dados. Tente novamente.');return;}state.desktopFlash='Retorno do Financeiro salvo. A demanda foi concluída e enviada ao histórico.';state.view='route';state.desktopSection='history';resetFinanceForm();render();";

const newDesktop="var btn=this;btn.disabled=true;btn.textContent='Salvando...';try{var resp=await fetch('/.netlify/functions/finance-save',{method:'POST',headers:apiHeaders(),body:JSON.stringify({demandKey:String(d.id),decision:f.decision,amount:f.amount.trim(),competence:f.competence.trim(),note:f.note.trim()}),cache:'no-store'});var payload={};try{payload=await resp.json();}catch(e){}if(!resp.ok||!payload.ok)throw new Error(payload.error||('HTTP '+resp.status));if(payload.record)state.deliveries[d.id]=payload.record;lastServerSnapshot=cloneJson(persistentSnapshot());saveLocalSnapshot(persistentSnapshot());state.desktopFlash='Retorno do Financeiro salvo. A demanda foi concluída e enviada ao histórico.';state.view='route';state.desktopSection='history';state.selectedId=null;resetFinanceForm();render();}catch(err){console.error('Falha ao salvar retorno financeiro',err);await refreshServerState();btn.disabled=false;btn.textContent='Salvar retorno e concluir';alert('Não foi possível salvar o retorno financeiro: '+(err&&err.message?err.message:'erro de conexão')+'. A demanda continua pendente.');}";

const oldMobile="var btn=this;btn.disabled=true;btn.textContent='Salvando...';savePersistentState();var syncOk=await pushServerState(true);if(!syncOk){btn.disabled=false;btn.textContent='Salvar retorno e concluir demanda';alert('Não foi possível salvar o retorno do Financeiro no banco de dados. Tente novamente.');return;}state.lastAction='finance_complete';state.view='confirm';resetFinanceForm();render();";

const newMobile="var btn=this;btn.disabled=true;btn.textContent='Salvando...';try{var resp=await fetch('/.netlify/functions/finance-save',{method:'POST',headers:apiHeaders(),body:JSON.stringify({demandKey:String(d.id),decision:f.decision,amount:f.amount.trim(),competence:f.competence.trim(),note:f.note.trim()}),cache:'no-store'});var payload={};try{payload=await resp.json();}catch(e){}if(!resp.ok||!payload.ok)throw new Error(payload.error||('HTTP '+resp.status));if(payload.record)state.deliveries[d.id]=payload.record;lastServerSnapshot=cloneJson(persistentSnapshot());saveLocalSnapshot(persistentSnapshot());state.lastAction='finance_complete';state.view='confirm';resetFinanceForm();render();}catch(err){console.error('Falha ao salvar retorno financeiro',err);await refreshServerState();btn.disabled=false;btn.textContent='Salvar retorno e concluir demanda';alert('Não foi possível salvar o retorno financeiro: '+(err&&err.message?err.message:'erro de conexão')+'. A demanda continua pendente.');}";

for(const path of paths){
  let html=readFileSync(path,'utf8');
  if(html.includes(marker))continue;

  if(html.includes(oldDesktop)) html=html.replace(oldDesktop,newDesktop);
  if(html.includes(oldMobile)) html=html.replace(oldMobile,newMobile);

  html=html.replace(
    "function render(){savePersistentState();setWorkspaceMode();if(isDesktopRole())",
    "function render(){savePersistentState();setWorkspaceMode();if(typeof syncAdminHeader==='function')syncAdminHeader();if(isDesktopRole())"
  );

  const idx=html.lastIndexOf('</script>');
  if(idx>=0) html=html.slice(0,idx)+'\n  /* '+marker+' */\n'+html.slice(idx);

  if(!html.includes("/.netlify/functions/finance-save")) throw new Error('Handler financeiro dedicado não foi aplicado em '+path);

  writeFileSync(path,html,'utf8');
  console.log('patched v13',path);
}
