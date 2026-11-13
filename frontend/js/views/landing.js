/* Apresentação para quem ainda não entrou. A landing e as bibliotecas de movimento de
   frontend/vendor carregam só quando esta rota abre, para não pesar nas telas da conta.
   Nada aqui chama a API. */
export async function renderLanding(main) {
  const { montarLanding } = await import('../landing/pagina.js');
  return montarLanding(main);
}
