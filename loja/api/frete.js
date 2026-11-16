// POST /api/frete  { cep, itens: [{id, qtd}] }  ->  { opcoes: [{id, nome, preco, prazo}], subtotal, teste }
import { json, lerCorpo, itensDoCarrinho, subtotal, cotarFrete, MODO_TESTE } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { erro: "Use POST." });
  try {
    const { cep, itens } = await lerCorpo(req);
    const lista = itensDoCarrinho(itens);
    const opcoes = await cotarFrete(cep, lista);
    if (!opcoes.length) return json(res, 422, { erro: "Nenhuma transportadora atende esse CEP. Fale com a SIER pelo WhatsApp." });
    return json(res, 200, { opcoes, subtotal: subtotal(lista), teste: MODO_TESTE });
  } catch (e) {
    return json(res, 400, { erro: e.message || "Erro ao calcular o frete." });
  }
}
