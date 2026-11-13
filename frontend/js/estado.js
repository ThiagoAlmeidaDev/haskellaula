/* Pedidos que atravessam uma troca de rota: abrir a gaveta de novo baralho vindo da paleta,
   abrir a de novos cartões logo depois de criar um baralho, e voltar à página que a pessoa
   tentou abrir antes de fazer login. */
let novoBaralhoPendente = false;
let adicionarCartaoPendente = false;
let destinoPendente = null;

export function pedirAdicionarCartao() {
  adicionarCartaoPendente = true;
}

export function consumirAdicionarCartao() {
  const pendente = adicionarCartaoPendente;
  adicionarCartaoPendente = false;
  return pendente;
}

export function pedirNovoBaralho() {
  if (location.hash === '#/baralhos') {
    window.dispatchEvent(new CustomEvent('recall:novo-baralho'));
  } else {
    novoBaralhoPendente = true;
    location.hash = '#/baralhos';
  }
}

export function consumirNovoBaralho() {
  const pendente = novoBaralhoPendente;
  novoBaralhoPendente = false;
  return pendente;
}

export function guardarDestino(hash) {
  destinoPendente = hash;
}

export function consumirDestino() {
  const destino = destinoPendente;
  destinoPendente = null;
  return destino;
}
