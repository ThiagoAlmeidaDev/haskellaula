/* Painel de quem está logado: o dia em uma ficha (quantos cartões esperam e o botão de estudar
   tudo), o resumo de estudo ao lado e, embaixo, só os baralhos com pendência. A gestão completa
   dos baralhos fica em #/baralhos. */
import { baralhos as apiBaralhos, conta as apiConta } from '../api.js';
import { h, icone, plural, formatarNumero, diaCurto, diaDaSemana, diasAte } from '../dom.js';
import { pedirNovoBaralho } from '../estado.js';
import { primeiroNome, usuarioAtual } from '../sessao.js';
import { abortado, estadoErro, esqueleto } from './comum.js';
import { linhaBaralho } from './componentes.js';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 5) return 'Boa noite';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function fichaDoDia(lista) {
  const total = lista.reduce((s, b) => s + b.paraHoje, 0);
  const comPendencia = lista.filter((b) => b.paraHoje > 0);
  let titulo;
  let sub;
  let acoes;
  if (lista.length === 0) {
    titulo = 'Comece pelo primeiro baralho';
    sub = 'Um baralho reúne os cartões de um assunto. Crie um e escreva frente e verso; o Recall cuida de quando revisar.';
    acoes = [h('button', { class: 'btn btn-sol btn-alto', type: 'button', onclick: pedirNovoBaralho }, icone('mais'), 'Criar baralho')];
  } else if (total === 0) {
    titulo = 'Tudo revisado por hoje';
    sub = 'Os cartões voltam no dia que o SM‑2 agendou. Quer estudar mais? Escreva cartões novos: eles entram na revisão de hoje.';
    acoes = [h('a', { class: 'btn btn-sec btn-alto', href: '#/baralhos' }, icone('mais'), 'Adicionar cartões')];
  } else {
    titulo = [h('span', { class: 'numero' }, formatarNumero(total)), total === 1 ? ' cartão espera você' : ' cartões esperam você'];
    sub = comPendencia.length > 1
      ? `Em ${comPendencia.length} baralhos. Estude tudo de uma vez ou escolha por onde começar.`
      : `Todos em ${comPendencia[0].nome}.`;
    acoes = [
      h('a', { class: 'btn btn-sol btn-alto', href: comPendencia.length > 1 ? '#/estudar/todos' : `#/estudar/${comPendencia[0].id}` },
        comPendencia.length > 1 ? 'Estudar tudo' : `Estudar ${comPendencia[0].nome}`),
      comPendencia.length > 1 ? h('a', { class: 'btn btn-sec btn-alto', href: '#/estudar' }, 'Escolher baralho') : null,
    ];
  }
  return h('section', { class: 'dia ficha', 'aria-labelledby': 'dia-titulo' },
    h('p', { class: 'eyebrow' }, `${saudacao()}, ${primeiroNome(usuarioAtual())}`),
    h('h1', { class: 'dia-titulo', id: 'dia-titulo', tabindex: '-1' }, titulo),
    h('p', { class: 'dia-sub' }, sub),
    h('div', { class: 'dia-acoes' }, acoes));
}

/* As barras dos 14 dias usam a mesma escala entre si; o dia de hoje fica no vermelho do marcador. */
function fichaResumo(r) {
  const maximo = Math.max(1, ...r.atividade.map((a) => a.quantidade));
  return h('aside', { class: 'resumo ficha', 'aria-labelledby': 'resumo-titulo' },
    h('h2', { class: 'eyebrow', id: 'resumo-titulo' }, 'Seu estudo'),
    h('div', { class: 'resumo-numeros' },
      h('div', {}, h('p', { class: 'resumo-valor' }, formatarNumero(r.sequencia)), h('p', { class: 'resumo-rotulo' }, r.sequencia === 1 ? 'dia seguido' : 'dias seguidos')),
      h('div', {}, h('p', { class: 'resumo-valor' }, formatarNumero(r.revisoesHoje)), h('p', { class: 'resumo-rotulo' }, r.revisoesHoje === 1 ? 'revisão hoje' : 'revisões hoje'))),
    h('div', { class: 'atividade', role: 'img', 'aria-label': `Revisões nos últimos 14 dias: ${r.atividade.map((a) => a.quantidade).join(', ')}` },
      r.atividade.map((a, i) => h('span', {
        class: i === r.atividade.length - 1 ? 'atividade-barra hoje' : 'atividade-barra',
        style: `height: ${a.quantidade === 0 ? 3 : Math.max(6, Math.round((a.quantidade / maximo) * 44))}px`,
        title: `${diaCurto(a.dia)}: ${plural(a.quantidade, 'revisão', 'revisões')}`,
      }))),
    h('p', { class: 'resumo-eixo', 'aria-hidden': 'true' }, h('span', {}, diaCurto(r.atividade[0].dia)), h('span', {}, 'hoje')));
}

/* Os próximos 14 dias da API (de amanhã em diante): uma coluna por dia com a contagem, todas na
   mesma escala. Tocar num dia mostra de quais baralhos são as cartas; amanhã começa escolhido. */
function fichaAgenda(proximos) {
  const total = proximos.reduce((s, p) => s + p.quantidade, 0);
  const maximo = Math.max(1, ...proximos.map((p) => p.quantidade));
  const nomeDoDia = (p) => (diasAte(p.dia) === 1 ? 'Amanhã' : `${diaDaSemana(p.dia)}, ${diaCurto(p.dia)}`);
  const detalhe = h('div', { class: 'agenda-detalhe', 'aria-live': 'polite' });
  const dias = proximos.map((p) => h('button', {
    class: 'agenda-dia', type: 'button', 'aria-pressed': 'false',
    'aria-label': `${nomeDoDia(p)}: ${plural(p.quantidade, 'cartão', 'cartões')}`,
    onclick: () => escolher(p),
  },
  h('span', { class: 'agenda-semana' }, diasAte(p.dia) === 1 ? 'amanhã' : diaDaSemana(p.dia)),
  h('span', { class: 'agenda-data' }, diaCurto(p.dia).split(' ')[0]),
  h('span', { class: 'agenda-barra', style: `height: ${p.quantidade === 0 ? 3 : Math.max(8, Math.round((p.quantidade / maximo) * 56))}px` }),
  h('span', { class: 'agenda-quantidade' }, formatarNumero(p.quantidade))));

  function escolher(p) {
    dias.forEach((b, i) => b.setAttribute('aria-pressed', String(proximos[i] === p)));
    detalhe.replaceChildren(
      h('p', { class: 'agenda-detalhe-titulo' }, nomeDoDia(p), ': ', h('strong', {}, plural(p.quantidade, 'cartão', 'cartões'))),
      p.baralhos.length
        ? h('ul', { class: 'agenda-baralhos' }, p.baralhos.map((b) => h('li', {},
          h('a', { href: `#/baralho/${b.id}` }, b.nome), h('span', { class: 'mono' }, formatarNumero(b.quantidade)))))
        : h('p', { class: 'vazio-inline' }, 'Nenhuma carta volta neste dia.'));
  }

  if (proximos.length) escolher(proximos[0]);
  return h('section', { class: 'secao', 'aria-labelledby': 'titulo-agenda' },
    h('div', { class: 'secao-cabeca' },
      h('h2', { class: 'secao-titulo', id: 'titulo-agenda' }, 'Próximos 14 dias', h('span', { class: 'mono' }, plural(total, 'cartão', 'cartões')))),
    h('div', { class: 'agenda ficha' }, h('div', { class: 'agenda-dias' }, dias), detalhe));
}

export async function renderHome(main, _params, { signal }) {
  main.append(h('div', { class: 'painel-topo', 'aria-busy': 'true' }, esqueleto('esq-resumo', 2)));

  let lista;
  let resumo;
  try {
    [lista, resumo] = await Promise.all([apiBaralhos.listar({ signal }), apiConta.resumo({ signal })]);
  } catch (erro) {
    if (!abortado(erro)) estadoErro(main, erro);
    return undefined;
  }

  const comPendencia = lista.filter((b) => b.paraHoje > 0).sort((a, b) => b.paraHoje - a.paraHoje);
  const emDia = lista.length - comPendencia.length;

  let secao = null;
  if (comPendencia.length) {
    secao = h('section', { class: 'secao', 'aria-labelledby': 'titulo-hoje' },
      h('div', { class: 'secao-cabeca' },
        h('h2', { class: 'secao-titulo', id: 'titulo-hoje' }, 'Para hoje', h('span', { class: 'mono' }, String(comPendencia.length))),
        h('a', { class: 'btn btn-sec btn-sm', href: '#/baralhos' }, `Todos os baralhos (${lista.length})`)),
      h('ul', { class: 'lista ficha' }, comPendencia.map((b) => linhaBaralho(b))),
      emDia > 0 ? h('p', { class: 'vazio-inline', style: 'margin-top: 12px' }, `${plural(emDia, 'baralho está', 'baralhos estão')} em dia.`) : null);
  } else if (lista.length) {
    secao = h('section', { class: 'secao', 'aria-labelledby': 'titulo-baralhos' },
      h('div', { class: 'secao-cabeca' },
        h('h2', { class: 'secao-titulo', id: 'titulo-baralhos' }, 'Seus baralhos', h('span', { class: 'mono' }, String(lista.length))),
        h('a', { class: 'btn btn-sec btn-sm', href: '#/baralhos' }, 'Gerenciar baralhos')),
      h('ul', { class: 'lista ficha' }, lista.slice(0, 5).map((b) => linhaBaralho(b))));
  }

  main.replaceChildren(h('div', { class: 'painel-topo' }, fichaDoDia(lista), fichaResumo(resumo)),
    lista.length ? fichaAgenda(resumo.proximos) : '', secao ?? '');
  return undefined;
}
