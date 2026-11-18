/* Preferências de estudo da conta: tamanho e fonte do texto, como a resposta aparece, se a
   pergunta continua visível, a ordem da sessão e o tema. Cada mudança aparece na carta de exemplo
   na hora e é gravada sozinha depois de uma pausa curta. O tema muda a página inteira. */
import { h, icone, kbd, toast } from '../dom.js';
import { aplicarTema, preferenciasAtuais, salvarPreferencias } from '../sessao.js';
import { cartaEstudo, chave, faixaTamanho, seletorOpcoes } from './componentes.js';

export async function renderPreferencias(main) {
  document.title = 'Preferências · Recall';
  let prefs = { ...preferenciasAtuais() };
  let espera = null;
  let pendente = false;
  const salvo = h('p', { class: 'salvo', 'aria-live': 'polite' });

  const exemplo = cartaEstudo({
    pergunta: 'Qual é o maior osso do corpo humano?', resposta: 'O fêmur, na coxa.',
    rotuloEsq: 'Anatomia', rotuloDir: 'Exemplo', cor: 'hortela', padrao: 'bolinhas', prefs,
  });
  const virar = h('button', { class: 'btn btn-sec', type: 'button', onclick: () => { exemplo.alternar(); atualizarBotao(); } });
  const atualizarBotao = () => virar.replaceChildren(icone('virar'), exemplo.revelada ? 'Esconder a resposta' : 'Mostrar a resposta');
  atualizarBotao();

  /* Grava só depois de uma pausa, para que arrastar a faixa de tamanho não mande um PUT a cada passo. */
  function mudar(mudanca) {
    prefs = { ...prefs, ...mudanca };
    exemplo.aplicar(prefs);
    if ('tema' in mudanca) aplicarTema(prefs.tema);
    salvo.textContent = 'Salvando…';
    clearTimeout(espera);
    pendente = true;
    espera = setTimeout(gravar, 500);
  }

  async function gravar() {
    pendente = false;
    {
      try {
        await salvarPreferencias(prefs);
        salvo.textContent = 'Salvo na sua conta.';
      } catch (erro) {
        salvo.textContent = '';
        toast(erro.message);
      }
    }
  }

  const tamanhoDaPergunta = faixaTamanho({ rotulo: 'Tamanho da pergunta', valor: prefs.tamanhoPergunta, aoMudar: (valor) => mudar({ tamanhoPergunta: valor }) });
  const tamanhoDaResposta = faixaTamanho({ rotulo: 'Tamanho da resposta', valor: prefs.tamanhoResposta, aoMudar: (valor) => mudar({ tamanhoResposta: valor }) });
  const fonte = seletorOpcoes({
    legenda: 'Fonte da carta', nome: 'fonte', valor: prefs.fonte, aoMudar: (valor) => mudar({ fonte: valor }),
    itens: [
      { valor: 'sem-serifa', nome: 'Sem serifa', rotulo: 'Sem serifa' },
      { valor: 'serifa', nome: 'Serifa', rotulo: 'Serifa', estilo: 'font-family: var(--fonte-serifa); font-size: 17px' },
      { valor: 'manuscrita', nome: 'À mão', rotulo: 'À mão', estilo: 'font-family: var(--fonte-mao); font-size: 19px; font-weight: 400' },
    ],
  });
  const revelar = seletorOpcoes({
    legenda: 'Ao mostrar a resposta', nome: 'revelar', valor: prefs.revelar, aoMudar: (valor) => mudar({ revelar: valor }),
    itens: [
      { valor: 'virar', nome: 'Virar a carta' },
      { valor: 'abaixo', nome: 'Mostrar embaixo da pergunta' },
    ],
  });
  const mostrarPergunta = chave({ rotulo: 'Manter a pergunta na carta depois de revelar', valor: prefs.mostrarPergunta, aoMudar: (valor) => mudar({ mostrarPergunta: valor }) });
  const embaralhar = chave({ rotulo: 'Embaralhar a ordem dos cartões em cada sessão', valor: prefs.embaralhar, aoMudar: (valor) => mudar({ embaralhar: valor }) });
  const tema = seletorOpcoes({
    legenda: 'Tema', nome: 'tema', valor: prefs.tema, aoMudar: (valor) => mudar({ tema: valor }),
    itens: [
      { valor: 'claro', nome: 'Claro' },
      { valor: 'escuro', nome: 'Escuro' },
      { valor: 'sistema', nome: 'Igual ao sistema' },
    ],
  });

  main.append(h('div', { class: 'pagina' },
    h('header', { class: 'cabeca' },
      h('div', { class: 'cabeca-texto' },
        h('h1', { class: 'titulo', tabindex: '-1' }, 'Preferências'),
        h('p', { class: 'subtitulo' }, 'Deixe a carta do jeito que você lê melhor. Vale para todas as sessões, em qualquer navegador onde você entrar.'))),
    h('div', { class: 'prefs' },
      h('div', {},
        h('section', { class: 'prefs-grupo ficha', 'aria-labelledby': 'prefs-texto' },
          h('h2', { id: 'prefs-texto' }, 'Texto da carta'), tamanhoDaPergunta.el, tamanhoDaResposta.el, fonte.el),
        h('section', { class: 'prefs-grupo ficha', 'aria-labelledby': 'prefs-revelar' },
          h('h2', { id: 'prefs-revelar' }, 'Na hora da resposta'), revelar.el, mostrarPergunta.el),
        h('section', { class: 'prefs-grupo ficha', 'aria-labelledby': 'prefs-sessao' },
          h('h2', { id: 'prefs-sessao' }, 'Sessão e aparência'), embaralhar.el, tema.el,
          h('p', { class: 'dica' }, 'Durante o estudo, ', kbd('+'), ' e ', kbd('-'), ' também mudam o tamanho do texto.'))),
      h('aside', { class: 'prefs-previa', 'aria-label': 'Prévia da carta' },
        exemplo.el,
        h('div', { class: 'estudo-acoes mostrar' }, virar),
        salvo))));

  // Sair da tela no meio da pausa grava na hora, para a última mudança não se perder.
  return () => {
    clearTimeout(espera);
    if (pendente) gravar();
    document.title = 'Recall';
  };
}
