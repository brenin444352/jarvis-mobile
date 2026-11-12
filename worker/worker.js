// Intermediário seguro do JARVIS (Cloudflare Workers, gratuito).
// Guarda as chaves no servidor: o app do celular nunca as vê.
// Variáveis e vínculos que você configura no Cloudflare:
//   GROQ_KEY            -> sua chave da Groq (secreta)                 [conversa]
//   BUSCA_KEY           -> chave do Brave Search (secreta, opcional)   [notícias]
//   ORIGEM_PERMITIDA    -> o endereço do seu site, ex.: https://brenin444352.github.io
//   AI                  -> vínculo "Workers AI" com nome AI            [imagens, sem marca d'água]

const MODELOS_OK = ['openai/gpt-oss-20b'];
const MODELO_IMAGEM = '@cf/black-forest-labs/flux-1-schnell';
const MODELO_VISAO = '@cf/meta/llama-3.2-11b-vision-instruct';
const MAX_MSGS = 16;
const MAX_CHARS = 6000;
const MAX_TOKENS = 900;
const MAX_PROMPT = 800;

function cabecalhos(permitida) {
  return {
    'Access-Control-Allow-Origin': permitida,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(obj, cab, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cab, 'Content-Type': 'application/json' } });
}

export async function tratar(req, env, f = fetch) {
  const origem = req.headers.get('Origin') || '';
  const permitida = env.ORIGEM_PERMITIDA || '';
  if (!permitida || origem !== permitida) {
    return new Response('Origem não permitida.', { status: 403 });
  }
  const cab = cabecalhos(permitida);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cab });
  const caminho = new URL(req.url).pathname;
  if (caminho === '/busca') return buscar(req, env, f, cab);
  if (caminho === '/imagem') return imagem(req, env, cab);
  if (caminho === '/visao') return visao(req, env, cab);
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

// Busca de notícias (Brave Search, plano gratuito). A chave BUSCA_KEY fica só aqui.
async function buscar(req, env, f, cab) {
  if (req.method !== 'GET') return new Response('Use GET.', { status: 405, headers: cab });
  const termo = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 150);
  if (!termo) return new Response('Informe o termo em q.', { status: 400, headers: cab });
  if (!env.BUSCA_KEY) return json({ resultados: [] }, cab);
  const r = await f('https://api.search.brave.com/res/v1/news/search?count=5&search_lang=pt&q=' + encodeURIComponent(termo), {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': env.BUSCA_KEY },
  });
  if (!r.ok) return json({ resultados: [], erro: r.status }, cab);
  const dados = await r.json();
  const resultados = (dados.results || []).slice(0, 5).map((x) => ({
    titulo: String(x.title || '').slice(0, 200),
    resumo: String(x.description || '').slice(0, 400),
    url: String(x.url || ''),
    fonte: String((x.meta_url && x.meta_url.hostname) || ''),
    idade: String(x.age || ''),
  }));
  return json({ resultados }, cab);
}

// Geração de imagem pelo Workers AI: sem marca d'água, em PNG.
async function imagem(req, env, cab) {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405, headers: cab });
  let dados;
  try { dados = await req.json(); } catch (e) {
    return new Response('JSON inválido.', { status: 400, headers: cab });
  }
  const prompt = typeof dados.prompt === 'string' ? dados.prompt.trim().slice(0, MAX_PROMPT) : '';
  if (!prompt) return new Response('Informe o prompt.', { status: 400, headers: cab });
  if (!env.AI) return json({ erro: 'Geração de imagem não configurada.' }, cab, 503);
  const r = await env.AI.run(MODELO_IMAGEM, { prompt, steps: 4 });
  const base64 = r && typeof r.image === 'string' ? r.image : '';
  if (!base64) return json({ erro: 'A imagem não foi gerada.' }, cab, 502);
  return json({ url: 'data:image/png;base64,' + base64 }, cab);
}

// Análise de foto (modelo de visão do Workers AI). A imagem chega em data URL, já reduzida no celular.
async function visao(req, env, cab) {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405, headers: cab });
  let dados;
  try { dados = await req.json(); } catch (e) {
    return new Response('JSON inválido.', { status: 400, headers: cab });
  }
  const pergunta = (typeof dados.prompt === 'string' && dados.prompt.trim()) ? dados.prompt.trim().slice(0, 600) : 'Descreva e explique esta imagem em português.';
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dados.imagem || ''));
  if (!m) return new Response('Imagem inválida.', { status: 400, headers: cab });
  if (m[2].length > 2000000) return json({ erro: 'Imagem grande demais.' }, cab, 413);
  if (!env.AI) return json({ erro: 'Análise de imagem não configurada.' }, cab, 503);
  const bytes = Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const r = await env.AI.run(MODELO_VISAO, { prompt: pergunta, image: bytes, max_tokens: 512 });
  const resposta = r && typeof r.response === 'string' ? r.response.trim() : '';
  if (!resposta) return json({ erro: 'A imagem não pôde ser analisada.' }, cab, 502);
  return json({ resposta }, cab);
}

export default { fetch: (req, env) => tratar(req, env) };
