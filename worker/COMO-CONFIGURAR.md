# Intermediário seguro (o app funciona sem você colar chave)

1. Crie uma conta grátis em cloudflare.com.
2. Workers & Pages > Create > Create Worker. Dê um nome (ex.: jarvis-proxy) e clique em Deploy.
3. Edit code: apague o conteúdo, cole o worker.js e clique em Deploy.
4. Settings > Variables and Secrets, adicione:
   - GROQ_KEY = sua chave da Groq (secreta)
   - ORIGEM_PERMITIDA = https://brenin444352.github.io
5. Settings > Bindings > Add > Workers AI. Nome da variável: AI. Isso liga a geração de imagens sem marca d'água (plano gratuito, com limite diário).
6. Clique em Deploy de novo e copie a URL do worker (ex.: https://jarvis-proxy.SEU-USUARIO.workers.dev).
7. No index.html, na linha PROXY_URL, troque o endereço pelo seu, com a barra "/" no fim. Suba os arquivos no GitHub.

## Notícias de verdade (opcional)
1. Conta grátis em brave.com/search/api, com chave do plano gratuito (News).
2. Settings > Variables and Secrets > BUSCA_KEY = essa chave (secreta). Faça Deploy de novo.

## Depois de configurar (uma vez só)
- Coloque a chave da Groq somente no Cloudflare (GROQ_KEY). O app não tem campo para chave quando o intermediário está ligado.
- Confirme que o endereço no index.html (PROXY_URL) é o do seu worker, com "/" no fim, e faça o upload no GitHub.
