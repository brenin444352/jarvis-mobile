// Intermediário seguro do JARVIS (Cloudflare Workers, gratuito).
// A chave da Groq fica aqui, guardada nas configurações do Cloudflare. O app do celular nunca a vê.
// Variáveis que você configura no Cloudflare:
//   GROQ_KEY            -> sua chave da Groq (marcar como "Encrypt"/secreta)
//   ORIGEM_PERMITIDA    -> o endereço do seu site, ex.: https://brenin444352.github.io

const MODELOS_OK = ['openai/gpt-oss-20b'];
const MAX_MSGS = 16;
const MAX_CHARS = 6000;
const MAX_TOKENS = 900;

function cabecalhos(origem, permitida) {
  return {
    'Access-Control-Allow-Origin': permitida,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export async function tratar(req, env, f = fetch) {
  const origem = req.headers.get('Origin') || '';
  const permitida = env.ORIGEM_PERMITIDA || '';
  if (!permitida || origem !== permitida) {
    return new Response('Origem não permitida.', { status: 403 });
  }
  const cab = cabecalhos(origem, permitida);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cab });
  if (new URL(req.url).pathname === '/busca') return buscar(req, env, f, cab);
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405, headers: cab });

  let dados;
  try { dados = await req.json(); } catch (e) {
    return new Response('JSON inválido.', { status: 400, headers: cab });
  }
  const msgs = (Array.isArray(dados.messages) ? dados.messages : []).slice(-MAX_MSGS).map((m) => ({
    role: ['system', 'user', 'assistant'].includes(m && m.role) ? m.role : 'user',
    content: String((m && m.content) || '').slice(0, MAX_CHARS),
  }));
  if (msgs.length === 0) return new Response('Sem mensagens.', { status: 400, headers: cab });

  const modelo = MODELOS_OK.includes(dados.model) ? dados.model : MODELOS_OK[0];
  const corpo = { model: modelo, messages: msgs, stream: true, temperature: 0.5, max_completion_tokens: MAX_TOKENS };
  const r = await f('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.GROQ_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return new Response(r.body, { status: r.status, headers: { ...cab, 'Content-Type': 'text/event-stream' } });
}

// Busca de notícias de verdade (Brave Search, plano gratuito). A chave BUSCA_KEY fica só aqui.
async function buscar(req, env, f, cab) {
  if (req.method !== 'GET') return new Response('Use GET.', { status: 405, headers: cab });
  const json = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { ...cab, 'Content-Type': 'application/json' } });
  const termo = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 150);
  if (!termo) return new Response('Informe o termo em q.', { status: 400, headers: cab });
  if (!env.BUSCA_KEY) return json({ resultados: [] });
  const r = await f('https://api.search.brave.com/res/v1/news/search?count=5&search_lang=pt&q=' + encodeURIComponent(termo), {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': env.BUSCA_KEY },
  });
  if (!r.ok) return json({ resultados: [], erro: r.status });
  const dados = await r.json();
  const resultados = (dados.results || []).slice(0, 5).map((x) => ({
    titulo: String(x.title || '').slice(0, 200),
    resumo: String(x.description || '').slice(0, 400),
    url: String(x.url || ''),
    fonte: String((x.meta_url && x.meta_url.hostname) || ''),
    idade: String(x.age || ''),
  }));
  return json({ resultados });
}

export default { fetch: (req, env) => tratar(req, env) };
