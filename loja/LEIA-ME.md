# Loja da SIER

Página de venda da SIER: produtos com vídeo, carrinho, frete calculado pelo CEP (Melhor Envio) e pagamento pelo Asaas (Pix, cartão ou boleto), com a apresentação em capítulos no fim da página.

- **Sem as chaves configuradas, a loja roda em modo de teste:** frete e pagamento são simulados, e uma faixa amarela avisa no topo.
- **Com as chaves e preços provisórios:** a loja se recusa a cobrar até os preços reais serem preenchidos.

## O que a SIER precisa providenciar

1. **Asaas** (conta da SIER, com CNPJ): crie a conta em asaas.com e gere uma chave de API em *Integrações → Chaves de API*. Para testar antes, use também uma conta de sandbox em sandbox.asaas.com.
2. **Melhor Envio** (conta da SIER): crie a conta em melhorenvio.com.br e gere um token em *Integrações → Permissões de acesso*, com a permissão de cálculo de frete (`shipping-calculate`). O sandbox fica em sandbox.melhorenvio.com.br.
3. **Dados dos produtos** em `catalogo.json`:
   - preço de cada produto, com `"provisorio": false`;
   - peso (kg) e medidas da caixa de envio (cm);
   - razão social, CNPJ e endereço da SIER, que aparecem no rodapé, como pede a lei do comércio eletrônico.
4. **CEP de onde os pedidos saem.**

## Publicar na Vercel

1. Em vercel.com, *Add New → Project* e importe o repositório `WillBillz/sier-vitrine`.
2. Em **Root Directory**, escolha `loja`. O Framework Preset fica em *Other*.
3. Em **Environment Variables**, cadastre:

| Variável | Valor |
| --- | --- |
| `ASAAS_API_KEY` | chave de API do Asaas da SIER |
| `ASAAS_AMBIENTE` | `sandbox` para testar, `producao` para vender |
| `MELHOR_ENVIO_TOKEN` | token do Melhor Envio da SIER |
| `MELHOR_ENVIO_AMBIENTE` | `sandbox` ou `producao` |
| `ORIGEM_CEP` | CEP de onde os pedidos saem |

4. Clique em *Deploy*. Sem as variáveis, a loja sobe em modo de teste.
5. Depois de testar no sandbox, troque os dois ambientes para `producao` e faça um novo deploy.
6. Domínio próprio (opcional): *Settings → Domains*.

As chaves ficam só na Vercel, nunca no código nem no GitHub.

## Como funciona um pedido

1. **Frete:** a pessoa escolhe os produtos e calcula o frete pelo CEP. A cotação é feita no servidor (`api/frete.js`).
2. **Dados:** ela preenche os dados, e o endereço vem pelo CEP (ViaCEP).
3. **Cobrança:** o servidor recalcula preços e frete, porque o navegador nunca define o valor. Em seguida, cria o cliente e a cobrança no Asaas (`api/pedido.js`) e leva a pessoa à página de pagamento do Asaas.
4. **Aviso à SIER:** o Asaas avisa a SIER por e-mail quando o pagamento entra. A descrição da cobrança traz os produtos e o frete escolhido, e o cadastro do cliente traz o endereço.
5. **Envio:** a SIER gera a etiqueta no Melhor Envio e posta.

Próximo passo possível: um webhook do Asaas que, ao confirmar o pagamento, já coloca o envio no carrinho do Melhor Envio.

## Arquivos

- `index.html`, `estilo.css` e `app.js`: a página.
- `obrigado.html`: página de volta depois do pedido (no modo de teste).
- `catalogo.json`: produtos, preços, pesos, medidas e contato.
- `capitulos.json`: capítulos da apresentação.
- `api/`: funções da Vercel (`frete.js`, `pedido.js`, `status.js` e `_lib.js`).
- Os vídeos vêm da vitrine no GitHub Pages (`midia_base` no catálogo).
