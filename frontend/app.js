/* Entrada do frontend: confere a sessão, liga o roteador por hash às views e mantém a barra de
   navegação em sintonia com quem está logado e com quantos cartões esperam hoje. Rota da conta
   sem sessão vai para #/entrar e volta depois. */
import { api, baralhos as apiBaralhos } from './js/api.js';
import { h, ehMac, toast, logoMarca } from './js/dom.js';
import { iniciarGaveta, fecharGaveta } from './js/gaveta.js';
import { guardarDestino } from './js/estado.js';
import { aoMudarSessao, carregarPreferencias, carregarSessao, definirUsuario, inicial, sair, usuarioAtual } from './js/sessao.js';
import { renderPreferencias } from './js/views/preferencias.js';
import { renderHome } from './js/views/home.js';
import { renderLanding } from './js/views/landing.js';
import { renderEntrar, renderCriarConta } from './js/views/conta.js';
import { renderBaralho } from './js/views/baralho.js';
import { renderBaralhos } from './js/views/baralhos.js';
import { renderEstudo, renderEscolhaEstudo } from './js/views/estudo.js';
import { renderEstatisticas } from './js/views/estatisticas.js';
import { iniciarPaleta, abrirPaleta, fecharPaleta } from './js/paleta.js';

export { api };

function inicio(main, params, opcoes) {
  return usuarioAtual() ? renderHome(main, params, opcoes) : renderLanding(main, params, opcoes);
}

/* acesso: "livre" abre para todos, "visitante" só sem sessão (login e cadastro), "conta" exige sessão. */
const ROTAS = [
  { padrao: /^\/$/, view: inicio, nav: 'inicio', acesso: 'livre' },
  { padrao: /^\/entrar$/, view: renderEntrar, nav: 'entrar', acesso: 'visitante' },
  { padrao: /^\/criar-conta$/, view: renderCriarConta, nav: 'criar-conta', acesso: 'visitante' },
  { padrao: /^\/baralhos$/, view: renderBaralhos, nav: 'baralhos', acesso: 'conta' },
  { padrao: /^\/baralho\/(\d+)$/, view: renderBaralho, nav: 'baralhos', acesso: 'conta' },
  { padrao: /^\/estudar$/, view: renderEscolhaEstudo, nav: 'estudar', acesso: 'conta' },
  { padrao: /^\/estudar\/todos$/, view: renderEstudo, nav: 'estudar', acesso: 'conta' },
  { padrao: /^\/estudar\/(\d+)$/, view: renderEstudo, nav: 'estudar', acesso: 'conta' },
  { padrao: /^\/estatisticas\/(\d+)$/, view: renderEstatisticas, nav: 'baralhos', acesso: 'conta' },
  { padrao: /^\/preferencias$/, view: renderPreferencias, nav: null, acesso: 'conta' },
];

function naoEncontrada(main) {
  main.append(h('section', { class: 'estado estado-pagina' },
    h('h1', { class: 'estado-titulo', tabindex: '-1' }, 'Página não encontrada'),
    h('p', { class: 'estado-texto' }, 'O endereço não corresponde a nenhuma tela do Recall.'),
    h('a', { class: 'btn btn-pri', href: '#/' }, 'Ir para o início')));
}

export function resolverRota(hash) {
  const caminho = hash.replace(/^#/, '') || '/';
  for (const rota of ROTAS) {
    const achou = caminho.match(rota.padrao);
    if (achou) return { ...rota, params: { id: achou[1] ? Number(achou[1]) : null } };
  }
  return { view: naoEncontrada, params: {}, nav: null, acesso: 'livre' };
}

const main = document.getElementById('conteudo');
let atual = { controle: null, limpar: null };

export async function render(view, params = {}, { focar = false } = {}) {
  atual.controle?.abort();
  if (typeof atual.limpar === 'function') atual.limpar();

  const controle = new AbortController();
  atual = { controle, limpar: null };
  main.replaceChildren();
  window.scrollTo(0, 0);

  const limpar = await view(main, params, { signal: controle.signal });
  if (controle.signal.aborted) {
    if (typeof limpar === 'function') limpar();
    return;
  }
  atual.limpar = limpar;
  if (focar && !main.contains(document.activeElement)) (main.querySelector('h1') ?? main).focus({ preventScroll: true });
}

function marcarNav(nav) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

// history.replaceState não dispara hashchange: o redirecionamento chama navegar de novo.
function redirecionar(hash, opcoes) {
  history.replaceState(null, '', hash);
  navegar(opcoes);
}

function navegar({ focar }) {
  const rota = resolverRota(location.hash);
  if (rota.acesso === 'conta' && !usuarioAtual()) {
    guardarDestino(location.hash);
    redirecionar('#/entrar', { focar });
    return;
  }
  if (rota.acesso === 'visitante' && usuarioAtual()) {
    redirecionar('#/', { focar });
    return;
  }
  marcarNav(rota.nav);
  fecharGaveta();
  if (usuarioAtual()) atualizarContagemDoDia();
  render(rota.view, rota.params, { focar }).catch((erro) => {
    if (erro.name !== 'AbortError') throw erro;
  });
}

const contagemDoDia = document.querySelector('[data-contagem-dia]');

async function atualizarContagemDoDia() {
  const lista = await apiBaralhos.listar();
  const total = lista.reduce((s, b) => s + b.paraHoje, 0);
  contagemDoDia.textContent = String(total);
  contagemDoDia.hidden = total === 0;
  contagemDoDia.setAttribute('aria-label', `${total} para hoje`);
}

const menuConta = document.getElementById('menu-conta');
const botaoConta = document.querySelector('[data-acao="conta"]');

function desenharSessao(usuario) {
  document.body.dataset.sessao = usuario ? 'conta' : 'visitante';
  if (!usuario) {
    if (menuConta.matches(':popover-open')) menuConta.hidePopover();
    fecharPaleta({ restaurarFoco: false });
    return;
  }
  carregarPreferencias().catch((erro) => toast(erro.message));
  botaoConta.textContent = inicial(usuario);
  botaoConta.setAttribute('aria-label', `Conta de ${usuario.nome}`);
  menuConta.querySelector('.menu-nome').textContent = usuario.nome;
  menuConta.querySelector('.menu-email').textContent = usuario.email;
}

// O popover abre fora da nav (top layer); a posição sai do botão que o abriu.
menuConta.addEventListener('beforetoggle', (e) => {
  if (e.newState !== 'open') return;
  const caixa = botaoConta.getBoundingClientRect();
  menuConta.style.top = `${caixa.bottom + 10}px`;
  menuConta.style.right = `${Math.max(16, window.innerWidth - caixa.right)}px`;
});

menuConta.querySelector('[data-acao="preferencias"]').addEventListener('click', () => menuConta.hidePopover());

menuConta.querySelector('[data-acao="sair"]').addEventListener('click', async () => {
  menuConta.hidePopover();
  try {
    await sair();
    if (location.hash === '#/') navegar({ focar: true });
    else location.hash = '#/';
  } catch (erro) {
    toast(erro.message);
  }
});

window.addEventListener('recall:sem-sessao', () => {
  if (!usuarioAtual()) return;
  definirUsuario(null);
  toast('Sua sessão terminou. Entre de novo para continuar.');
  guardarDestino(location.hash);
  location.hash = '#/entrar';
});

aoMudarSessao(desenharSessao);

document.querySelector('[data-atalho-paleta]').textContent = ehMac ? '⌘ K' : 'Ctrl K';
document.querySelector('[data-acao="paleta"]').addEventListener('click', () => abrirPaleta());
document.querySelector('[data-logo]').prepend(logoMarca());
iniciarGaveta();

iniciarPaleta();
window.addEventListener('hashchange', () => navegar({ focar: true }));
if (!location.hash) history.replaceState(null, '', '#/');

try {
  await carregarSessao();
  await carregarPreferencias();
} catch (erro) {
  definirUsuario(null);
  toast(erro.message);
}
navegar({ focar: false });
