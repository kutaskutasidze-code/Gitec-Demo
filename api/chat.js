// Vercel Serverless Function — proxies chat requests to Gemini/Groq
// API keys stay server-side via process.env

const GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, systemPrompt } = req.body;
  if (!messages || !systemPrompt) {
    return res.status(400).json({ error: 'Missing messages or systemPrompt' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';

  // Try Gemini first
  if (geminiKey) {
    try {
      const text = await callGemini(geminiKey, messages, systemPrompt);
      return res.status(200).json({ text });
    } catch (err) {
      console.warn('Gemini failed:', err.message);
    }
  }

  // Fallback to Groq
  if (groqKey) {
    try {
      const text = await callGroq(groqKey, messages, systemPrompt);
      return res.status(200).json({ text });
    } catch (err) {
      console.warn('Groq failed:', err.message);
    }
  }

  return res.status(503).json({ error: 'All AI providers failed' });
};

async function callGemini(apiKey, messages, systemPrompt) {
  const body = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
  };

  for (const model of GEMINI_MODELS) {
    try {
      const url = GEMINI_BASE + model + ':generateContent?key=' + apiKey;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('API returned ' + response.status);
      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      }
      throw new Error('No response from model');
    } catch (err) {
      console.warn(model + ' failed:', err.message);
    }
  }
  throw new Error('All Gemini models failed');
}

async function callGroq(apiKey, messages, systemPrompt) {
  const groqMessages = [{ role: 'system', content: systemPrompt }];
  for (const msg of messages) {
    groqMessages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.parts[0].text
    });
  }

  const response = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) throw new Error('Groq API returned ' + response.status);
  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }
  throw new Error('No response from Groq');
}
