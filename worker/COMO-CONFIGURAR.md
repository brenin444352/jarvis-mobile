# Intermediário seguro (faz o app funcionar sem você colar chave)

1. Crie uma conta grátis em cloudflare.com.
2. Vá em Workers & Pages > Create > Create Worker. Dê um nome (ex.: jarvis-proxy) e clique em Deploy.
3. Clique em Edit code, apague o conteúdo e cole o arquivo worker.js. Clique em Deploy.
4. Vá em Settings > Variables and Secrets e adicione:
   - GROQ_KEY = sua chave da Groq (marque como secreta/Encrypt)
   - ORIGEM_PERMITIDA = https://brenin444352.github.io
5. Copie a URL do worker (algo como https://jarvis-proxy.SEU-USUARIO.workers.dev).
6. No arquivo index.html, troque na linha PROXY_URL o endereço pelo seu e coloque a barra "/" no fim. Faça o upload no GitHub.

Depois disso, o app funciona direto, sem campo de chave. A chave nunca aparece no celular.
