// POST /api/pedido  { itens, cep, freteId, cliente }  ->  { pagamento: url, total, referencia, teste }
// Recalcula tudo no servidor: preços do catálogo e frete cotado de novo para o serviço escolhido.
import { randomBytes } from "node:crypto";
import {
  json, lerCorpo, itensDoCarrinho, subtotal, cotarFrete, criarCobranca, cpfValido, soDigitos,
  centavos, MODO_TESTE, TEM_PRECO_PROVISORIO,
} from "./_lib.js";

const obrig = (v, nome, max = 120) => {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`Preencha ${nome}.`);
  if (s.length > max) throw new Error(`${nome} está longo demais.`);
  return s;
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { erro: "Use POST." });
  try {
    if (!MODO_TESTE && TEM_PRECO_PROVISORIO) {
      return json(res, 503, { erro: "A loja ainda está em configuração. Peça pelo WhatsApp." });
    }
    const { itens, cep, freteId, cliente: c = {} } = await lerCorpo(req);
    const lista = itensDoCarrinho(itens);
    const cliente = {
      nome: obrig(c.nome, "o nome"),
      cpf: obrig(c.cpf, "o CPF", 20),
      email: obrig(c.email, "o e-mail"),
      telefone: obrig(c.telefone, "o telefone", 20),
      cep: obrig(cep, "o CEP", 10),
      rua: obrig(c.rua, "a rua"),
      numero: obrig(c.numero, "o número", 20),
      complemento: String(c.complemento ?? "").trim().slice(0, 60),
      bairro: obrig(c.bairro, "o bairro"),
      cidade: obrig(c.cidade, "a cidade"),
      uf: obrig(c.uf, "o estado", 2),
    };
    if (!cpfValido(cliente.cpf)) throw new Error("CPF inválido.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) throw new Error("E-mail inválido.");
    if (soDigitos(cliente.telefone).length < 10) throw new Error("Telefone inválido (inclua o DDD).");

    const opcoes = await cotarFrete(cliente.cep, lista);
    const frete = opcoes.find((o) => o.id === String(freteId));
    if (!frete) throw new Error("A opção de frete mudou. Calcule o frete de novo.");
    const total = centavos(subtotal(lista) + frete.preco);
    const referencia = `SIER-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const cobranca = await criarCobranca({ cliente, itens: lista, frete, total, referencia });
    return json(res, 200, { pagamento: cobranca.invoiceUrl, total, referencia, teste: MODO_TESTE });
  } catch (e) {
    return json(res, 400, { erro: e.message || "Erro ao gerar o pedido." });
  }
}
