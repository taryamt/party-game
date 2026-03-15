require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SCENES_DIR = path.join(__dirname, 'public', 'assets', 'scenes');

const DELAY_MS = 3000;
let totalCost = 0;

const IMAGES = [
  {
    file: 'home-bg-light.png',
    prompt: 'cozy warm game night living room, isometric view, round wooden table with colorful board games and playing cards, warm golden lamp light, potted plants, bookshelf with games, snacks and drinks on table, no people no humans, flat cartoon illustration, thick black outlines, warm cream and amber tones, cel shading, very warm and inviting',
    size: '1792x1024',
  },
  {
    file: 'imp-pass-light.png',
    prompt: 'warm cozy interior room, soft afternoon golden light, wooden floor, plants, comfortable armchair, warm lamp, inviting and safe feeling, no people no humans, flat cartoon illustration, warm cream yellow tones, thick outlines',
    size: '1792x1024',
  },
  {
    file: 'discuss-bg-light.png',
    prompt: 'bright cozy living room from above, group of chairs arranged in a circle around a coffee table, afternoon light, warm and social atmosphere, no people no humans, flat cartoon illustration, warm yellow and cream palette, thick outlines',
    size: '1792x1024',
  },
  {
    file: 'vote-bg-light.png',
    prompt: 'bright village square with colorful bunting flags overhead, cobblestone ground, fountain in center, warm sunny day, festive but slightly tense atmosphere, no people no humans, flat cartoon illustration, warm bright palette, thick outlines',
    size: '1792x1024',
  },
  {
    file: 'results-caught-light.png',
    prompt: 'bright celebration party scene, colorful confetti raining, streamers and balloons, party lights, festive atmosphere, no people no humans, flat cartoon illustration, bright multicolor palette, thick outlines',
    size: '1792x1024',
  },
  {
    file: 'trivia-bg-light.png',
    prompt: 'bright colorful quiz show stage, three podiums with buzzers, colorful spotlights, giant question marks decorating walls, cheerful game show energy, no people no humans, flat cartoon illustration, bright purple and gold tones, thick outlines',
    size: '1792x1024',
  },
  {
    file: 'hottake-bg-light.png',
    prompt: 'bright debate stage split down the middle, two podiums, one side teal one side coral orange, colorful lighting, fun competitive atmosphere, no people no humans, flat cartoon illustration, bright warm tones, thick outlines',
    size: '1792x1024',
  },
];

async function generateImage(item) {
  const filePath = path.join(SCENES_DIR, item.file);
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
    });

    const imageUrl = response.data[0].url;
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    totalCost += 0.040; // standard 1792
    console.log(`  OK: ${item.file} ($${totalCost.toFixed(2)} total)`);
  } catch (err) {
    console.error(`  FAIL: ${item.file}: ${err.message}`);
  }
}

async function main() {
  console.log('=== Generating Light Theme Scene Images ===\n');
  fs.mkdirSync(SCENES_DIR, { recursive: true });

  for (const item of IMAGES) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone! Total cost: $${totalCost.toFixed(2)}`);
}

main().catch(console.error);
