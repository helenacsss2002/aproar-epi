import { readFileSync, writeFileSync } from 'node:fs';

const paths = ['public/admin/index.html','public/campo/index.html'];

const helperBlock = String.raw`
  /* APROAR_PATCH_V10_RETURN_HISTORY */
  function epiFamilyV10(value){
    var t=normTrelloText(value||'');
    if(/CAMISA|CAMISETA|BLUSA|POLO/.test(t))return 'camisa';
    if(/CALCA|CALCAO|BERMUDA/.test(t))return 'calca';
    if(/BOTA DE PVC|GALOCHA/.test(t))return 'bota_pvc';
    if(/BOTA|BOTINA|CALCADO|SAPATO|TENIS/.test(t))return 'calcado';
    if(/CAPACETE/.test(t))return 'capacete';
    if(/CARNEIRA/.test(t))return 'carneira';
    if(/JUGULAR/.test(t))return 'jugular';
    if(/LUVA ISOLANTE/.test(t))return 'luva_isolante';
    if(/LUVA DE COBERTURA/.test(t))return 'luva_cobertura';
    if(/LUVA/.test(t))return 'luva';
    if(/OCULOS/.test(t))return 'oculos';
    if(/PROTETOR FACIAL/.test(t))return 'protetor_facial';
    if(/PROTETOR AURICULAR|ABAFADOR/.test(t))return 'protetor_auricular';
    if(/RESPIRADOR|MASCARA/.test(t))return 'respirador';
    if(/CINTO|CINTURAO|TALABARTE|TRAVA QUEDAS/.test(t))return 'altura';
    if(/ATPV|VESTIMENTA/.test(t))return 'vestimenta_atpv';
    if(/CAPA DE CHUVA/.test(t))return 'capa_chuva';
    if(/AVENTAL/.test(t))return 'avental';
    if(/MACACAO/.test(t))return 'macacao';
    if(/BALACLAVA/.test(t))return 'balaclava';
    return t.replace(/\b(TAM|TAMANHO|CA)\b.*$/,'').trim()||'outro';
  }
  function sameCollaboratorV10(a,b){
    if(!a||!b)return false;
    var ma=String(a.matricula||'').trim(),mb=String(b.matricula||'').trim();
    if(ma&&mb)return normTrelloText(ma)===normTrelloText(mb);
    return normTrelloText(a.nome||'')===normTrelloText(b.nome||'');
  }
  function buildReturnExpectedV10(d,r){
    if(!d||!r||r.reason==='Primeira entrega')return [];
    var now=r.time?new Date(r.time).getTime():Date.now();
    var candidates=[];
    (DEMANDS||[]).forEach(function(prev){
      if(!prev||String(prev.id)===String(d.id)||!sameCollaboratorV10(prev,d))return;
      var pr=state.deliveries&&state.deliveries[prev.id];
      if(!pr||!Array.isArray(pr.deliveredQty))return;
      var pt=pr.time?new Date(pr.time).getTime():0;
      if(pt&&pt>=now)return;
      (prev.kit||[]).forEach(function(it,i){
        var q=Number(pr.deliveredQty[i]||0);
        if(q>0)candidates.push({item:it.item,ca:it.ca||'—',remaining:q,time:pt,sourceDemandId:prev.id,family:epiFamilyV10(it.item)});
      });
    });
    candidates.sort(function(a,b){return b.time-a.time;});
    var out=[];
    (d.kit||[]).forEach(function(newIt){
      var family=epiFamilyV10(newIt.item),need=Number(newIt.qtd||1);
      for(var i=0;i<candidates.length&&need>0;i++){
        var c=candidates[i];
        if(c.family!==family||c.remaining<=0)continue;
        var take=Math.min(need,c.remaining);c.remaining-=take;need-=take;
        out.push({item:c.item,ca:c.ca,qtd:take,sourceDemandId:c.sourceDemandId,replacementItem:newIt.item,manual:false});
      }
      if(need>0)out.push({item:'EPI/fardamento anterior não identificado',ca:'—',qtd:need,replacementItem:newIt.item,family:family,manual:true});
    });
    return out;
  }
  function ensureReturnExpectedV10(d,r){
    if(!r)return [];
    if(Array.isArray(r.returnExpected)&&r.returnExpected.length)return r.returnExpected;
    r.returnExpected=buildReturnExpectedV10(d,r);
    return r.returnExpected;
  }
`;

const newDiscountOverride = String.raw`
  /* APROAR_PATCH_V10_EPI_TERM */
  openDiscountTerm = function(c,deliv){
    var term=deliv&&deliv.discountTerm;if(!term)return;
    var w=window.open('','_blank');if(!w){alert('Permita pop-ups para visualizar o termo.');return;}
    var expected=(deliv.receipt&&Array.isArray(deliv.receipt.expectedItems)?deliv.receipt.expectedItems:(Array.isArray(deliv.returnExpected)?deliv.returnExpected:[]));
    var missing=Array.isArray(term.missing)?term.missing:[];
    var oldRows=missing.map(function(label){
      var clean=String(label||'').replace(/^\s*\d+(?:[.,]\d+)?x\s*/i,'').trim();
      var qty=(String(label||'').match(/^\s*(\d+(?:[.,]\d+)?)x/i)||[])[1]||'1';
      var ref=expected.find(function(x){return normTrelloText(x.item||'')===normTrelloText(clean)||normTrelloText(label).indexOf(normTrelloText(x.item||''))>=0;});
      return '<tr><td><b>'+escapeHtml(clean||label)+'</b>'+(ref&&ref.replacementItem?'<div class="subnote">Item anterior que deveria ser devolvido na substituição por: '+escapeHtml(ref.replacementItem)+'</div>':'')+'</td><td>'+escapeHtml(ref&&ref.ca||'—')+'</td><td>'+escapeHtml(qty)+'</td><td class="bad">NÃO DEVOLVIDO</td></tr>';
    }).join('');
    var newRows=(c.kit||[]).map(function(it,i){var q=deliv.deliveredQty&&deliv.deliveredQty[i]||0;if(!q)return '';return '<tr><td>'+escapeHtml(it.item)+'</td><td>'+escapeHtml(it.ca||'—')+'</td><td>'+escapeHtml(q)+'</td></tr>';}).join('');
    var sig=term.signatureData||deliv.signatureData||'';
    var html='<!doctype html><html><head><meta charset="utf-8"><title>Ocorrência de não devolução - '+escapeHtml(c.nome)+'</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#101223;font-size:11px;line-height:1.45;margin:0}.actions{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #ddd;margin-bottom:14px}.actions button{border:0;border-radius:8px;background:#407492;color:#fff;padding:9px 14px;font-weight:700}.brand{font-weight:800;font-size:24px;color:#0c0e37}.company{font-size:9px;color:#555;margin:3px 0 16px}.title{text-align:center;font-size:15px;font-weight:800;color:#0c0e37;margin:18px 0}.lead{background:#f4f6f8;border-left:4px solid #407492;padding:10px 12px}.id{width:100%;border-collapse:collapse;margin:14px 0}.id td{border:1px solid #c8cbd2;padding:6px}.id td:first-child{width:22%;font-weight:700;background:#f7f7f7}.section{font-size:12px;font-weight:800;color:#0c0e37;margin:16px 0 7px}.alert{border:2px solid #b23a2e;background:#fff5f3;padding:11px}.alert strong{color:#9f2f27}.tbl{width:100%;border-collapse:collapse;margin-top:8px}.tbl th,.tbl td{border:1px solid #aeb3bc;padding:6px;text-align:left;vertical-align:top}.tbl th{background:#0c0e37;color:#fff}.tbl .bad{color:#b23a2e;font-weight:800}.subnote{font-size:9px;color:#626a7a;margin-top:3px}.newbox{background:#f4f8fa;border:1px solid #cbdce6;padding:10px}.notice{font-size:10px;color:#555;background:#fff8e8;border-left:3px solid #c38a2c;padding:8px 10px;margin-top:12px}.sig{margin-top:26px;max-width:330px}.sig img{display:block;max-width:260px;height:70px;object-fit:contain;object-position:left bottom}.line{border-top:1px solid #333;padding-top:5px}.footer{text-align:center;margin-top:28px;color:#555}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir / salvar em PDF</button></div><div class="brand">APROAR</div><div class="company">Aproar Engenharia e Serviços LTDA · CNPJ 36.316.140/0001-10 · Rua Senador Pompeu, Nº 834 – Centro, Fortaleza/CE</div><div class="title">TERMO DE OCORRÊNCIA DE NÃO DEVOLUÇÃO DE EPI/FARDAMENTO</div><div class="lead">Este documento registra <b>exclusivamente</b> a ocorrência de não devolução do EPI/fardamento <b>anterior</b> que estava sob responsabilidade do colaborador no momento de uma troca/reposição. O item novo entregue pode ser diferente do item anterior devido para devolução.</div><table class="id"><tr><td>Colaborador(a)</td><td><b>'+escapeHtml(c.nome)+'</b></td></tr><tr><td>Função</td><td>'+escapeHtml(c.funcao||'Colaborador')+'</td></tr><tr><td>CPF</td><td>'+escapeHtml(currentCpfForDemand(c)||term.employeeCpf||'Não identificado')+'</td></tr><tr><td>Obra</td><td>'+escapeHtml(c.obra||'—')+'</td></tr><tr><td>Unidade</td><td>'+escapeHtml(c.unidade||'—')+'</td></tr><tr><td>Data da ocorrência</td><td>'+escapeHtml(fmtDateLong(term.generatedAt))+'</td></tr><tr><td>Status</td><td>'+escapeHtml(term.status||'Aguardando Financeiro')+'</td></tr></table><div class="section">1. EPI/FARDAMENTO ANTERIOR NÃO DEVOLVIDO</div><div class="alert"><strong>Erivaldo registrou devolução incompleta.</strong> Os itens abaixo eram os itens anteriores esperados para devolução e não foram apresentados na conferência.<table class="tbl"><tr><th>Item anterior devido</th><th>CA</th><th>Qtd.</th><th>Situação</th></tr>'+oldRows+'</table></div><div class="section">2. NOVO EPI/FARDAMENTO ENTREGUE NESTA DEMANDA</div><div class="newbox">Os itens abaixo são os novos itens entregues ao colaborador e são apresentados apenas para contextualizar a substituição. <b>Não significam que eram esses mesmos itens que deveriam ser devolvidos.</b><table class="tbl"><tr><th>Novo item entregue</th><th>CA</th><th>Qtd.</th></tr>'+newRows+'</table></div><div class="section">3. REGISTRO E APURAÇÃO</div><p>A ocorrência foi registrada pelo Almoxarifado e encaminhada ao Financeiro para análise. A geração deste termo <b>não efetiva desconto automaticamente</b>. Qualquer desconto ou ressarcimento depende da apuração interna, da identificação do item anterior, do valor aplicável e do registro do resultado pelo Financeiro.</p><div class="notice">Se o item anterior não puder ser identificado automaticamente pelo histórico, ele deve ser informado/corrigido no momento da conferência antes do encaminhamento ao Financeiro.</div><div class="sig"><b>Assinatura registrada do colaborador no ato da entrega</b>'+(sig?'<img src="'+sig+'" alt="Assinatura">':'<div style="height:55px"></div>')+'<div class="line">'+escapeHtml(c.nome)+'</div><div class="subnote">Assinatura vinculada ao registro da entrega do novo EPI/fardamento.</div></div><div class="footer">Fortaleza, '+escapeHtml(fmtDateLong(term.generatedAt))+'.</div></body></html>';
    w.document.open();w.document.write(html);w.document.close();
  };
`;

const expandedUniformFunction = String.raw`  function isUniformDemandDescription(desc){
    var t=normTrelloText(desc);
    return /FARDAMENTO|UNIFORME|\bEPI\b|CALCADO DE SEGURANCA|BOTA|BOTINA|GALOCHA|SAPATO(?: DE SEGURANCA)?|TENIS(?: DE SEGURANCA)?|CAPACETE|CARNEIRA|JUGULAR|LUVA|VAQUETA|RASPA|OCULOS|PROTETOR FACIAL|PROTETOR AURICULAR|ABAFADOR|MASCARA|RESPIRADOR|CAMISA|CAMISETA|BLUSA|POLO|CALCA|CALCAO|BERMUDA|JAQUETA|JAPONA|COLETE|AVENTAL|MACACAO|MEIA|BALACLAVA|CAPA DE CHUVA|CINTO|CINTURAO|TALABARTE|TRAVA QUEDAS|ATPV|VESTIMENTA|SOLADO ISOLANTE|LUVA ISOLANTE|LUVA DE COBERTURA|FITA DE ANCORAGEM|LINHA DE VIDA/.test(t);
  }`;

function patchReceiptBlock(html){
  const re=/  function renderReceipt\(\)\{[\s\S]*?\n  \}\n\n  function openDeliveryReceiptTerm/;
  const m=html.match(re); if(!m)return html;
  let b=m[0];
  b=b.replace("var d=getDemand(state.selectedId),r=recFor(d),f=state.receiptForm,first=r.reason==='Primeira entrega';", "var d=getDemand(state.selectedId),r=recFor(d),f=state.receiptForm,first=r.reason==='Primeira entrega';var returnKit=first?[]:ensureReturnExpectedV10(d,r);if(!Array.isArray(f.qty)||f.qty.length!==returnKit.length)f.qty=returnKit.map(function(){return 0;});var oldItemsIdentified=first||returnKit.every(function(it){return !it.manual&&normTrelloText(it.item||'').indexOf('NAO IDENTIFICADO')<0;});");
  b=b.replace(/d\.kit\.every/g,'returnKit.every').replace(/d\.kit\.map/g,'returnKit.map').replace(/d\.kit\.forEach/g,'returnKit.forEach').replace(/d\.kit\[i\]\.qtd/g,'returnKit[i].qtd');
  b=b.replace("var canComplete=first||(all&&!!f.photo);var canPending=!first&&!all&&(!any||!!f.photo);", "var canComplete=first||(oldItemsIdentified&&all&&!!f.photo);var canPending=!first&&oldItemsIdentified&&!all&&(!any||!!f.photo);");
  b=b.replace("<div class=\"qty-meta\">esperado usado '+it.qtd+'</div>", "<div class=\"qty-meta\">item anterior esperado · '+it.qtd+' · substituído por '+escapeHtml(it.replacementItem||'item novo')+'</div>'+(it.manual?'<input class=\"field-input\" data-olditem=\"'+i+'\" placeholder=\"Informe o EPI/fardamento anterior\" value=\"\">':'')+'");
  b=b.replace("'<span class=\"section-label\">Quantidade usada recebida</span>", "'<span class=\"section-label\">EPI/fardamento anterior esperado para devolução</span>'+(oldItemsIdentified?'':'<div class=\"notice-box issue\"><b>Item anterior não identificado.</b><br>Informe abaixo qual era o EPI/fardamento anterior antes de continuar.</div>')+'");
  b=b.replace("r.receipt={receivedBy:'Erivaldo',time:new Date(),photo:f.photo,complete:true,receivedQty:first?returnKit.map(function(){return 0;}):f.qty.slice(),missing:[]};", "r.receipt={receivedBy:'Erivaldo',time:new Date(),photo:f.photo,complete:true,receivedQty:first?returnKit.map(function(){return 0;}):f.qty.slice(),missing:[],expectedItems:returnKit.map(function(x){return {item:x.item,ca:x.ca||'—',qtd:x.qtd,replacementItem:x.replacementItem||''};})};");
  b=b.replace("r.receipt={receivedBy:'Erivaldo',time:new Date(),photo:f.photo,complete:false,receivedQty:f.qty.slice(),missing:missing};", "r.receipt={receivedBy:'Erivaldo',time:new Date(),photo:f.photo,complete:false,receivedQty:f.qty.slice(),missing:missing,expectedItems:returnKit.map(function(x){return {item:x.item,ca:x.ca||'—',qtd:x.qtd,replacementItem:x.replacementItem||''};})};");
  const listenerNeedle="document.getElementById('backBtn').addEventListener('click',function(){state.view='route';render();});";
  b=b.replace(listenerNeedle, listenerNeedle+"screenEl.querySelectorAll('[data-olditem]').forEach(function(inp){inp.addEventListener('change',function(){var i=Number(inp.getAttribute('data-olditem')),v=inp.value.trim();if(!v)return;returnKit[i].item=v;returnKit[i].manual=false;r.returnExpected=returnKit;savePersistentState();renderReceipt();});});");
  return html.replace(re,b);
}

function patchFinance(html){
  html=html.replace("document.getElementById('deskFinanceSave').addEventListener('click',function(){", "document.getElementById('deskFinanceSave').addEventListener('click',async function(){");
  html=html.replace("state.desktopFlash='Retorno do Financeiro salvo. A demanda foi concluída e enviada ao histórico.';state.view='route';state.desktopSection='history';render();", "var btn=this;btn.disabled=true;btn.textContent='Salvando...';savePersistentState();var syncOk=await pushServerState(true);if(!syncOk){state.desktopFlash='Não foi possível salvar no banco. Tente novamente.';btn.disabled=false;btn.textContent='Salvar retorno e concluir';alert('Não foi possível salvar o retorno do Financeiro no banco de dados. Tente novamente.');return;}state.desktopFlash='Retorno do Financeiro salvo. A demanda foi concluída e enviada ao histórico.';state.view='route';state.desktopSection='history';resetFinanceForm();render();");
  html=html.replace("document.getElementById('financeSave').addEventListener('click',function(){", "document.getElementById('financeSave').addEventListener('click',async function(){");
  html=html.replace("state.lastAction='finance_complete';state.view='confirm';render();", "var btn=this;btn.disabled=true;btn.textContent='Salvando...';savePersistentState();var syncOk=await pushServerState(true);if(!syncOk){btn.disabled=false;btn.textContent='Salvar retorno e concluir demanda';alert('Não foi possível salvar o retorno do Financeiro no banco de dados. Tente novamente.');return;}state.lastAction='finance_complete';state.view='confirm';resetFinanceForm();render();");
  return html;
}

function patchOne(path){
  let html=readFileSync(path,'utf8');
  if(html.includes('APROAR_PATCH_V10_RETURN_HISTORY'))return;
  html=html.replace(/  function isUniformDemandDescription\(desc\)\{[\s\S]*?\n  \}/,expandedUniformFunction);
  html=html.replace(/tipo:\/EPI\|SEGURANCA\|BOTA\|BOTINA\|CAPACETE\|LUVA\|OCULOS\|PROTETOR\/i\.test\(normTrelloText\(desc\)\)\?"Entrega de fardamento \/ EPI":"Entrega de fardamento"/g,'tipo:isUniformDemandDescription(desc)?"Entrega de fardamento / EPI":"Entrega de fardamento"');
  html=html.replace('  function renderReceipt(){',helperBlock+'\n  function renderReceipt(){');
  html=patchReceiptBlock(html);
  html=html.replace("var full=d.kit.every(function(it,i){return rec.deliveredQty[i]>=it.qtd;});\n      rec.status=full?'awaiting_receipt':'partial_delivery';", "var full=d.kit.every(function(it,i){return rec.deliveredQty[i]>=it.qtd;});\n      if(full)rec.returnExpected=buildReturnExpectedV10(d,rec);\n      rec.status=full?'awaiting_receipt':'partial_delivery';");
  html=html.replace('\n\n  function renderFinance(){','\n'+newDiscountOverride+'\n  function renderFinance(){');
  html=patchFinance(html);
  writeFileSync(path,html,'utf8');
  console.log('patched',path);
}
for(const p of paths)patchOne(p);
