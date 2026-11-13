/* Estudar: a escolha (tudo ou um baralho) e a sessão. Na sessão, Espaço mostra a resposta,
   1 a 4 respondem (notas 1, 3, 4 e 5 do SM-2), S pula sem mexer no agendamento, E edita e
   + e - mudam o tamanho do texto. A carta segue as preferências da conta; falha ao responder
   não avança a fila. No fim, os errados podem ser revistos em treino, sem nota. */
import { baralhos as apiBaralhos, cartoes as apiCartoes } from '../api.js';
import { h, icone, kbd, plural, prazo, toast, digitando, formatarNumero, diasAte } from '../dom.js';
import { abrirGaveta, fecharGaveta } from '../gaveta.js';
import { abortado, estadoErro, voltar, esqueleto, campo, mostrarErroCampo } from './comum.js';
import { TAMANHO_MAXIMO, barraDominio, cartaEstudo, chave, faixaTamanho, seletorOpcoes } from './componentes.js';
import { preferenciasAtuais, salvarPreferencias } from '../sessao.js';

const RESPOSTAS = [
  { tecla: '1', nota: 1, rotulo: 'Errei', classe: 'resposta resposta-errei' },
  { tecla: '2', nota: 3, rotulo: 'Difícil', classe: 'resposta resposta-dificil' },
  { tecla: '3', nota: 4, rotulo: 'Bom', classe: 'resposta resposta-bom' },
  { tecla: '4', nota: 5, rotulo: 'Fácil', classe: 'resposta resposta-facil' },
];

const NOMES_ETAPA = { novo: 'novo', aprendendo: 'aprendendo', dominado: 'dominado' };

export async function renderEscolhaEstudo(main, _params, { signal }) {
  document.title = 'Estudar · Recall';
  main.append(h('div', { class: 'pagina', 'aria-busy': 'true' }, esqueleto('esq-titulo', 1), esqueleto('esq-painel', 1)));
  let lista;
  try {
    lista = await apiBaralhos.listar({ signal });
  } catch (erro) {
    if (!abortado(erro)) estadoErro(main, erro);
    return;
  }
  const comPendencia = lista.filter((b) => b.paraHoje > 0).sort((a, b) => b.paraHoje - a.paraHoje);
  const emDia = lista.filter((b) => b.paraHoje === 0);
  const total = comPendencia.reduce((s, b) => s + b.paraHoje, 0);

  const blocoTudo = h('section', { class: 'escolha-tudo ficha', 'aria-labelledby': 'escolha-tudo-titulo' },
    h('p', { class: 'eyebrow', id: 'escolha-tudo-titulo' }, 'Estudar tudo'),
    h('p', { class: 'escolha-numero' }, formatarNumero(total)),
    h('p', { class: 'dia-sub' }, total > 0
      ? `${total === 1 ? 'cartão devido' : 'cartões devidos'} em ${plural(comPendencia.length, 'baralho', 'baralhos')}, misturados numa sessão só.`
      : 'Nenhum cartão espera revisão hoje.'),
    h('div', { class: 'dia-acoes' }, total > 0
      ? h('a', { class: 'btn btn-pri btn-alto', href: '#/estudar/todos' }, 'Começar a sessão')
      : h('a', { class: 'btn btn-sec', href: '#/baralhos' }, 'Adicionar cartões novos')));

  const blocoLista = h('section', { 'aria-labelledby': 'escolha-baralhos' },
    h('div', { class: 'secao-cabeca' }, h('h2', { class: 'secao-titulo', id: 'escolha-baralhos' }, 'Ou um baralho de cada vez')),
    comPendencia.length
      ? h('ul', { class: 'lista ficha' }, comPendencia.map((b) => h('li', { class: 'linha-baralho linha-escolha' },
        h('div', {}, h('a', { class: 'lb-nome', href: `#/estudar/${b.id}` }, b.nome), h('div', { style: 'margin-top: 8px; max-width: 280px' }, barraDominio(b.etapas))),
        h('span', { class: 'pendencia' }, `${b.paraHoje} para hoje`),
        h('a', { class: 'btn btn-sec btn-sm', href: `#/estudar/${b.id}` }, 'Estudar'))))
      : h('p', { class: 'vazio-inline' }, lista.length ? 'Todos os baralhos estão em dia.' : 'Você ainda não tem baralhos.'),
    emDia.length && comPendencia.length
      ? h('p', { class: 'vazio-inline', style: 'margin-top: 16px' }, `Em dia: ${emDia.map((b) => b.nome).join(', ')}.`)
      : null);

  main.replaceChildren(h('div', { class: 'pagina' },
    h('header', { class: 'cabeca' },
      h('div', { class: 'cabeca-texto' },
        h('h1', { class: 'titulo', tabindex: '-1' }, 'Estudar'),
        h('p', { class: 'subtitulo' }, 'Os cartões aparecem no dia em que o SM-2 agendou. Responda de memória antes de mostrar a resposta.'))),
    h('div', { class: 'escolha' }, blocoTudo, blocoLista)));
  return () => { document.title = 'Recall'; };
}

export async function renderEstudo(main, { id }, { signal }) {
  const todos = id === null;
  main.append(h('div', { class: 'estudo', 'aria-busy': 'true' }, esqueleto('esq-linha', 1), esqueleto('esq-estudo', 1)));

  let baralhos;
  let fila;
  try {
    [baralhos, fila] = await Promise.all([
      apiBaralhos.listar({ signal }),
      todos ? apiBaralhos.revisarTudo({ signal }) : apiBaralhos.revisar(id, { signal }),
    ]);
  } catch (erro) {
    if (!abortado(erro)) estadoErro(main, erro);
    return;
  }
  const nomes = new Map(baralhos.map((b) => [b.id, b.nome]));
  const porId = new Map(baralhos.map((b) => [b.id, b]));
  const atual = todos ? null : baralhos.find((b) => b.id === id);
  if (!todos && !atual) {
    estadoErro(main, Object.assign(new Error('baralho não encontrado'), { status: 404 }));
    return;
  }
  const nomeSessao = todos ? 'Todos os baralhos' : atual.nome;
  document.title = `Estudar ${nomeSessao} · Recall`;
  const saida = todos ? '#/estudar' : `#/baralho/${id}`;

  const seletor = h('select', { class: 'input estudo-seletor', 'aria-label': 'Trocar de baralho' },
    h('option', { value: 'todos' }, `Todos os baralhos (${baralhos.reduce((s, b) => s + b.paraHoje, 0)})`),
    baralhos.map((b) => h('option', { value: String(b.id) }, `${b.nome} (${b.paraHoje})`)));
  seletor.value = todos ? 'todos' : String(id);
  seletor.addEventListener('change', () => {
    location.hash = seletor.value === 'todos' ? '#/estudar/todos' : `#/estudar/${seletor.value}`;
  });

  if (fila.length === 0) {
    const proximo = baralhos.find((b) => b.paraHoje > 0 && b.id !== id);
    main.replaceChildren(h('div', { class: 'estudo' },
      h('div', { class: 'estudo-topo' }, voltar(saida, 'Sair'), seletor),
      h('section', { class: 'estado estado-pagina' },
        h('h1', { class: 'estado-titulo', tabindex: '-1' }, todos ? 'Nada para revisar hoje' : `${nomeSessao} está em dia`),
        h('p', { class: 'estado-texto' }, 'Os cartões voltam no dia que o SM-2 agendou.'),
        h('div', { class: 'estado-acoes' },
          proximo ? h('a', { class: 'btn btn-pri', href: `#/estudar/${proximo.id}` }, `Estudar ${proximo.nome}`, h('span', { class: 'btn-contagem' }, String(proximo.paraHoje))) : null,
          todos ? h('a', { class: 'btn btn-sec', href: '#/baralhos' }, 'Ver baralhos') : h('a', { class: 'btn btn-sec', href: `#/baralho/${id}` }, 'Voltar ao baralho')))));
    return () => { document.title = 'Recall'; };
  }

  /* itens guardam o estado de cada cartão na ordem original (para o trilho); ordem é a fila viva. */
  const itens = fila.map((c) => ({ cartao: c, estado: 'pendente' }));
  let ordem = itens.map((_, i) => i);
  let prefs = { ...preferenciasAtuais() };
  if (prefs.embaralhar) {
    for (let i = ordem.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
  }
  let carta = null;
  let espera = null;

  /* A mudança aparece na hora; a gravação espera a pessoa parar de ajustar. Erro ao gravar
     avisa, e a carta continua como ela deixou até a próxima tentativa. */
  function ajustar(mudanca) {
    prefs = { ...prefs, ...mudanca };
    carta?.aplicar(prefs);
    olho.setAttribute('aria-pressed', String(prefs.mostrarPergunta));
    clearTimeout(espera);
    espera = setTimeout(() => {
      salvarPreferencias(prefs).catch((erro) => toast(erro.message));
    }, 600);
  }
  const limitar = (v, d) => Math.min(TAMANHO_MAXIMO, Math.max(1, v + d));
  const mudarTamanho = (d) => ajustar({ tamanhoPergunta: limitar(prefs.tamanhoPergunta, d), tamanhoResposta: limitar(prefs.tamanhoResposta, d) });
  const olho = h('button', {
    class: 'btn-icone', type: 'button', title: 'Manter a pergunta na carta depois de revelar', 'aria-label': 'Manter a pergunta na carta depois de revelar',
    'aria-pressed': String(prefs.mostrarPergunta), onclick: () => ajustar({ mostrarPergunta: !prefs.mostrarPergunta }),
  }, icone('olho'), 'Pergunta');
  const ajustes = h('div', { class: 'ajustes', role: 'group', 'aria-label': 'Ajustes da carta' },
    h('button', { class: 'btn-icone', type: 'button', title: 'Diminuir o texto', 'aria-label': 'Diminuir o texto', 'aria-keyshortcuts': '-', onclick: () => mudarTamanho(-1) }, 'A−'),
    h('button', { class: 'btn-icone', type: 'button', title: 'Aumentar o texto', 'aria-label': 'Aumentar o texto', 'aria-keyshortcuts': '+', onclick: () => mudarTamanho(1) }, 'A+'),
    olho,
    h('button', { class: 'btn-icone', type: 'button', title: 'Ajustes da carta', 'aria-haspopup': 'dialog', onclick: () => abrirAjustes() }, icone('ajustes'), 'Ajustes'));

  /* Os ajustes abrem na gaveta, por cima da sessão: fechar volta para a mesma carta, no mesmo ponto. */
  function abrirAjustes() {
    const fontes = [
      { valor: 'sem-serifa', nome: 'Sem serifa' },
      { valor: 'serifa', nome: 'Serifa', estilo: 'font-family: var(--fonte-serifa); font-size: 17px' },
      { valor: 'manuscrita', nome: 'À mão', estilo: 'font-family: var(--fonte-mao); font-size: 19px; font-weight: 400' },
    ];
    abrirGaveta({
      titulo: 'Ajustes da carta',
      corpo: [
        faixaTamanho({ rotulo: 'Tamanho da pergunta', valor: prefs.tamanhoPergunta, aoMudar: (v) => ajustar({ tamanhoPergunta: v }) }).el,
        faixaTamanho({ rotulo: 'Tamanho da resposta', valor: prefs.tamanhoResposta, aoMudar: (v) => ajustar({ tamanhoResposta: v }) }).el,
        seletorOpcoes({ legenda: 'Fonte da carta', nome: 'fonte-sessao', valor: prefs.fonte, itens: fontes, aoMudar: (v) => ajustar({ fonte: v }) }).el,
        seletorOpcoes({
          legenda: 'Ao mostrar a resposta', nome: 'revelar-sessao', valor: prefs.revelar, aoMudar: (v) => ajustar({ revelar: v }),
          itens: [{ valor: 'virar', nome: 'Virar a carta' }, { valor: 'abaixo', nome: 'Mostrar embaixo' }],
        }).el,
        chave({ rotulo: 'Manter a pergunta depois de revelar', valor: prefs.mostrarPergunta, aoMudar: (v) => ajustar({ mostrarPergunta: v }) }).el,
        h('p', { class: 'campo-ajuda' }, 'As mudanças aparecem na carta na hora e ficam salvas na sua conta.'),
      ],
      rodape: [h('button', { class: 'btn btn-pri', type: 'button', onclick: fecharGaveta }, 'Voltar à sessão')],
    });
  }
  let mostrando = false;
  let enviando = false;
  let terminado = false;
  let treinoAtivo = null;

  const progresso = h('p', { class: 'estudo-progresso', 'aria-live': 'polite' });
  const trilho = h('div', { class: 'trilho', 'aria-hidden': 'true' });
  const palco = h('div');
  const acoes = h('div', { class: 'estudo-acoes' });
  const retorno = h('p', { class: 'estudo-retorno', 'aria-live': 'polite' });
  const botoes = RESPOSTAS.map((r) => h('button', {
    class: r.classe, type: 'button', 'aria-keyshortcuts': r.tecla, onclick: () => responder(r.nota),
  }, h('span', { class: 'resposta-rotulo' }, r.rotulo), h('span', { class: 'resposta-prazo' }), kbd(r.tecla)));
  const mostrar = h('div', { class: 'mostrar' },
    h('button', { class: 'btn btn-pri btn-alto', type: 'button', onclick: revelar }, 'Mostrar resposta', kbd('Espaço')),
    h('span', { class: 'dica-toque' }, 'Toque para ver a resposta'));
  const grupoRespostas = h('div', { class: 'respostas', role: 'group', tabindex: '-1', 'aria-label': 'Quanto você lembrou?' }, botoes);

  const corrente = () => itens[ordem[0]];

  function desenharProgresso() {
    const respondidos = itens.filter((i) => i.estado === 'certo' || i.estado === 'errado').length;
    progresso.replaceChildren(`Cartão `, h('strong', {}, formatarNumero(Math.min(respondidos + 1, itens.length))), ` de ${formatarNumero(itens.length)}`);
    trilho.style.gap = itens.length > 40 ? '0' : '';
    trilho.replaceChildren(...itens.map((i, idx) => h('span', {
      class: idx === ordem[0] && !terminado ? 't-atual' : i.estado === 'certo' ? 't-certo' : i.estado === 'errado' ? 't-errado' : i.estado === 'pulado' ? 't-pulado' : '',
    })));
  }

  function desenharCartao() {
    const { cartao } = corrente();
    mostrando = false;
    const b = porId.get(cartao.baralhoId);
    carta = cartaEstudo({
      pergunta: cartao.frente, resposta: cartao.verso, rotuloEsq: b?.nome ?? '', rotuloDir: NOMES_ETAPA[cartao.etapa] ?? '',
      cor: b?.cor, padrao: b?.padrao, prefs,
    });
    carta.carta.classList.add('entrando');
    carta.el.addEventListener('click', () => { if (!mostrando) revelar(); });
    palco.replaceChildren(carta.el);
    acoes.replaceChildren(mostrar);
    desenharProgresso();
    mostrar.querySelector('button').focus({ preventScroll: true });
  }

  function revelar() {
    if (mostrando || terminado) return;
    mostrando = true;
    const { cartao } = corrente();
    carta.revelar();
    const dias = new Map((cartao.previsoes ?? []).map((p) => [p.nota, p.dias]));
    RESPOSTAS.forEach((r, i) => {
      botoes[i].querySelector('.resposta-prazo').textContent = dias.has(r.nota) ? prazo(dias.get(r.nota)) : '';
    });
    /* Num cartão novo toda resposta volta amanhã; a diferença está na facilidade, que muda os
       próximos intervalos. Sem esta nota, os quatro "amanhã" parecem dizer que tanto faz. */
    const prazos = new Set(RESPOSTAS.map((r) => dias.get(r.nota)));
    retorno.textContent = '';
    acoes.replaceChildren(
      prazos.size === 1 ? h('p', { class: 'estudo-nota' }, 'Primeira revisão: qualquer resposta volta amanhã. O que muda são os intervalos seguintes.') : '',
      grupoRespostas);
    grupoRespostas.focus({ preventScroll: true });
  }

  function avancar() {
    if (ordem.length === 0) concluir();
    else desenharCartao();
  }

  function pular() {
    if (enviando || terminado || ordem.length === 0) return;
    const idx = ordem.shift();
    if (itens[idx].estado === 'pendente') itens[idx].estado = 'pulado';
    ordem.push(idx);
    retorno.textContent = ordem.length === 1 ? 'Este é o último cartão da fila.' : 'Pulado: volta no fim da fila.';
    desenharCartao();
  }

  async function responder(nota) {
    if (!mostrando || enviando || terminado) return;
    enviando = true;
    for (const b of botoes) b.disabled = true;
    const item = corrente();
    try {
      const atualizado = await apiCartoes.responder(item.cartao.id, nota);
      item.estado = nota >= 3 ? 'certo' : 'errado';
      item.cartao = { ...item.cartao, ...atualizado };
      const dias = diasAte(atualizado.proximaRevisao);
      retorno.textContent = nota >= 3 ? `Volta ${dias === 1 ? 'amanhã' : `em ${prazo(dias)}`}.` : 'Volta amanhã. Ele entra no treino do fim.';
      ordem.shift();
      avancar();
    } catch (erro) {
      toast(erro.message);
    } finally {
      enviando = false;
      for (const b of botoes) b.disabled = false;
    }
  }

  function editar() {
    if (terminado || enviando) return;
    const item = corrente();
    const frente = h('textarea', { class: 'input', id: 'sessao-frente', rows: '3' });
    const verso = h('textarea', { class: 'input', id: 'sessao-verso', rows: '3' });
    frente.value = item.cartao.frente;
    verso.value = item.cartao.verso;
    const salvar = h('button', { class: 'btn btn-pri', type: 'submit' }, 'Salvar');
    abrirGaveta({
      titulo: 'Editar cartão',
      corpo: [
        campo({ rotulo: 'Frente', id: frente.id, controle: frente }),
        campo({ rotulo: 'Verso', id: verso.id, controle: verso }),
        h('p', { class: 'campo-ajuda' }, 'A sessão continua neste cartão depois de salvar.'),
      ],
      rodape: [salvar, h('button', { class: 'btn btn-fantasma', type: 'button', onclick: fecharGaveta }, 'Cancelar')],
      aoEnviar: async () => {
        if (!frente.value.trim()) { mostrarErroCampo(frente, 'Escreva a frente do cartão'); return; }
        if (!verso.value.trim()) { mostrarErroCampo(verso, 'Escreva o verso do cartão'); return; }
        salvar.disabled = true;
        try {
          const atualizado = await apiCartoes.editar(item.cartao.id, { frente: frente.value.trim(), verso: verso.value.trim() });
          item.cartao = { ...item.cartao, frente: atualizado.frente, verso: atualizado.verso };
          fecharGaveta();
          const estavaMostrando = mostrando;
          desenharCartao();
          if (estavaMostrando) revelar();
        } catch (erro) {
          toast(erro.message);
          salvar.disabled = false;
        }
      },
    });
  }

  function tile(valor, rotulo) {
    return h('div', { class: 'stat ficha' }, h('p', { class: 'stat-valor' }, valor), h('p', { class: 'stat-rotulo' }, rotulo));
  }

  function concluir() {
    terminado = true;
    treinoAtivo = null;
    const certos = itens.filter((i) => i.estado === 'certo').length;
    const errados = itens.filter((i) => i.estado === 'errado');
    const taxa = Math.round((certos / itens.length) * 100);
    const proximo = baralhos.find((b) => b.paraHoje > 0 && (todos ? false : b.id !== id));
    main.replaceChildren(h('section', { class: 'conclusao' },
      h('p', { class: 'eyebrow' }, nomeSessao),
      h('h1', { class: 'titulo', tabindex: '-1' }, 'Sessão concluída'),
      h('p', { class: 'subtitulo' }, `Você respondeu ${plural(itens.length, 'cartão', 'cartões')} e acertou ${taxa}%.`),
      h('div', { class: 'stats' },
        tile(formatarNumero(certos), certos === 1 ? 'Acerto' : 'Acertos'),
        tile(formatarNumero(errados.length), errados.length === 1 ? 'Volta amanhã' : 'Voltam amanhã'),
        tile(`${taxa}%`, 'Taxa de acerto')),
      h('div', { class: 'estado-acoes' },
        errados.length
          ? h('button', { class: 'btn btn-pri', type: 'button', onclick: () => treino(errados.map((i) => i.cartao)) }, `Rever os que errei (${errados.length})`)
          : null,
        proximo
          ? h('a', { class: errados.length ? 'btn btn-sec' : 'btn btn-pri', href: `#/estudar/${proximo.id}` }, `Próximo: ${proximo.nome}`, h('span', { class: 'btn-contagem' }, String(proximo.paraHoje)))
          : null,
        h('a', { class: 'btn btn-fantasma', href: '#/' }, 'Voltar ao início'))));
    main.querySelector('h1').focus({ preventScroll: true });
  }

  /* Treino: mostra os errados de novo, sem nota e sem chamar a API; o agendamento já foi gravado. */
  function treino(lista) {
    let i = 0;
    let visto = false;
    let cartaTreino = null;
    const ficha = h('div');
    const botao = h('button', { class: 'btn btn-pri btn-alto', type: 'button' });
    const contador = h('p', { class: 'estudo-progresso' });
    function desenhar() {
      const c = lista[i];
      visto = false;
      contador.replaceChildren(h('strong', {}, String(i + 1)), ` de ${lista.length}, treino sem nota`);
      const b = porId.get(c.baralhoId);
      cartaTreino = cartaEstudo({ pergunta: c.frente, resposta: c.verso, rotuloEsq: 'Treino', rotuloDir: b?.nome ?? '', cor: b?.cor, padrao: b?.padrao, prefs });
      ficha.replaceChildren(cartaTreino.el);
      botao.replaceChildren('Mostrar resposta', kbd('Espaço'));
      botao.focus({ preventScroll: true });
    }
    function passo() {
      if (!visto) {
        visto = true;
        cartaTreino.revelar();
        botao.replaceChildren(i + 1 < lista.length ? 'Próximo' : 'Terminar treino', kbd('Espaço'));
        return;
      }
      i += 1;
      if (i < lista.length) desenhar();
      else concluir();
    }
    botao.addEventListener('click', passo);
    main.replaceChildren(h('div', { class: 'estudo' },
      h('div', { class: 'estudo-topo' }, h('button', { class: 'voltar btn-fantasma', type: 'button', style: 'border: 0; background: none', onclick: () => { treinoAtivo = null; concluir(); } }, icone('voltar'), 'Sair do treino'), contador),
      ficha,
      h('div', { class: 'estudo-acoes mostrar' }, botao)));
    desenhar();
    treinoAtivo = passo;
  }

  /* O atalho é global para funcionar sem foco no cartão, então ignora teclas digitadas em campos,
     combinações com modificador (Ctrl K abre a busca) e qualquer tecla com um diálogo aberto. */
  function aoTeclar(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (digitando(e) || document.querySelector('dialog[open]')) return;
    if (treinoAtivo && terminado) {
      if (e.key === ' ') { e.preventDefault(); treinoAtivo(); }
      return;
    }
    if (terminado) return;
    const tecla = e.key.toLowerCase();
    if (e.key === ' ') {
      e.preventDefault();
      if (!mostrando) revelar();
      else responder(4);
    } else if (/^[1-4]$/.test(e.key) && mostrando) {
      e.preventDefault();
      responder(RESPOSTAS[Number(e.key) - 1].nota);
    } else if (tecla === 's') {
      e.preventDefault();
      pular();
    } else if (tecla === 'e') {
      e.preventDefault();
      editar();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      mudarTamanho(1);
    } else if (e.key === '-') {
      e.preventDefault();
      mudarTamanho(-1);
    } else if (e.key === 'Escape') {
      location.hash = saida;
    }
  }

  // Sem isto, Espaço com foco num botão também dispararia o clique dele ao soltar a tecla.
  function aoSoltar(e) {
    if (e.key === ' ' && !digitando(e) && main.contains(e.target)) e.preventDefault();
  }

  main.replaceChildren(h('div', { class: 'estudo' },
    h('div', { class: 'estudo-topo' }, voltar(saida, 'Sair'), seletor, ajustes, progresso),
    trilho,
    palco,
    acoes,
    retorno,
    h('div', { class: 'estudo-rodape' },
      h('div', { class: 'estudo-ferramentas' },
        h('button', { class: 'btn btn-sec btn-sm', type: 'button', onclick: pular, 'aria-keyshortcuts': 'S', title: 'O cartão volta no fim da fila, sem mudar o agendamento' }, icone('pular'), 'Pular este cartão', kbd('S')),
        h('button', { class: 'btn btn-fantasma btn-sm', type: 'button', onclick: editar, 'aria-keyshortcuts': 'E' }, icone('lapis'), 'Editar cartão', kbd('E'))),
      h('p', { class: 'dica' }, kbd('Espaço'), ' mostra, ', kbd('1'), '–', kbd('4'), ' responde, ', kbd('Esc'), ' sai'))));

  desenharCartao();
  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('keyup', aoSoltar);
  return () => {
    document.removeEventListener('keydown', aoTeclar);
    document.removeEventListener('keyup', aoSoltar);
    document.title = 'Recall';
  };
}

