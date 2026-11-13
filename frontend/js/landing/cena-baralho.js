/* Cena 3D do herói: o maço em WebGL, com a luz principal seguindo o ponteiro. Com o cursor sobre
   uma carta o maço para, a carta sobe em destaque e vira no clique; ao sair ela desvira. A cena só lê params (entrada, fechar, voo); quem anima
   esses números é o motor da landing. As faces são desenhadas em canvas com as mesmas cores,
   estampas e fonte das cartas do app. */
import {
  AmbientLight, CanvasTexture, DirectionalLight, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PCFShadowMap, PerspectiveCamera, PointLight, Raycaster, SRGBColorSpace, Scene, Shape,
  ShapeGeometry, SpotLight, Vector2, WebGLRenderer,
} from '../../vendor/three/three.js';

const LARGURA = 1.9;
const ALTURA = 2.6;
const RAIO = 0.16;
const ESPESSURA = 0.03;
const BORDA = 0.035;
const DISTANCIA = 15;
const CAMPO = 30;
/* Quanto o leque aberto sobe e desce a partir do centro do maço, em unidades da cena, já com a
   flutuação: a carta do meio sobe 1,3; as das pontas, inclinadas, descem quase 2. */
const LEQUE_ACIMA = 1.4;
const LEQUE_ABAIXO = 2.05;
const TEX_L = 640;
const TEX_A = Math.round((TEX_L * ALTURA) / LARGURA);
/* Uma carta de 280px no CSS vira 640px de textura: estampa e traço escalam junto. */
const ESCALA = TEX_L / 280;

const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const misturar = (a, b, t) => a + (b - a) * t;
const saida = (t) => 1 - (1 - t) ** 3;
const meio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function lerCor(nome) {
  const amostra = document.createElement('span');
  amostra.dataset.cor = nome;
  amostra.hidden = true;
  document.body.append(amostra);
  const estilo = getComputedStyle(amostra);
  const cores = { fundo: estilo.getPropertyValue('--cor').trim(), tinta: estilo.getPropertyValue('--cor-tinta').trim() };
  amostra.remove();
  return cores;
}

function retanguloArredondado(l, a, r) {
  const x = -l / 2;
  const y = -a / 2;
  const s = new Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + l - r, y);
  s.quadraticCurveTo(x + l, y, x + l, y + r);
  s.lineTo(x + l, y + a - r);
  s.quadraticCurveTo(x + l, y + a, x + l - r, y + a);
  s.lineTo(x + r, y + a);
  s.quadraticCurveTo(x, y + a, x, y + a - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ShapeGeometry dá UV em coordenadas do desenho; a textura precisa de 0 a 1 na face inteira. */
function geometriaDaFace(l, a, r) {
  const g = new ShapeGeometry(retanguloArredondado(l, a, r), 10);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, pos.getX(i) / l + 0.5, pos.getY(i) / a + 0.5);
  return g;
}

function estampa(g, padrao, altura) {
  g.save();
  g.beginPath();
  g.rect(0, 0, TEX_L, altura);
  g.clip();
  if (padrao === 'bolinhas') {
    g.fillStyle = 'rgba(0, 0, 0, 0.2)';
    const passo = 14 * ESCALA;
    for (let y = passo / 2; y < altura + passo; y += passo) {
      for (let x = passo / 2; x < TEX_L + passo; x += passo) {
        g.beginPath();
        g.arc(x, y, 2.6 * ESCALA, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (padrao === 'listras') {
    g.fillStyle = 'rgba(0, 0, 0, 0.16)';
    g.rotate(-Math.PI / 4);
    for (let x = -TEX_L; x < TEX_L * 1.5; x += 14 * ESCALA) g.fillRect(x, -TEX_L, 6 * ESCALA, TEX_L * 3);
  } else if (padrao === 'xadrez') {
    g.fillStyle = 'rgba(0, 0, 0, 0.16)';
    const lado = 9 * ESCALA;
    for (let y = 0; y < altura; y += lado) {
      for (let x = 0; x < TEX_L; x += lado) {
        if ((Math.round(x / lado) + Math.round(y / lado)) % 2 === 0) g.fillRect(x, y, lado, lado);
      }
    }
  }
  g.restore();
}

function quebrarLinhas(g, texto, largura) {
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(' ')) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && g.measureText(tentativa).width > largura) {
      linhas.push(atual);
      atual = palavra;
    } else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/* Escreve o texto centrado em y, diminuindo a letra até caber em três linhas. */
function blocoDeTexto(g, texto, { peso, tamanho, largo = false, cor, centro }) {
  g.fillStyle = cor;
  g.fontStretch = largo ? 'expanded' : 'normal';
  let t = tamanho;
  let linhas;
  do {
    g.font = `${peso} ${t}px Archivo`;
    linhas = quebrarLinhas(g, texto, TEX_L - 120);
    t -= 4;
  } while ((linhas.length > 3 || linhas.some((l) => g.measureText(l).width > TEX_L - 100)) && t > 24);
  const entrelinha = (t + 4) * 1.18;
  const topo = centro - ((linhas.length - 1) * entrelinha) / 2;
  linhas.forEach((linha, i) => g.fillText(linha, TEX_L / 2, topo + i * entrelinha));
  g.fontStretch = 'normal';
}

function desenharFace(dados, lado) {
  const tela = document.createElement('canvas');
  tela.width = TEX_L;
  tela.height = TEX_A;
  const g = tela.getContext('2d');
  const capa = lerCor(dados.cor);
  const faixa = Math.round(TEX_A * 0.12);

  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, TEX_L, TEX_A);
  g.fillStyle = capa.fundo;
  g.fillRect(0, 0, TEX_L, faixa);
  estampa(g, dados.padrao, faixa);
  g.fillStyle = '#000000';
  g.fillRect(0, faixa, TEX_L, 2 * ESCALA);

  g.textBaseline = 'middle';
  g.fillStyle = capa.tinta;
  g.font = '700 30px Archivo';
  g.textAlign = 'left';
  g.fillText(dados.baralho, 44, faixa / 2 + 2);
  g.textAlign = 'right';
  g.fillText('Recall', TEX_L - 44, faixa / 2 + 2);

  g.textAlign = 'center';
  const centro = faixa + (TEX_A - faixa) / 2;
  if (lado === 'frente') {
    blocoDeTexto(g, dados.pergunta, { peso: 700, tamanho: 62, cor: '#000000', centro });
  } else {
    blocoDeTexto(g, dados.pergunta, { peso: 600, tamanho: 30, cor: '#4a4f57', centro: centro - 92 });
    g.fillStyle = '#000000';
    g.fillRect(TEX_L / 2 - 36 * ESCALA / 2, centro - 44, 36 * ESCALA, 3 * ESCALA / 2);
    blocoDeTexto(g, dados.resposta, { peso: 800, tamanho: 70, largo: true, cor: '#000000', centro: centro + 36 });
  }
  return tela;
}

/* Fora da virada e do túnel as cartas só giram no próprio plano (rz) e ficam paralelas, com folga de
   profundidade entre elas: assim nenhuma atravessa a vizinha. */
function poseDe(i, n, ancoraX, ancoraY) {
  const k = i - (n - 1) / 2;
  const a = k * 0.12;
  const raio = 3.1;
  const giro = i * 2.39996;
  const distancia = 2.3 + (i % 3) * 0.7;
  return {
    fora: { x: k * 0.7, y: -7, z: -2 + i * 0.1, rx: 0, ry: 0, rz: k * 0.45 },
    pilha: { x: ancoraX + i * 0.018, y: ancoraY - i * 0.014, z: i * 0.1, rx: 0, ry: 0, rz: Math.sin(i * 7.3) * 0.07 },
    leque: { x: ancoraX + Math.sin(a) * raio, y: ancoraY + Math.cos(a) * raio - raio, z: i * 0.1, rx: 0, ry: 0, rz: -a },
    centro: { x: i * 0.01, y: -i * 0.01, z: i * 0.1, rx: 0, ry: 0, rz: Math.sin(i * 7.3) * 0.05 },
    tunel: { x: Math.cos(giro) * distancia, y: Math.sin(giro) * distancia * 0.62, z: -1.5 - i * 2.4, rx: Math.sin(giro) * 0.5, ry: Math.cos(giro) * 0.7, rz: giro * 0.25 },
  };
}

function misturarPose(a, b, t) {
  return {
    x: misturar(a.x, b.x, t), y: misturar(a.y, b.y, t), z: misturar(a.z, b.z, t),
    rx: misturar(a.rx, b.rx, t), ry: misturar(a.ry, b.ry, t), rz: misturar(a.rz, b.rz, t),
  };
}

/* ancora() diz, de 0 a 1 na largura do palco, onde fica o centro do maço, para ele seguir a grade do
   texto; faixa() diz, de 0 a 1 na altura, entre que linhas o maço aberto precisa caber. */
export async function criarCenaBaralho(palco, cartas, params, { ancora = () => 0.5, faixa = () => ({ topo: 0, base: 1 }) } = {}) {
  await Promise.all([
    document.fonts.load('700 30px Archivo'),
    document.fonts.load('600 30px Archivo'),
    document.fonts.load('800 expanded 70px Archivo'),
  ]);

  const raiz = getComputedStyle(document.documentElement);
  const cobalto = raiz.getPropertyValue('--cobalto').trim();
  const sol = raiz.getPropertyValue('--sol').trim();

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.classList.add('heroi-canvas');

  const cena = new Scene();
  const camera = new PerspectiveCamera(CAMPO, 1, 0.1, 80);
  camera.position.set(0, 0, DISTANCIA);
  const maco = new Group();
  cena.add(maco);

  cena.add(new AmbientLight(0xffffff, 1.5));
  const chave = new SpotLight(0xffffff, 110, 0, 0.55, 0.9, 2);
  chave.position.set(2, 3, 10);
  chave.target = maco;
  chave.castShadow = true;
  chave.shadow.mapSize.set(1024, 1024);
  chave.shadow.bias = -0.002;
  chave.shadow.normalBias = 0.05;
  cena.add(chave);
  const fria = new DirectionalLight(cobalto, 0.55);
  fria.position.set(-7, 2.5, 3);
  cena.add(fria);
  const quente = new PointLight(sol, 5, 0, 2);
  quente.position.set(5, -4, 3);
  cena.add(quente);

  const geoBorda = new ExtrudeGeometry(retanguloArredondado(LARGURA, ALTURA, RAIO), { depth: ESPESSURA, bevelEnabled: false, curveSegments: 10 });
  geoBorda.translate(0, 0, -ESPESSURA / 2);
  const geoFace = geometriaDaFace(LARGURA - 2 * BORDA, ALTURA - 2 * BORDA, RAIO - BORDA * 0.6);
  const matBorda = new MeshStandardMaterial({ color: 0x000000, roughness: 0.4 });
  /* A área de toque não é desenhada e fica na pose de descanso da carta, sem subir nem girar com
     ela: se subisse, a carta erguida sairia de baixo do ponteiro na borda com a vizinha e as duas se
     alternariam; se girasse, de lado no meio da virada ela sumiria do raio. */
  const geoAlvo = geometriaDaFace(LARGURA, ALTURA, RAIO);
  const matAlvo = new MeshBasicMaterial({ visible: false, side: DoubleSide });
  const anisotropia = renderer.capabilities.getMaxAnisotropy();
  const descartaveis = [geoBorda, geoFace, matBorda, geoAlvo, matAlvo];

  const textura = (tela) => {
    const t = new CanvasTexture(tela);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = anisotropia;
    descartaveis.push(t);
    return t;
  };

  const pecas = cartas.map((dados) => {
    const matFrente = new MeshStandardMaterial({ map: textura(desenharFace(dados, 'frente')), roughness: 0.62 });
    const matVerso = new MeshStandardMaterial({ map: textura(desenharFace(dados, 'verso')), roughness: 0.62 });
    descartaveis.push(matFrente, matVerso);
    const borda = new Mesh(geoBorda, matBorda);
    const frente = new Mesh(geoFace, matFrente);
    frente.position.z = ESPESSURA / 2 + 0.002;
    const verso = new Mesh(geoFace, matVerso);
    verso.rotation.y = Math.PI;
    verso.position.z = -ESPESSURA / 2 - 0.002;
    const giro = new Group();
    for (const m of [borda, frente, verso]) {
      m.castShadow = true;
      m.receiveShadow = true;
      giro.add(m);
    }
    const alvo = new Mesh(geoAlvo, matAlvo);
    const grupo = new Group();
    grupo.add(giro);
    maco.add(grupo, alvo);
    return { grupo, giro, alvo, subir: 0, virar: 0, virarAlvo: 0 };
  });

  const ponteiro = { x: 0, y: 0, sx: 0, sy: 0 };
  const ndc = new Vector2(2, 2);
  const raio = new Raycaster();
  let sobre = -1;
  let ancoraX = 0;
  let ancoraY = 0;
  let visivel = true;
  let relogio = 0;
  let ultimo = performance.now();
  let quadro = 0;

  function medir() {
    const { width, height } = palco.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    /* Mede no enquadramento de repouso: durante o voo compor() muda o fov e a distância da câmera. */
    const meiaAltura = Math.tan((CAMPO * Math.PI) / 360) * DISTANCIA;
    const meiaLargura = meiaAltura * camera.aspect;
    const aoLado = camera.aspect > 1.2;
    /* Em tela menos larga o maço encolhe e sobe, para não cobrir o texto do pé do herói. Em tela
       baixa ele também encolhe até caber na faixa livre entre a barra e o pé. As posições são locais
       ao grupo escalado, por isso as âncoras são divididas pela escala. */
    let escala = Math.min(1, Math.max(0.7, camera.aspect / 1.6));
    let centroY = 0.5 + Math.max(0, 1.6 - camera.aspect) * 1.3;
    if (aoLado) {
      const { topo, base } = faixa();
      const yTopo = meiaAltura * (1 - 2 * topo);
      const yBase = meiaAltura * (1 - 2 * base);
      escala = Math.min(escala, Math.max(0.45, (yTopo - yBase) / (LEQUE_ACIMA + LEQUE_ABAIXO)));
      centroY = Math.min(Math.max(centroY, yBase + LEQUE_ABAIXO * escala), yTopo - LEQUE_ACIMA * escala);
    }
    maco.scale.setScalar(escala);
    ancoraX = (aoLado ? (ancora() * 2 - 1) * meiaLargura : 0) / escala;
    ancoraY = centroY / escala;
  }

  const aoMover = (e) => {
    ponteiro.x = (e.clientX / window.innerWidth) * 2 - 1;
    ponteiro.y = (e.clientY / window.innerHeight) * 2 - 1;
    const caixa = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - caixa.left) / caixa.width) * 2 - 1, -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
  };
  /* Fora da janela não chega pointermove: sem isto a última carta apontada ficaria em destaque. */
  const aoSairDaJanela = () => ndc.set(2, 2);
  const interativo = () => params.entrada >= 1.9 && params.fechar < 0.04;
  const aoClicar = () => {
    if (sobre < 0 || !interativo()) return;
    pecas[sobre].virarAlvo = pecas[sobre].virarAlvo ? 0 : 1;
  };

  function compor() {
    const n = pecas.length;
    const abrir = meio(limitar((params.entrada - 1) / 0.9));
    const fechar = meio(limitar(params.fechar));
    const voo = limitar(params.voo);
    const vooSuave = meio(voo);

    pecas.forEach((p, i) => {
      const poses = poseDe(i, n, ancoraX, ancoraY);
      const subida = saida(limitar((params.entrada - i * 0.06) / 0.62));
      let pose = misturarPose(poses.fora, poses.pilha, subida);
      pose = misturarPose(pose, poses.leque, abrir);
      const ondula = abrir * (1 - fechar);
      pose.y += Math.sin(relogio * 0.8 + i * 0.7) * 0.06 * ondula;
      pose.rz += Math.sin(relogio * 0.55 + i * 1.3) * 0.018 * ondula;
      pose = misturarPose(pose, poses.centro, fechar);
      /* No túnel a inclinação chega depois do afastamento, para as cartas já estarem longe umas das outras. */
      pose = misturarPose(pose, { ...poses.tunel, rx: poses.tunel.rx * vooSuave, ry: poses.tunel.ry * vooSuave }, vooSuave);

      const alvoSubir = i === sobre && interativo() ? 1 : 0;
      p.subir += (alvoSubir - p.subir) * 0.14;
      p.virar += (p.virarAlvo - p.virar) * 0.12;

      /* Erguida bem à frente do maço, a carta gira sem tocar nas outras; continua erguida até
         terminar de desvirar, mesmo depois que o ponteiro sai. */
      const ergue = Math.max(p.subir, Math.sin(p.virar * Math.PI));
      p.grupo.position.set(pose.x, pose.y + ergue * 0.35, pose.z + ergue * 1.9);
      p.grupo.scale.setScalar(1 + p.subir * 0.03);
      p.grupo.rotation.set(pose.rx, pose.ry, pose.rz * (1 - ergue * 0.6) + voo * (i - n / 2) * 0.12);
      p.giro.rotation.y = p.virar * Math.PI;
      p.alvo.position.set(pose.x, pose.y, pose.z);
      p.alvo.rotation.set(pose.rx, pose.ry, pose.rz + voo * (i - n / 2) * 0.12);
    });

    if (sobre < 0) {
      ponteiro.sx += (ponteiro.x - ponteiro.sx) * 0.06;
      ponteiro.sy += (ponteiro.y - ponteiro.sy) * 0.06;
    }
    const calma = 1 - vooSuave;
    maco.rotation.y = ponteiro.sx * 0.28 * calma;
    maco.rotation.x = ponteiro.sy * 0.14 * calma;
    chave.position.set(2 + ponteiro.sx * 5, 3 - ponteiro.sy * 3.5, 10);

    camera.position.z = DISTANCIA - vooSuave * 38;
    camera.fov = CAMPO + vooSuave * 26;
    camera.updateProjectionMatrix();
  }

  function apontar() {
    if (!interativo()) {
      sobre = -1;
      renderer.domElement.style.cursor = '';
      return;
    }
    raio.setFromCamera(ndc, camera);
    /* Enquanto o ponteiro ainda está sobre a carta em destaque, ela continua escolhida mesmo que
       outra esteja na frente nesse ponto. */
    const achados = raio.intersectObjects(pecas.map((p) => p.alvo), false);
    const continua = sobre >= 0 && achados.some((a) => a.object === pecas[sobre].alvo);
    const agora = continua ? sobre : achados.length ? pecas.findIndex((p) => p.alvo === achados[0].object) : -1;
    if (sobre >= 0 && agora !== sobre) pecas[sobre].virarAlvo = 0;
    sobre = agora;
    renderer.domElement.style.cursor = sobre >= 0 ? 'pointer' : '';
  }

  function desenhar(agora) {
    quadro = visivel ? requestAnimationFrame(desenhar) : 0;
    const dt = Math.min((agora - ultimo) / 1000, 0.05);
    ultimo = agora;
    if (sobre < 0) relogio += dt;
    apontar();
    compor();
    renderer.render(cena, camera);
  }

  function retomar() {
    if (quadro || !visivel) return;
    ultimo = performance.now();
    quadro = requestAnimationFrame(desenhar);
  }

  const observador = new ResizeObserver(medir);
  observador.observe(palco);
  const vigia = new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    if (visivel) retomar();
  });
  vigia.observe(palco);
  window.addEventListener('pointermove', aoMover, { passive: true });
  document.documentElement.addEventListener('pointerleave', aoSairDaJanela);
  renderer.domElement.addEventListener('click', aoClicar);

  palco.append(renderer.domElement);
  medir();
  retomar();

  return {
    destruir() {
      cancelAnimationFrame(quadro);
      quadro = 0;
      visivel = false;
      observador.disconnect();
      vigia.disconnect();
      window.removeEventListener('pointermove', aoMover);
      document.documentElement.removeEventListener('pointerleave', aoSairDaJanela);
      renderer.domElement.removeEventListener('click', aoClicar);
      for (const item of descartaveis) item.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
