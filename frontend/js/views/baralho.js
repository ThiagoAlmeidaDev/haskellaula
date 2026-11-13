/* Página de um baralho: o que fazer agora (estudar os devidos ou adicionar cartões), o domínio
   do baralho, filtros por etapa e busca, e os cartões em linhas com editar e excluir visíveis.
   Adicionar e editar acontecem na gaveta lateral; colar lista ou importar um arquivo cria vários
   cartões de uma vez, e exportar baixa os cartões em CSV ou TXT. */
import { baralhos as apiBaralhos, cartoes as apiCartoes } from '../api.js';
import { h, icone, kbd, plural, toast, confirmar, diasAte, quandoRevisar, semAcento, digitando, baixarArquivo } from '../dom.js';
import { FORMATOS, gerarArquivo, lerArquivo, nomeDeArquivo } from '../arquivo.js';
import { consumirAdicionarCartao } from '../estado.js';
import { abrirGaveta, fecharGaveta } from '../gaveta.js';
import { abortado, estadoErro, voltar, esqueleto, campo, mostrarErroCampo, limparErroCampo } from './comum.js';
import { barraDominio, legendaDominio, etapaChip, capaMini, seletorOpcoes } from './componentes.js';
import { abrirGavetaBaralho, confirmarExclusaoBaralho } from './baralhos.js';

const FILTROS = [
  { chave: 'todos', rotulo: 'Todos', aceita: () => true },
  { chave: 'hoje', rotulo: 'Para hoje', aceita: (c) => diasAte(c.proximaRevisao) <= 0 },
  { chave: 'novo', rotulo: 'Novos', aceita: (c) => c.etapa === 'novo' },
  { chave: 'aprendendo', rotulo: 'Aprendendo', aceita: (c) => c.etapa === 'aprendendo' },
  { chave: 'dominado', rotulo: 'Dominados', aceita: (c) => c.etapa === 'dominado' },
];

/* Uma linha por cartão; frente e verso separados pelo primeiro tab, ponto e vírgula ou " - ".
   Linha sem separador ou com um lado vazio vira inválida e não é enviada. */
export function lerLista(texto) {
  return texto.split(/\r?\n/).map((bruta) => bruta.trim()).filter(Boolean).map((linha) => {
    const achou = /\t|;| - /.exec(linha);
    if (!achou) return { linha, valida: false };
    const frente = linha.slice(0, achou.index).trim();
    const verso = linha.slice(achou.index + achou[0].length).trim();
    return frente && verso ? { frente, verso, valida: true } : { linha, valida: false };
  });
}

function areaTexto(id, valor = '', linhas = 3) {
  const el = h('textarea', { class: 'input', id, rows: String(linhas), maxlength: '2000' });
  el.value = valor;
  el.addEventListener('input', () => limparErroCampo(el));
  return el;
}

function enterEnvia(form, campos) {
  campos.forEach((campoTexto, i) => {
    const proximo = campos[i + 1];
    campoTexto.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      if (proximo && !proximo.value.trim()) proximo.focus();
      else form.requestSubmit();
    });
  });
}

export async function renderBaralho(main, { id }, { signal }) {
  main.append(h('div', { class: 'pagina', 'aria-busy': 'true' },
    esqueleto('esq-titulo', 1), esqueleto('esq-linha', 1), esqueleto('esq-card', 4)));

  let baralho;
  let lista;
  try {
    [baralho, lista] = await Promise.all([apiBaralhos.buscar(id, { signal }), apiBaralhos.cartoes(id, { signal })]);
  } catch (erro) {
    if (!abortado(erro)) estadoErro(main, erro);
    return;
  }

  let filtro = 'todos';
  const titulo = h('h1', { class: 'titulo', tabindex: '-1' });
  const capaTopo = h('div');
  const descricao = h('p', { class: 'subtitulo' });
  const acoes = h('div', { class: 'cabeca-acoes' });
  const dominio = h('section', { class: 'ficha', style: 'padding: 20px 24px; display: flex; flex-direction: column; gap: 12px', 'aria-label': 'Domínio do baralho' });
  const abas = h('div', { class: 'abas', role: 'group', 'aria-label': 'Filtrar cartões' });
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar na frente ou no verso', 'aria-label': 'Buscar cartão', 'aria-keyshortcuts': '/' });
  const grade = h('ul', { class: 'lista ficha' });

  function etapasLocais() {
    return {
      novos: lista.filter((c) => c.etapa === 'novo').length,
      aprendendo: lista.filter((c) => c.etapa === 'aprendendo').length,
      dominados: lista.filter((c) => c.etapa === 'dominado').length,
    };
  }

  function desenharCabeca() {
    document.title = `${baralho.nome} · Recall`;
    titulo.textContent = baralho.nome;
    capaTopo.replaceChildren(capaMini(baralho));
    descricao.textContent = baralho.descricao;
    descricao.hidden = !baralho.descricao;
    const paraHoje = lista.filter(FILTROS[1].aceita).length;
    acoes.replaceChildren(
      paraHoje > 0
        ? h('a', { class: 'btn btn-pri', href: `#/estudar/${id}` }, 'Estudar', h('span', { class: 'btn-contagem' }, String(paraHoje)))
        : null,
      h('button', { class: paraHoje > 0 ? 'btn btn-sec' : 'btn btn-pri', type: 'button', onclick: () => abrirAdicionar(), 'aria-keyshortcuts': 'N' }, icone('mais'), 'Adicionar cartões'),
      h('button', { class: 'btn btn-fantasma', type: 'button', onclick: editarBaralho }, icone('lapis'), 'Editar baralho'),
      h('button', { class: 'btn btn-fantasma', type: 'button', onclick: () => abrirAdicionar('arquivo') }, icone('subir'), 'Importar'),
      lista.length ? h('button', { class: 'btn btn-fantasma', type: 'button', onclick: () => abrirExportar(lista, 'todos') }, icone('baixar'), 'Exportar') : null,
      lista.length ? h('a', { class: 'btn btn-fantasma', href: `#/estatisticas/${id}` }, icone('grafico'), 'Estatísticas') : null);
    const etapas = etapasLocais();
    dominio.replaceChildren(
      h('div', { style: 'display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: baseline' },
        h('h2', { class: 'painel-titulo' }, lista.length ? 'Domínio do baralho' : 'Baralho vazio'),
        h('span', { class: 'mono suave' }, lista.length
          ? `${etapas.dominados} de ${lista.length} dominados, ${paraHoje > 0 ? `${paraHoje} para hoje` : 'em dia'}`
          : 'adicione cartões para começar')),
      barraDominio(etapas, { grande: true }),
      legendaDominio(etapas));
  }

  function desenharAbas() {
    abas.replaceChildren(...FILTROS.map((f) => h('button', {
      class: 'aba', type: 'button', 'aria-pressed': String(f.chave === filtro),
      onclick: () => { filtro = f.chave; desenharAbas(); desenharLista(); },
    }, f.rotulo, h('span', { class: 'mono' }, String(lista.filter(f.aceita).length)))));
  }

  function desenharLista({ destacar } = {}) {
    if (lista.length === 0) {
      grade.replaceChildren(h('li', { class: 'estado vazio' },
        h('p', { class: 'estado-titulo' }, 'Nenhum cartão ainda'),
        h('p', { class: 'estado-texto' }, 'Escreva a pergunta na frente e a resposta no verso. Para vários de uma vez, cole uma lista.'),
        h('div', { class: 'estado-acoes' },
          h('button', { class: 'btn btn-pri', type: 'button', onclick: () => abrirAdicionar() }, icone('mais'), 'Adicionar o primeiro cartão'),
          h('button', { class: 'btn btn-sec', type: 'button', onclick: () => abrirAdicionar('lista') }, icone('lista'), 'Colar uma lista'))));
      return;
    }
    const regra = FILTROS.find((f) => f.chave === filtro);
    const termo = busca.value.trim();
    const visiveis = cartoesVisiveis();
    if (visiveis.length === 0) {
      grade.replaceChildren(h('li', { class: 'estado vazio' },
        h('p', { class: 'estado-titulo' }, termo ? 'Nenhum cartão com esse texto' : `Nenhum cartão em “${regra.rotulo}”`),
        h('div', { class: 'estado-acoes' },
          h('button', { class: 'btn btn-sec', type: 'button', onclick: () => { filtro = 'todos'; busca.value = ''; desenharAbas(); desenharLista(); } }, 'Ver todos'))));
      return;
    }
    grade.replaceChildren(
      h('li', { class: 'lista-cabeca', 'aria-hidden': 'true' }, h('span', {}, 'Frente'), h('span', {}, 'Verso'), h('span', {}, 'Etapa e revisão'), h('span', {})),
      ...visiveis.map((c) => linhaCartao(c, destacar?.has(c.id))));
  }

  function cartoesVisiveis() {
    const regra = FILTROS.find((f) => f.chave === filtro);
    const termo = semAcento(busca.value.trim());
    return [...lista].reverse()
      .filter(regra.aceita)
      .filter((c) => !termo || semAcento(`${c.frente} ${c.verso}`).includes(termo));
  }

  function linhaCartao(c, destacado) {
    const devido = diasAte(c.proximaRevisao) <= 0;
    return h('li', { class: destacado ? 'linha-cartao recem-criado' : 'linha-cartao', dataset: { id: c.id } },
      h('p', { class: 'lc-frente' }, c.frente),
      h('p', { class: 'lc-verso' }, c.verso),
      h('div', { class: 'lc-meta' },
        etapaChip(c.etapa),
        h('span', { class: devido ? 'mono devido' : 'mono' }, quandoRevisar(c.proximaRevisao))),
      h('div', { class: 'lc-acoes' },
        h('button', { class: 'btn-icone', type: 'button', title: 'Editar cartão', 'aria-label': `Editar cartão ${c.frente.slice(0, 40)}`, onclick: () => editarCartao(c) }, icone('lapis')),
        h('button', { class: 'btn-icone', type: 'button', title: 'Exportar cartão', 'aria-label': `Exportar cartão ${c.frente.slice(0, 40)}`, onclick: () => abrirExportar([c], 'um') }, icone('baixar')),
        h('button', { class: 'btn-icone perigo', type: 'button', title: 'Excluir cartão', 'aria-label': `Excluir cartão ${c.frente.slice(0, 40)}`, onclick: () => excluirCartao(c) }, icone('lixo'))));
  }

  function atualizarTudo(opcoes) {
    desenharCabeca();
    desenharAbas();
    desenharLista(opcoes);
  }

  function abrirAdicionar(modoInicial = 'um') {
    let modo = modoInicial;
    let adicionados = 0;
    const novosIds = new Set();
    const alternador = h('div', { class: 'abas', role: 'group', 'aria-label': 'Como adicionar' });
    const area = h('div', { style: 'display: flex; flex-direction: column; gap: 16px' });
    const rodape = h('div', { style: 'display: contents' });
    let gaveta;

    const frente = areaTexto('novo-frente');
    const verso = areaTexto('novo-verso');
    const colado = areaTexto('novo-lista', '', 8);
    colado.setAttribute('placeholder', 'Capital do Japão; Tóquio\nCapital do Canadá; Ottawa\n水 - água');
    const previa = h('div', { 'aria-live': 'polite' });
    const arquivo = h('input', { class: 'input', type: 'file', id: 'novo-arquivo', accept: '.csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values' });
    let itensArquivo = [];
    arquivo.addEventListener('change', async () => {
      const escolhido = arquivo.files?.[0];
      itensArquivo = [];
      if (escolhido) {
        try {
          itensArquivo = lerArquivo(await escolhido.text());
        } catch (erro) {
          toast(`Não deu para ler o arquivo: ${erro.message}`);
        }
      }
      desenharPrevia();
    });
    const itensAtuais = () => (modo === 'arquivo' ? itensArquivo : lerLista(colado.value));
    const placar = h('span', { class: 'mono suave' });

    function desenharPrevia() {
      const itens = itensAtuais();
      const validos = itens.filter((i) => i.valida);
      const motivo = modo === 'arquivo' ? 'sem frente ou verso' : 'sem separador';
      const enviar = gaveta?.form.querySelector('button[type="submit"]');
      if (enviar) {
        enviar.disabled = validos.length === 0;
        enviar.lastChild.textContent = validos.length ? `Criar ${plural(validos.length, 'cartão', 'cartões')}` : 'Criar cartões';
      }
      if (!itens.length) { previa.replaceChildren(); return; }
      previa.replaceChildren(
        h('p', { class: 'campo-rotulo' }, `Prévia: ${plural(validos.length, 'cartão', 'cartões')}${itens.length > validos.length ? `, ${itens.length - validos.length} ${motivo}` : ''}`),
        h('ul', { class: 'previa-lista' }, itens.slice(0, 50).map((i) => (i.valida
          ? h('li', {}, h('strong', {}, i.frente), h('span', {}, i.verso))
          : h('li', { class: 'invalida' }, `${motivo}: ${i.linha}`)))));
    }
    colado.addEventListener('input', desenharPrevia);

    function desenharModo() {
      alternador.replaceChildren(
        h('button', { class: 'aba', type: 'button', 'aria-pressed': String(modo === 'um'), onclick: () => { modo = 'um'; desenharModo(); frente.focus(); } }, icone('mais'), 'Um cartão'),
        h('button', { class: 'aba', type: 'button', 'aria-pressed': String(modo === 'lista'), onclick: () => { modo = 'lista'; desenharModo(); colado.focus(); } }, icone('lista'), 'Colar lista'),
        h('button', { class: 'aba', type: 'button', 'aria-pressed': String(modo === 'arquivo'), onclick: () => { modo = 'arquivo'; desenharModo(); arquivo.focus(); } }, icone('subir'), 'Importar arquivo'));
      if (modo === 'um') {
        area.replaceChildren(
          campo({ rotulo: 'Frente', id: frente.id, controle: frente, ajuda: 'A pergunta, o termo ou a palavra.' }),
          campo({ rotulo: 'Verso', id: verso.id, controle: verso, ajuda: 'A resposta.' }));
        rodape.replaceChildren(
          h('button', { class: 'btn btn-pri', type: 'submit' }, icone('mais'), h('span', {}, 'Adicionar')),
          placar,
          h('span', { class: 'dica' }, kbd('Enter'), ' adiciona, ', kbd('Shift'), kbd('Enter'), ' nova linha'));
      } else if (modo === 'arquivo') {
        area.replaceChildren(
          campo({ rotulo: 'Arquivo CSV ou TXT', id: arquivo.id, controle: arquivo, ajuda: 'Uma carta por linha, frente e verso separados por tab, ponto e vírgula ou vírgula. Serve o arquivo exportado pelo Recall, pelo Anki ou por uma planilha.' }),
          previa);
        rodape.replaceChildren(
          h('button', { class: 'btn btn-pri', type: 'submit', disabled: true }, icone('subir'), h('span', {}, 'Criar cartões')),
          placar);
        queueMicrotask(desenharPrevia);
      } else {
        area.replaceChildren(
          campo({ rotulo: 'Uma linha por cartão', id: colado.id, controle: colado, ajuda: 'Separe frente e verso com tab, ponto e vírgula ou " - ". Dá para colar direto de uma planilha.' }),
          previa);
        rodape.replaceChildren(
          h('button', { class: 'btn btn-pri', type: 'submit', disabled: true }, icone('mais'), h('span', {}, 'Criar cartões')),
          placar);
        queueMicrotask(desenharPrevia);
      }
    }

    async function enviarUm(botao) {
      if (!frente.value.trim()) { mostrarErroCampo(frente, 'Escreva a frente do cartão'); return; }
      if (!verso.value.trim()) { mostrarErroCampo(verso, 'Escreva o verso do cartão'); return; }
      botao.disabled = true;
      try {
        const criado = await apiBaralhos.criarCartao(id, { frente: frente.value.trim(), verso: verso.value.trim() });
        lista = [...lista, criado];
        novosIds.add(criado.id);
        adicionados += 1;
        placar.textContent = `${plural(adicionados, 'cartão adicionado', 'cartões adicionados')}`;
        frente.value = '';
        verso.value = '';
        atualizarTudo({ destacar: novosIds });
        frente.focus();
      } catch (erro) {
        toast(erro.message);
      } finally {
        botao.disabled = false;
      }
    }

    /* Um POST por cartão, em sequência, para manter a ordem da lista e parar no primeiro erro. */
    async function enviarLista(botao) {
      const validos = itensAtuais().filter((i) => i.valida);
      if (!validos.length) return;
      botao.disabled = true;
      let feitos = 0;
      try {
        for (const item of validos) {
          const criado = await apiBaralhos.criarCartao(id, { frente: item.frente, verso: item.verso });
          lista = [...lista, criado];
          novosIds.add(criado.id);
          feitos += 1;
          placar.textContent = `${feitos} de ${validos.length}`;
        }
        toast(`${plural(feitos, 'cartão criado', 'cartões criados')} em ${baralho.nome}.`, { tipo: 'ok' });
        fecharGaveta();
      } catch (erro) {
        toast(`${erro.message} (${feitos} de ${validos.length} criados antes do erro)`);
        botao.disabled = false;
      } finally {
        atualizarTudo({ destacar: novosIds });
      }
    }

    desenharModo();
    gaveta = abrirGaveta({
      titulo: 'Adicionar cartões',
      corpo: [alternador, area],
      rodape,
      aoEnviar: (e) => {
        const botao = e.target.querySelector('button[type="submit"]');
        if (modo === 'um') enviarUm(botao);
        else enviarLista(botao);
      },
    });
    enterEnvia(gaveta.form, [frente, verso]);
    ({ um: frente, lista: colado, arquivo }[modo]).focus();
  }

  /* qual: 'todos' oferece todos ou só os que a busca e o filtro mostram; 'um' exporta o cartão. */
  function abrirExportar(cartoes, qual) {
    let formato = 'csv';
    let escolha = 'todos';
    const visiveis = cartoesVisiveis();
    const oferecerVisiveis = qual === 'todos' && visiveis.length > 0 && visiveis.length < lista.length;
    const quais = oferecerVisiveis
      ? seletorOpcoes({
        legenda: 'Quais cartões', nome: 'exportar-quais', valor: escolha, aoMudar: (v) => { escolha = v; },
        itens: [
          { valor: 'todos', nome: `Todos (${lista.length})` },
          { valor: 'visiveis', nome: `Só os que aparecem agora (${visiveis.length})` },
        ],
      }).el
      : null;
    const formatos = seletorOpcoes({
      legenda: 'Formato', nome: 'exportar-formato', valor: formato, aoMudar: (v) => { formato = v; },
      itens: Object.entries(FORMATOS).map(([valor, f]) => ({ valor, nome: f.nome })),
    });
    abrirGaveta({
      titulo: qual === 'um' ? 'Exportar cartão' : 'Exportar cartões',
      corpo: [
        qual === 'um' ? h('p', { class: 'campo-ajuda' }, h('strong', {}, cartoes[0].frente), ' / ', cartoes[0].verso) : quais,
        formatos.el,
        h('p', { class: 'campo-ajuda' }, 'Uma carta por linha, frente e verso. O arquivo volta pelo “Importar” deste ou de outro baralho e abre no Excel e no Anki.'),
      ],
      rodape: [h('button', { class: 'btn btn-pri', type: 'submit' }, icone('baixar'), 'Baixar arquivo'), h('button', { class: 'btn btn-fantasma', type: 'button', onclick: fecharGaveta }, 'Cancelar')],
      aoEnviar: () => {
        const escolhidos = qual === 'um' ? cartoes : escolha === 'visiveis' ? [...visiveis].reverse() : lista;
        const base = qual === 'um' ? `${baralho.nome} ${cartoes[0].frente.slice(0, 30)}` : baralho.nome;
        baixarArquivo(nomeDeArquivo(base, formato), gerarArquivo(escolhidos, formato), FORMATOS[formato].tipo);
        toast(`${plural(escolhidos.length, 'cartão exportado', 'cartões exportados')}.`, { tipo: 'ok' });
        fecharGaveta();
      },
    });
  }

  function editarCartao(c) {
    const frente = areaTexto('editar-frente', c.frente);
    const verso = areaTexto('editar-verso', c.verso);
    const salvar = h('button', { class: 'btn btn-pri', type: 'submit' }, 'Salvar');
    const gaveta = abrirGaveta({
      titulo: 'Editar cartão',
      corpo: [
        campo({ rotulo: 'Frente', id: frente.id, controle: frente }),
        campo({ rotulo: 'Verso', id: verso.id, controle: verso }),
        h('p', { class: 'campo-ajuda' }, 'Editar não muda quando o cartão volta para revisão.'),
      ],
      rodape: [
        salvar,
        h('button', { class: 'btn btn-fantasma', type: 'button', onclick: fecharGaveta }, 'Cancelar'),
        h('button', { class: 'btn btn-perigo btn-sm', type: 'button', style: 'margin-left: auto', onclick: () => { fecharGaveta(); excluirCartao(c); } }, icone('lixo'), 'Excluir'),
      ],
      aoEnviar: async () => {
        if (!frente.value.trim()) { mostrarErroCampo(frente, 'Escreva a frente do cartão'); return; }
        if (!verso.value.trim()) { mostrarErroCampo(verso, 'Escreva o verso do cartão'); return; }
        salvar.disabled = true;
        try {
          const atualizado = await apiCartoes.editar(c.id, { frente: frente.value.trim(), verso: verso.value.trim() });
          lista = lista.map((x) => (x.id === atualizado.id ? atualizado : x));
          fecharGaveta();
          atualizarTudo({ destacar: new Set([atualizado.id]) });
        } catch (erro) {
          toast(erro.message);
          salvar.disabled = false;
        }
      },
    });
    enterEnvia(gaveta.form, [frente, verso]);
  }

  async function excluirCartao(c) {
    const ok = await confirmar({
      titulo: 'Excluir este cartão?',
      texto: `“${c.frente.slice(0, 80)}” e o histórico de revisões dele serão apagados.`,
      acao: 'Excluir cartão',
    });
    if (!ok) return;
    try {
      await apiCartoes.excluir(c.id);
      lista = lista.filter((x) => x.id !== c.id);
      atualizarTudo();
      toast('Cartão excluído.', { tipo: 'ok' });
    } catch (erro) {
      toast(erro.message);
    }
  }

  function editarBaralho() {
    abrirGavetaBaralho({
      baralho,
      aoSalvar: (salvo) => { baralho = salvo; desenharCabeca(); },
      aoExcluir: async (alvo) => {
        fecharGaveta();
        if (!(await confirmarExclusaoBaralho({ ...alvo, totalCartoes: lista.length }))) return;
        try {
          await apiBaralhos.excluir(alvo.id);
          toast(`“${alvo.nome}” foi excluído.`, { tipo: 'ok' });
          location.hash = '#/baralhos';
        } catch (erro) {
          toast(erro.message);
        }
      },
    });
  }

  function aoTeclar(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || digitando(e) || document.querySelector('dialog[open]')) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); abrirAdicionar(); }
    else if (e.key === '/') { e.preventDefault(); busca.focus(); }
  }

  busca.addEventListener('input', () => desenharLista());
  atualizarTudo();

  main.replaceChildren(h('div', { class: 'pagina' },
    voltar('#/baralhos', 'Baralhos'),
    h('header', { class: 'cabeca' },
      h('div', { class: 'cabeca-texto', style: 'display: flex; gap: 20px; align-items: center' }, capaTopo, h('div', { style: 'min-width: 0' }, titulo, descricao)),
      acoes),
    dominio,
    h('section', { class: 'secao', style: 'margin-top: 40px', 'aria-labelledby': 'titulo-cartoes' },
      h('div', { class: 'secao-cabeca' },
        h('h2', { class: 'secao-titulo', id: 'titulo-cartoes' }, 'Cartões'),
        h('span', { class: 'dica' }, kbd('N'), ' novo cartão, ', kbd('/'), ' busca')),
      h('div', { class: 'barra-ferramentas' }, abas, h('label', { class: 'busca' }, icone('busca'), busca)),
      grade)));

  document.addEventListener('keydown', aoTeclar);
  if (consumirAdicionarCartao()) abrirAdicionar();
  return () => {
    document.removeEventListener('keydown', aoTeclar);
    document.title = 'Recall';
  };
}
