require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CARDS_DIR = path.join(__dirname, 'public', 'assets', 'cards');

const DELAY_MS = 3000;
let totalCost = 0;

const IMAGES = [
  {
    file: 'card-imposter.png',
    prompt: 'atmospheric dark alley scene at night, single streetlamp casting golden cone of light on wet cobblestones, shadowy doorways, foggy atmosphere, mysterious and slightly spooky but cute, flat cartoon illustration, thick black outlines, cel shading, deep navy and purple tones with gold lamp light, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-trivia.png',
    prompt: 'colorful quiz show stage from front, three illuminated podiums with glowing buzzers, spotlights from above, large question mark decorations on walls, scoreboard visible, cheerful game show energy, flat cartoon illustration, thick black outlines, bright purple and gold palette, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-hottake.png',
    prompt: 'dramatic debate stage split perfectly down the middle, left side cool teal color right side warm orange color, spotlights on each side, electric tension in the air, fiery energy, flat cartoon illustration, thick black outlines, teal and orange palette, square format, no characters, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-mafia.png',
    prompt: 'moonlit village at night, cozy houses with warm glowing windows, full moon and stars above, mysterious shadows, one suspicious shadow on a wall, slightly spooky but cute, flat cartoon illustration, thick black outlines, deep navy and cream palette with warm window glow, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-millionaire.png',
    prompt: 'glamorous game show stage with single ornate armchair in a dramatic spotlight, gold curtains and decorations, money symbols and stars floating, luxurious atmosphere, flat cartoon illustration, thick black outlines, rich gold and deep purple palette, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-feud.png',
    prompt: 'bright game show stage with two long podiums facing each other across a gap, giant buzzer in center, scoreboard above showing X marks, audience seats in background, competitive energy, flat cartoon illustration, thick black outlines, orange and cyan palette, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-wavelength.png',
    prompt: 'abstract cosmic scene with colorful frequency waves emanating from center, dial and tuner visual elements, stars and signal patterns, psychedelic but cute atmosphere, flat cartoon illustration, thick black outlines, purple and cyan palette, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-alias.png',
    prompt: 'cozy warm living room game night, cards scattered on coffee table, timer visible, word cards, warm lamp lighting, speech bubbles floating with question marks, comfortable social atmosphere, flat cartoon illustration, thick black outlines, warm pink and cream palette, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
  {
    file: 'card-drawing.png',
    prompt: 'colorful art studio with easels and canvases everywhere, paint pots and brushes scattered, colorful paint splashes on floor and walls, one canvas with a funny bad drawing, chaotic creative energy, flat cartoon illustration, thick black outlines, orange and multicolor palette, square format, no characters no people, 1024x1024',
    size: '1024x1024',
  },
];

async function generateImage(item) {
  const filePath = path.join(CARDS_DIR, item.file);
  if (fs.existsSync(filePath)) {
    console.log(`  SKIP (exists): ${item.file}`);
    return;
  }

  console.log(`  Generating: ${item.file}...`);
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: item.prompt,
      n: 1,
      size: item.size,
      quality: 'standard',
      response_format: 'url',
    });

    const url = response.data[0].url;
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buf));
    totalCost += 0.040;
    console.log(`  OK: ${item.file} ($${totalCost.toFixed(2)} spent)`);
  } catch (err) {
    console.error(`  FAIL: ${item.file}: ${err.message}`);
  }
}

async function main() {
  console.log('=== Generating Card Background Images ===\n');
  fs.mkdirSync(CARDS_DIR, { recursive: true });

  for (const item of IMAGES) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone! Total cost: $${totalCost.toFixed(2)}`);
}

main().catch(console.error);
