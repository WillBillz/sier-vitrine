// Funções compartilhadas da loja SIER (não viram rota: arquivos com "_" são ignorados pela Vercel).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const CATALOGO = JSON.parse(readFileSync(join(AQUI, "..", "catalogo.json"), "utf8"));

const env = (k, padrao = "") => (process.env[k] ?? padrao).trim();
// Modo de teste: sem chaves configuradas, ou MODO_TESTE=1, a loja simula frete e pagamento.
export const MODO_TESTE = env("MODO_TESTE") === "1" || !env("ASAAS_API_KEY") || !env("MELHOR_ENVIO_TOKEN");
export const TEM_PRECO_PROVISORIO = CATALOGO.produtos.some((p) => p.provisorio);

const ASAAS_URL = env("ASAAS_AMBIENTE") === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
const ME_URL = env("MELHOR_ENVIO_AMBIENTE") === "producao" ? "https://melhorenvio.com.br" : "https://sandbox.melhorenvio.com.br";

export function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

export async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const partes = [];
  for await (const p of req) partes.push(p);
  const txt = Buffer.concat(partes).toString("utf8");
  if (txt.length > 20000) throw new Error("Pedido grande demais.");
  return txt ? JSON.parse(txt) : {};
}

export const soDigitos = (s) => String(s ?? "").replace(/\D/g, "");

export function cpfValido(cpf) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

// Itens validados contra o catálogo (o preço vem sempre do servidor, nunca do navegador)
export function itensDoCarrinho(itens) {
  if (!Array.isArray(itens) || !itens.length) throw new Error("O carrinho está vazio.");
  const out = [];
  for (const it of itens) {
    const p = CATALOGO.produtos.find((x) => x.id === it?.id);
    const qtd = Math.floor(Number(it?.qtd));
    if (!p) throw new Error("Produto inválido no carrinho.");
    if (!(qtd >= 1 && qtd <= 20)) throw new Error("Quantidade inválida.");
    out.push({ ...p, qtd });
  }
  return out;
}

export const centavos = (v) => Math.round(v * 100) / 100;
export const subtotal = (itens) => centavos(itens.reduce((s, p) => s + p.preco * p.qtd, 0));

// ---------- frete (Melhor Envio) ----------
export async function cotarFrete(cep, itens) {
  const destino = soDigitos(cep);
  if (destino.length !== 8) throw new Error("CEP inválido.");
  if (MODO_TESTE) return freteSimulado(destino, itens);
  const origem = soDigitos(env("ORIGEM_CEP"));
  if (origem.length !== 8) throw new Error("CEP de origem da SIER não configurado.");
  const corpo = {
    from: { postal_code: origem },
    to: { postal_code: destino },
    products: itens.map((p) => ({
      id: p.id, quantity: p.qtd, weight: p.envio.peso, width: p.envio.largura,
      height: p.envio.altura, length: p.envio.comprimento, insurance_value: p.preco,
    })),
    options: { receipt: false, own_hand: false },
  };
  const r = await fetch(`${ME_URL}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json", "Content-Type": "application/json",
      Authorization: `Bearer ${env("MELHOR_ENVIO_TOKEN")}`,
      "User-Agent": `Loja SIER (${CATALOGO.loja.email})`,
    },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error("Não foi possível calcular o frete agora. Tente de novo em instantes.");
  const lista = await r.json();
  return (Array.isArray(lista) ? lista : [])
    .filter((o) => !o.error && (o.custom_price || o.price))
    .map((o) => ({
      id: String(o.id),
      nome: `${o.company?.name ?? ""} ${o.name}`.trim(),
      preco: centavos(Number(o.custom_price || o.price)),
      prazo: Number(o.custom_delivery_time || o.delivery_time || 0),
    }))
    .sort((a, b) => a.preco - b.preco);
}

function freteSimulado(destino, itens) {
  const peso = itens.reduce((s, p) => s + p.envio.peso * p.qtd, 0);
  const regiao = Number(destino[0]); // 0–1 SP; quanto maior o primeiro dígito, mais longe
  const base = 14 + regiao * 2.4 + peso * 6;
  return [
    { id: "teste-pac", nome: "Correios PAC (simulado)", preco: centavos(base), prazo: 4 + regiao },
    { id: "teste-sedex", nome: "Correios SEDEX (simulado)", preco: centavos(base * 1.7), prazo: 1 + Math.ceil(regiao / 2) },
    { id: "teste-jadlog", nome: "Jadlog .Package (simulado)", preco: centavos(base * 0.92), prazo: 5 + regiao },
  ].sort((a, b) => a.preco - b.preco);
}

// ---------- pagamento (Asaas) ----------
async function asaas(caminho, corpo) {
  const r = await fetch(`${ASAAS_URL}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: env("ASAAS_API_KEY"), "User-Agent": "Loja SIER" },
    body: JSON.stringify(corpo),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = dados?.errors?.[0]?.description;
    throw new Error(msg ? `Pagamento: ${msg}` : "Não foi possível gerar o pagamento agora.");
  }
  return dados;
}

export async function criarCobranca({ cliente, itens, frete, total, referencia }) {
  const resumo = itens.map((p) => `${p.qtd}x ${p.marca} ${p.nome} ${p.conteudo}`).join("; ");
  const descricao = `Pedido ${referencia} · ${resumo} · Frete: ${frete.nome} (R$ ${frete.preco.toFixed(2)}, ${frete.prazo} dias úteis)`.slice(0, 495);
  if (MODO_TESTE) {
    return { invoiceUrl: `/obrigado.html?teste=1&pedido=${encodeURIComponent(referencia)}&total=${total.toFixed(2)}`, id: "teste", descricao };
  }
  const c = await asaas("/customers", {
    name: cliente.nome, cpfCnpj: soDigitos(cliente.cpf), email: cliente.email, mobilePhone: soDigitos(cliente.telefone),
    postalCode: soDigitos(cliente.cep), address: cliente.rua, addressNumber: cliente.numero, complement: cliente.complemento || undefined,
    province: cliente.bairro, externalReference: referencia,
  });
  const venc = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const pg = await asaas("/payments", {
    customer: c.id, billingType: "UNDEFINED", value: total, dueDate: venc,
    description: descricao, externalReference: referencia,
  });
  return { invoiceUrl: pg.invoiceUrl, id: pg.id, descricao };
}
