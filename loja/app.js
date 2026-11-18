// Loja SIER: catálogo, carrinho, frete, dados do comprador e apresentação em capítulos.
// No GitHub Pages não há servidor para frete e pagamento: manda para a vitrine.
if (location.hostname.endsWith("github.io")) location.replace("../");
const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const f of filhos) e.append(f);
  return e;
};
const digitos = (s) => String(s).replace(/\D/g, "");

const CAT = await (await fetch("catalogo.json")).json();
const L = CAT.loja;
const produto = (id) => CAT.produtos.find((p) => p.id === id);

// ---------- carrinho (lembrado neste navegador) ----------
let carrinho = {};
try { carrinho = JSON.parse(localStorage.getItem("sier-carrinho") || "{}"); } catch { carrinho = {}; }
for (const id of Object.keys(carrinho)) if (!produto(id) || !(carrinho[id] > 0)) delete carrinho[id];
let fretes = [], freteEscolhido = null, cepCotado = "";
let pedidoVisivel = false; // a barra flutuante some quando a pessoa já está no pedido

function salvar() { try { localStorage.setItem("sier-carrinho", JSON.stringify(carrinho)); } catch {} }
const itens = () => Object.entries(carrinho).map(([id, qtd]) => ({ id, qtd }));
const subtotal = () => itens().reduce((s, it) => s + produto(it.id).preco * it.qtd, 0);

function mudou() {
  salvar();
  fecharDados();
  // carrinho mudou: o frete cotado deixa de valer
  fretes = []; freteEscolhido = null; cepCotado = "";
  $("#fretes").replaceChildren();
  msg("#msg-frete", "");
  desenharPedido();
}

function definir(id, qtd) {
  qtd = Math.max(0, Math.min(20, qtd));
  if (qtd) carrinho[id] = qtd; else delete carrinho[id];
  mudou();
  desenharGrade();
  $("#aviso-sacola").textContent = produto(id).nome + (qtd ? ": " + qtd + " na sacola." : " removido da sacola.");
  $("#p-" + id + " .comprar button")?.focus({preventScroll:true});
}

// ---------- vitrine ----------
function desenharGrade() {
  const grade = $("#grade");
  grade.replaceChildren(...CAT.produtos.map((p) => {
    const qtd = carrinho[p.id] || 0;
    const momentos = {"prata-coloidal":"PARA CONHECER DE PERTO", "oleo-de-ricino":"GOTA A GOTA, SEU MOMENTO", "sal-integral":"À MESA, COM SABOR", "alva-cristal-natural":"LEVEZA NA ROTINA"};
    const imagem = el("img", { src: "assets/" + p.id + ".jpg", alt: p.marca + " " + p.nome + ", " + p.conteudo, loading: "lazy", width: "720", height: "1280" });
    const assistir = el("button", {type:"button", class:"assistir", onclick:()=>abrirVideo(p)}, "▷ Assistir ao vídeo");
    const midia = el("div", {class:"produto-midia"}, imagem, assistir);
    const acoes = qtd
      ? el("div", { class: "comprar" },
          el("div", { class: "qtd", role: "group", "aria-label": "Quantidade de " + p.nome },
            el("button", { type: "button", "aria-label": "Diminuir", onclick: () => definir(p.id, qtd - 1) }, "−"),
            el("span", {}, String(qtd)),
            el("button", { type: "button", "aria-label": "Aumentar", onclick: () => definir(p.id, qtd + 1) }, "+")),
          el("a", { class: "btn btn-pequeno btn-linha", href: "#pedido" }, "Finalizar"))
      : el("div", { class: "comprar" }, el("button", { class: "btn btn-pequeno", type: "button", onclick: () => definir(p.id, 1) }, "Adicionar ao carrinho"));
    return el("article", { class: "produto", id: "p-" + p.id },
      midia,
      el("div", {},
        el("span", { class: "marca-produto" }, momentos[p.id] || p.marca),
        el("h3", {}, p.nome),
        el("span", { class: "conteudo" }, p.conteudo),
        el("div", { class: "preco" }, brl(p.preco), ...(p.provisorio ? [el("small", {}, "preço provisório")] : [])),
        el("p", { class: "descricao" }, p.descricao),
        el("details", {}, el("summary", {}, p.beneficios_titulo), el("ul", {}, ...p.beneficios.map((b) => el("li", {}, b)))),
        acoes));
  }));
  // só um vídeo tocando por vez
  grade.querySelectorAll("video").forEach((v) => v.addEventListener("play", () => document.querySelectorAll("video").forEach((o) => o !== v && !o.paused && o.pause())));
}

// ---------- pedido ----------
function msg(sel, texto, tipo = "") { const m = $(sel); m.textContent = texto; m.className = "msg " + tipo; }

function desenharPedido() {
  const lista = itens();
  const n = lista.reduce((s, it) => s + it.qtd, 0);
  $("#contador").textContent = n;
  $("#vazio").hidden = lista.length > 0;
  $("#itens").replaceChildren(...lista.map((it) => {
    const p = produto(it.id);
    return el("div", { class: "item" },
      el("div", { class: "nome" }, `${p.marca} ${p.nome}`, el("small", {}, p.conteudo)),
      el("div", { class: "qtd" },
        el("button", { type: "button", "aria-label": "Diminuir " + p.nome, onclick: () => definir(p.id, it.qtd - 1) }, "−"),
        el("span", {}, String(it.qtd)),
        el("button", { type: "button", "aria-label": "Aumentar " + p.nome, onclick: () => definir(p.id, it.qtd + 1) }, "+")),
      el("div", { class: "valor" }, brl(p.preco * it.qtd)));
  }));
  const sub = subtotal();
  $("#r-sub").textContent = brl(sub);
  $("#r-frete").textContent = freteEscolhido ? `${brl(freteEscolhido.preco)} · ${freteEscolhido.nome}` : "calcule pelo CEP";
  $("#r-total").textContent = brl(sub + (freteEscolhido?.preco || 0));
  atualizarEtapa();
  const barra = $("#barra");
  barra.hidden = !n || pedidoVisivel;
  $("#barra-texto").textContent = `${n} ${n === 1 ? "item" : "itens"} · ${brl(sub)}`;
}

// Etapas do pedido: resumo sempre visível; dados somente após frete.
function fecharDados() {
  $("#dados-etapa").hidden = true;
  $("#pagar").hidden = true;
  $("#continuar-dados").hidden = false;
  $("#continuar-dados").setAttribute("aria-expanded", "false");
}
function atualizarEtapa() {
  const pronto = itens().length > 0 && freteEscolhido && cepCotado === digitos($("#cep").value);
  $("#continuar-dados").disabled = !pronto;
  $("#orientacao-etapa").textContent = pronto
    ? "Frete e total disponíveis abaixo. Confira os valores antes de informar seus dados."
    : "Adicione um produto e calcule o frete para continuar.";
}
$("#continuar-dados").addEventListener("click", () => {
  if (!freteEscolhido || cepCotado !== digitos($("#cep").value) || !itens().length) return;
  $("#dados-etapa").hidden = false;
  $("#pagar").hidden = false;
  $("#continuar-dados").hidden = true;
  $("#continuar-dados").setAttribute("aria-expanded", "true");
  $("#form-dados").elements.nome.focus();
});
$("#cep").addEventListener("input", () => {
  if (cepCotado && cepCotado !== digitos($("#cep").value)) {
    fretes = []; freteEscolhido = null; cepCotado = "";
    $("#fretes").replaceChildren();
    fecharDados(); desenharPedido();
  }
});

// Vídeo sob demanda, com fechamento por botão ou Escape.
const dialogVideo = $("#video-dialog");
const videoProduto = $("#video-produto");
function abrirVideo(p) {
  $("#video-titulo").textContent = p.nome;
  $("#video-erro").hidden = true;
  videoProduto.poster = "assets/" + p.id + ".jpg";
  videoProduto.src = L.midia_base + p.id + ".mp4";
  document.querySelectorAll("video").forEach(v => v.pause());
  dialogVideo.showModal();
  videoProduto.play().catch(() => {});
}
$("#fechar-video").addEventListener("click", () => dialogVideo.close());
dialogVideo.addEventListener("close", () => { videoProduto.pause(); videoProduto.removeAttribute("src"); videoProduto.load(); });
videoProduto.addEventListener("error", () => { if (dialogVideo.open) $("#video-erro").hidden = false; });

// máscaras simples
const mascara = (input, fn) => input.addEventListener("input", () => { input.value = fn(digitos(input.value)); });
mascara($("#cep"), (d) => d.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"));
const f = $("#form-dados");
mascara(f.cpf, (d) => d.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"));
mascara(f.telefone, (d) => d.slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4,5})(\d{4})$/, "$1-$2"));
f.uf.addEventListener("input", () => { f.uf.value = f.uf.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2); });

async function preencherEndereco(cep) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) return;
    if (!f.rua.value) f.rua.value = d.logradouro || "";
    if (!f.bairro.value) f.bairro.value = d.bairro || "";
    f.cidade.value = d.localidade || f.cidade.value;
    f.uf.value = d.uf || f.uf.value;
    // O foco permanece com a pessoa durante o preenchimento automático.
  } catch { /* sem preenchimento automático: a pessoa digita */ }
}

$("#form-cep").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const cep = digitos($("#cep").value);
  if (!itens().length) return msg("#msg-frete", "Adicione um produto antes de calcular o frete.", "erro");
  if (cep.length !== 8) return msg("#msg-frete", "Digite um CEP com 8 números.", "erro");
  fecharDados();
  freteEscolhido = null; cepCotado = "";
  desenharPedido();
  const itensCotados = JSON.stringify(itens());
  msg("#msg-frete", "Calculando o frete…");
  $("#fretes").replaceChildren();
  try {
    const r = await fetch("api/frete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cep, itens: itens() }) });
    const d = await r.json();
    if (cep !== digitos($("#cep").value) || itensCotados !== JSON.stringify(itens())) return;
    if (!r.ok) throw new Error(d.erro);
    fretes = d.opcoes; cepCotado = cep; freteEscolhido = fretes[0];
    $("#fretes").replaceChildren(...fretes.map((o, i) =>
      el("label", { class: "frete" },
        el("input", { type: "radio", name: "frete", value: o.id, ...(i === 0 ? { checked: "" } : {}), onchange: () => { freteEscolhido = o; desenharPedido(); } }),
        el("span", { class: "info" }, o.nome, el("small", {}, `${o.prazo} ${o.prazo === 1 ? "dia útil" : "dias úteis"}`)),
        el("strong", {}, brl(o.preco)))));
    msg("#msg-frete", "");
    desenharPedido();
    preencherEndereco(cep);
  } catch (e) {
    msg("#msg-frete", e.message || "Não foi possível calcular o frete.", "erro");
  }
});

function cpfValido(c) {
  c = digitos(c);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}

f.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!itens().length) return msg("#msg-pedido", "Seu carrinho está vazio.", "erro");
  if (!freteEscolhido || cepCotado !== digitos($("#cep").value)) return msg("#msg-pedido", "Calcule o frete para o seu CEP antes de continuar.", "erro");
  let primeiroErro = null;
  for (const campo of f.querySelectorAll("input[required]")) {
    let ok = campo.value.trim() !== "";
    if (campo.name === "cpf") ok = cpfValido(campo.value);
    if (campo.name === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campo.value.trim());
    if (campo.name === "telefone") ok = digitos(campo.value).length >= 10;
    campo.setAttribute("aria-invalid", String(!ok));
    if (!ok && !primeiroErro) primeiroErro = campo;
  }
  if (primeiroErro) { primeiroErro.focus(); return msg("#msg-pedido", "Confira os campos destacados.", "erro"); }
  const botao = $("#pagar");
  botao.disabled = true; botao.textContent = "Gerando o pagamento…";
  msg("#msg-pedido", "");
  try {
    const dados = Object.fromEntries(new FormData(f));
    const r = await fetch("api/pedido", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: itens(), cep: cepCotado, freteId: freteEscolhido.id, cliente: dados }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro);
    msg("#msg-pedido", "Tudo certo! Abrindo a página de pagamento…", "ok");
    carrinho = {}; salvar();
    location.href = d.pagamento;
  } catch (e) {
    msg("#msg-pedido", e.message || "Não foi possível gerar o pagamento.", "erro");
    botao.disabled = false; botao.textContent = "Ir para o pagamento";
  }
});

// ---------- contato e modo de teste ----------
const wa = (t) => `https://wa.me/${L.whatsapp_numero}?text=${encodeURIComponent(t)}`;
document.querySelectorAll("[data-contato]").forEach(a => { a.href=wa("Olá! Gostaria de saber mais sobre os produtos SIER."); a.target="_blank"; a.rel="noopener"; });
$("#whats-topo").href = wa("Olá! Vi a loja da SIER e tenho uma dúvida.");
$("#whats-rodape").href = wa("Olá! Vi a loja da SIER.");
$("#whats-rodape").textContent = L.whatsapp;
$("#email-rodape").href = "mailto:" + L.email;
$("#email-rodape").textContent = L.email;
$("#empresa").textContent = [L.razao_social, L.cnpj && "CNPJ " + L.cnpj, L.endereco].filter(Boolean).join(" · ") || L.slogan;
$("#abrir-carrinho").addEventListener("click", () => $("#pedido").scrollIntoView());
fetch("api/status").then((r) => r.json()).then((s) => { $("#aviso-teste").hidden = !s.teste; }).catch(() => { $("#aviso-teste").hidden = false; });

desenharGrade();
desenharPedido();
new IntersectionObserver(([e]) => { pedidoVisivel = e.isIntersecting; desenharPedido(); }, { threshold: 0.05 }).observe($("#pedido"));

// ---------- apresentação em capítulos ----------
const CAP = await (await fetch("capitulos.json")).json();
const filme = $("#filme");
filme.src = L.midia_base + "apresentacao.mp4";
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const planos = CAP.secoes.flatMap((s) => s.capitulos);
const fins = [...planos.slice(1).map((c) => c.inicio), CAP.duracao];
let k = 0;
$("#menu").replaceChildren(...CAP.secoes.map((s) => el("div", { class: "secao" }, el("h4", {}, s.titulo),
  ...s.capitulos.map((c) => { const i = k++; return el("button", { class: "cap", type: "button", "data-start": c.inicio, "data-end": fins[i], onclick: () => vai(i) }, el("span", {}, c.titulo), el("time", {}, mmss(c.inicio))); }))));
const caps = [...document.querySelectorAll(".cap")];
let cur = -1;
function destaca() {
  let i = caps.findIndex((c) => filme.currentTime >= +c.dataset.start && filme.currentTime < +c.dataset.end);
  if (i < 0 && filme.currentTime >= +caps.at(-1).dataset.start) i = caps.length - 1;
  if (i !== cur) { caps[cur]?.removeAttribute("aria-current"); caps[i]?.setAttribute("aria-current", "true"); cur = i; }
  $("#anterior").disabled = i <= 0; $("#proximo").disabled = i < 0 || i >= caps.length - 1;
  $("#agora").textContent = caps[i]?.querySelector("span").textContent ?? "";
  if (caps[i]) { const s = +caps[i].dataset.start, e = +caps[i].dataset.end; caps[i].style.setProperty("--played", 100 * Math.min(1, Math.max(0, (filme.currentTime - s) / (e - s))) + "%"); }
}
function vai(i) {
  const c = caps[i]; if (!c) return;
  const go = () => { filme.currentTime = +c.dataset.start; destaca(); filme.play().catch(() => {}); };
  if (filme.readyState) go(); else { filme.preload = "metadata"; filme.addEventListener("loadedmetadata", go, { once: true }); filme.load(); }
}
$("#anterior").addEventListener("click", () => vai(cur - 1));
$("#proximo").addEventListener("click", () => vai(cur + 1));
filme.addEventListener("timeupdate", destaca); filme.addEventListener("seeked", destaca);
filme.addEventListener("play", () => document.querySelectorAll("video").forEach((o) => o !== filme && !o.paused && o.pause()));
new ResizeObserver(() => document.documentElement.style.setProperty("--altura-video", filme.getBoundingClientRect().height + "px")).observe(filme);
destaca();


// Movimento de entrada discreto, sem esconder conteúdo antes de carregar.
const movimentoReduzido = matchMedia("(prefers-reduced-motion: reduce)");
if (!movimentoReduzido.matches) {
  const entrada = new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => {
      if (!isIntersecting) return;
      target.animate([{transform:"translateY(18px)",opacity:0.65},{transform:"translateY(0)",opacity:1}],
        {duration:550,easing:"cubic-bezier(.2,.7,.3,1)"});
      entrada.unobserve(target);
    });
  }, {threshold:0.12});
  document.querySelectorAll(".cabecalho-secao,.essencia-texto,.essencia-foto,.faq-grid").forEach(el=>entrada.observe(el));
}
