import { readFileSync, writeFileSync } from 'node:fs';

const paths=['public/admin/index.html','public/campo/index.html'];
const marker='APROAR_PATCH_V12_FINANCE_SAVE';

const hotfix=String.raw`
<script>
/* APROAR_PATCH_V12_FINANCE_SAVE */
(function(){
  function fieldValue(id,fallback){var el=document.getElementById(id);return el?String(el.value||''):String(fallback||'');}
  async function saveFinanceDesktopV12(btn){
    if(btn.dataset.saving==='1')return;
    var d=null,r=null,f=null;
    try{d=getDemand(state.selectedId);r=recFor(d);f=state.financeForm||{};}catch(err){console.error(err);alert('Não foi possível localizar esta demanda. Atualize a página e tente novamente.');return;}
    if(!d||!r){alert('Não foi possível localizar esta demanda. Atualize a página e tente novamente.');return;}
    if(!f.decision){alert('Selecione “Desconto efetivado” ou “Não efetivado” antes de salvar.');return;}

    f.amount=fieldValue('deskFinanceAmount',f.amount).trim();
    f.competence=fieldValue('deskFinanceComp',f.competence).trim();
    f.note=fieldValue('deskFinanceNote',f.note).trim();

    var oldFinance=r.finance?JSON.parse(JSON.stringify(r.finance)):null;
    var oldStatus=r.status;
    var oldTermStatus=r.discountTerm?r.discountTerm.status:null;
    var oldHistory=(r.history||[]).slice();
    var yes=f.decision==='yes';

    btn.dataset.saving='1';btn.disabled=true;var oldText=btn.textContent;btn.textContent='Salvando...';
    try{
      r.finance={by:'Financeiro',time:new Date(),effected:yes,status:yes?'Desconto efetivado':'Desconto não efetivado',amount:f.amount,competence:f.competence,note:f.note};
      if(r.discountTerm)r.discountTerm.status=r.finance.status;
      r.status='concluded';
      r.history=r.history||[];
      r.history.push({time:new Date(),by:'Financeiro',title:r.finance.status,text:(yes?'Desconto registrado como efetivado.':'Financeiro registrou que o desconto não foi efetivado.')+(f.amount?' Valor: R$ '+f.amount+'.':'')+(f.competence?' Competência: '+f.competence+'.':'')+(f.note?' '+f.note:'')});
      savePersistentState();
      var ok=await pushServerState(true);
      if(!ok)throw new Error('Falha ao confirmar gravação no Neon');
      state.desktopFlash='Retorno do Financeiro salvo. A demanda foi concluída e enviada ao histórico.';
      state.view='route';state.desktopSection='history';state.selectedId=null;
      if(typeof resetFinanceForm==='function')resetFinanceForm();
      render();
    }catch(err){
      console.error('Falha ao salvar retorno financeiro',err);
      r.finance=oldFinance;r.status=oldStatus;r.history=oldHistory;
      if(r.discountTerm)r.discountTerm.status=oldTermStatus;
      savePersistentState();
      btn.dataset.saving='0';btn.disabled=false;btn.textContent=oldText;
      alert('Não foi possível salvar o retorno no banco. A demanda continua pendente. Tente novamente.');
    }
  }

  document.addEventListener('click',function(ev){
    var target=ev.target&&ev.target.closest?ev.target.closest('#deskFinanceSave'):null;
    if(!target)return;
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    saveFinanceDesktopV12(target);
  },true);
})();
</script>`;

for(const path of paths){
  let html=readFileSync(path,'utf8');
  if(html.includes(marker))continue;
  html=html.replace(/Termo de desconto \/ ocorrência/g,'Ocorrência de não devolução de EPI/fardamento');
  html=html.replace(/Visualizar termo de desconto/g,'Visualizar ocorrência de não devolução');
  html=html.replace(/Abrir termo de desconto/g,'Abrir ocorrência de não devolução');

  // Importante: usar o ÚLTIMO </body> do documento. Existem strings HTML de termos
  // dentro do JavaScript que também contêm </body> e não podem receber o hotfix.
  const lower=html.toLowerCase();
  const idx=lower.lastIndexOf('</body>');
  if(idx<0) throw new Error('Tag </body> final não encontrada em '+path);
  html=html.slice(0,idx)+hotfix+'\n'+html.slice(idx);

  writeFileSync(path,html,'utf8');
  console.log('patched v12',path);
}
