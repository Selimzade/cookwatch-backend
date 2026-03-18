const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Suggest meals based on user's history and current time of day
 */
async function suggestMeals(existingMeals) {
  const ai = getClient();
  if (!ai) return getFallbackSuggestions(existingMeals);

  const hour = new Date().getHours();
  const timeOfDay = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 18 ? 'afternoon snack' : 'dinner';

  const mealHistory = existingMeals
    .slice(0, 10)
    .map((m) => `- ${m.name} (cooked ${m.timesCooked}x, ~${m.defaultDuration} min)`)
    .join('\n');

  const prompt = `You are a helpful cooking assistant.
Current time suggests it's ${timeOfDay}.

User's meal history:
${mealHistory || 'No meals yet'}

Suggest 3-5 meals for ${timeOfDay}. For each meal provide:
- name
- reason (short, 1 sentence)
- suggestedDuration (in minutes, integer)
- isFromHistory (true if it matches an existing meal)

Respond ONLY with valid JSON array, no markdown, no explanation.
Example: [{"name":"Pasta","reason":"Quick and filling for lunch","suggestedDuration":25,"isFromHistory":false}]`;

  const message = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();
  const json = JSON.parse(text);
  return Array.isArray(json) ? json : [];
}

/**
 * Generate a short meal description from just the name
 */
async function generateMealDescription(mealName) {
  const ai = getClient();
  if (!ai) return '';

  const message = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Write a short, appetizing 1-sentence description for "${mealName}".
Be concise and mouth-watering. Just the description, no quotes, no extra text.`,
    }],
  });

  return message.content[0].text.trim();
}

/**
 * Suggest cooking duration for a meal by name
 */
async function suggestDuration(mealName) {
  const ai = getClient();
  if (!ai) return 30;

  const message = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    messages: [{
      role: 'user',
      content: `How many minutes does it typically take to cook "${mealName}"?
Reply ONLY with a single integer (minutes). No units, no explanation.`,
    }],
  });

  const num = parseInt(message.content[0].text.trim(), 10);
  return isNaN(num) ? 30 : Math.min(Math.max(num, 1), 720);
}

function getFallbackSuggestions(meals) {
  return meals.slice(0, 3).map((m) => ({
    name: m.name,
    reason: `You've cooked this ${m.timesCooked} time${m.timesCooked !== 1 ? 's' : ''}`,
    suggestedDuration: m.defaultDuration,
    isFromHistory: true,
  }));
}

module.exports = { suggestMeals, generateMealDescription, suggestDuration };
