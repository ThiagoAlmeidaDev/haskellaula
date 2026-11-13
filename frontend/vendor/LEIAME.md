# Bibliotecas de terceiros da landing

Arquivos prontos, servidos pelo próprio executável como o resto de `frontend/`. Não há
`npm install` no projeto: o que está aqui é o que o navegador recebe. Só a landing
(`frontend/js/landing/`) importa estes arquivos, e só quando a rota `#/` abre para um visitante.

| Biblioteca | Versão | Licença | Arquivos | Para quê |
| --- | --- | --- | --- | --- |
| GSAP | 3.15.0 | [Standard "no charge" license](https://gsap.com/standard-license) | `gsap/` | Timeline, ScrollTrigger (pin e scrub), SplitText (revelação por linha, palavra e letra), CustomEase |
| Lenis | 1.3.27 | MIT (`LICENSE-lenis`) | `lenis.js` | Scroll suave, só no perfil "pleno" (ponteiro fino, tela larga) |
| three.js | 0.187.0 | MIT (`three/LICENSE`) | `three/three.js` | Cena 3D do maço no herói, só no perfil "pleno" |

## Como os arquivos foram gerados

GSAP e Lenis são os módulos ES do pacote npm, minificados um a um com `terser --module -c -m`,
mantendo o comentário de licença. Os imports relativos com `.js` funcionam no navegador sem bundler.

- GSAP: `index.js`, `gsap-core.js`, `CSSPlugin.js`, `ScrollTrigger.js`, `Observer.js`,
  `SplitText.js`, `CustomEase.js` e `utils/paths.js`, da raiz do pacote `gsap@3.15.0`.
- Lenis: `dist/lenis.mjs` de `lenis@1.3.27`, salvo como `lenis.js`.

O three.js é um recorte com só as classes que `frontend/js/landing/cena-baralho.js` importa
(o pacote inteiro minificado passa de 1,5 MB). Para regerar depois de mudar esses imports, numa
pasta fora do projeto:

```sh
npm install three@0.187.0 esbuild@0.24.2
echo "export { <os nomes importados pela cena> } from 'three';" > entrada-three.js
npx esbuild entrada-three.js --bundle --format=esm --minify --legal-comments=inline --target=es2020 --outfile=three.js
```

e copie o `three.js` gerado para `frontend/vendor/three/`. Importar da cena uma classe que não
está no recorte quebra o carregamento do módulo, com erro no console.
