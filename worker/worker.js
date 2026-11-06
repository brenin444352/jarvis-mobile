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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export default { fetch: (req, env) => tratar(req, env) };
