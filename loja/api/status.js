// GET /api/status -> informa se a loja está em modo de teste (a página mostra um aviso)
import { json, MODO_TESTE, TEM_PRECO_PROVISORIO } from "./_lib.js";

export default function handler(req, res) {
  return json(res, 200, { teste: MODO_TESTE, precosProvisorios: TEM_PRECO_PROVISORIO });
}
