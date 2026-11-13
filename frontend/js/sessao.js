/* Quem está logado e as preferências dessa conta. A fonte da verdade é o servidor; aqui fica a
   cópia da página atual, e quem precisa reagir à troca (nav, roteador) assina com aoMudarSessao.
   O tema das preferências vai para o data-tema do html. */
import { conta } from './api.js';

let usuario = null;
let preferencias = null;

/* Igual ao preferenciasPadrao de Nucleo.Preferencias: vale para visitante e até a API responder. */
export const PREFERENCIAS_PADRAO = Object.freeze({
  tamanhoPergunta: 3, tamanhoResposta: 3, mostrarPergunta: true, revelar: 'virar',
  fonte: 'sem-serifa', tema: 'sistema', embaralhar: false,
});

export function preferenciasAtuais() {
  return preferencias ?? PREFERENCIAS_PADRAO;
}

export function aplicarTema(tema) {
  if (tema === 'sistema') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.dataset.tema = tema;
}

export function definirPreferencias(novas) {
  preferencias = novas;
  aplicarTema(preferenciasAtuais().tema);
}

export async function carregarPreferencias() {
  definirPreferencias(usuario ? await conta.preferencias() : null);
  return preferenciasAtuais();
}

/* Grava as preferências inteiras; a cópia local só muda depois que o servidor aceitou. */
export async function salvarPreferencias(novas) {
  definirPreferencias(await conta.salvarPreferencias(novas));
  return preferenciasAtuais();
}
const ouvintes = new Set();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte(usuario);
}

export function usuarioAtual() {
  return usuario;
}

export function definirUsuario(novo) {
  usuario = novo;
  avisar();
}

export function aoMudarSessao(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

// A API responde null para visitante; um erro aqui é falha de verdade e sobe para o app.
export async function carregarSessao() {
  definirUsuario(await conta.atual());
  return usuario;
}

export async function sair() {
  await conta.sair();
  definirUsuario(null);
  definirPreferencias(null);
}

export function primeiroNome(u) {
  return (u?.nome ?? '').trim().split(/\s+/)[0] ?? '';
}

export function inicial(u) {
  return (primeiroNome(u)[0] ?? '?').toLocaleUpperCase('pt-BR');
}
