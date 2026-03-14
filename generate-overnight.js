require('dotenv').config();
const OpenAI = require('openai');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const REMOVEBG_KEY = 'UEQNn9QTbm63MQMNiU7aFTWk';

const IMAGES = [
  {
    path: 'public/assets/characters/hottake-a.png',
    prompt: 'cute cartoon teal water droplet character with a cool calm face, big glossy eyes, tiny arms, smiling confidently, teal color #06D6A0, no background, transparent background, thick black outline, cel shading, party game character, isolated on white',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/characters/millionaire.png',
    prompt: 'cute cartoon gold coin character standing upright with a face, tiny top hat, monocle, smug wealthy expression, gold color, no background, transparent background, thick black outline, cel shading, isolated character, party game mascot',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/characters/imp-crew-large.png',
    prompt: 'cute cartoon green blob monster detective, one large eye, holding magnifying glass triumphantly, happy innocent expression, green color, celebrating pose, no background, transparent, thick black outline, cel shading, isolated',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/characters/imp-evil-large.png',
    prompt: 'cute cartoon red blob monster, one sideways shifty eye, sneaky guilty grin, hiding behind back, red color, no background, transparent, thick black outline, cel shading, isolated, caught expression',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/characters/host-screen.png',
    prompt: 'cute cartoon TV screen character with eyes on the screen, antenna on top with signal waves, friendly smiling face, dark screen with glowing eyes, thick black outline, no background, transparent, cel shading, party game mascot',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/ui/game-night-title.png',
    prompt: 'decorative text banner saying PARTY GAMES in bold cartoon font, gold and colorful letters, stars and sparkles around text, thick black outline, no background, transparent, festive party style',
    size: '1792x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/ui/player-card-frame.png',
    prompt: 'decorative rectangular card frame with rounded corners, ornate border with small stars and dots, gold color #FFD166, no fill inside just the border decoration, no background, transparent center, flat cartoon style',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/ui/room-code-frame.png',
    prompt: 'decorative frame for displaying a 4-letter room code, bold chunky border, neon glow effect, party game style, gold and teal colors, no background, transparent center, flat cartoon style, thick outlines',
    size: '1024x1024',
    removeBg: true,
  },
  {
    path: 'public/assets/scenes/session-bg.png',
    prompt: 'cozy game night living room scene, comfortable sofa and chairs arranged in a circle, warm lamp lighting, game boxes on coffee table, snacks and drinks, no people, flat cartoon illustration, thick outlines, warm navy and gold color palette',
    size: '1792x1024',
    removeBg: false,
  },
  {
    path: 'public/assets/scenes/voting-bg.png',
    prompt: 'dramatic town hall meeting room scene, rows of empty seats facing a stage with a podium and spotlight, voting atmosphere, mysterious lighting, no people, flat cartoon illustration, thick outlines, deep purple and gold palette',
    size: '1792x1024',
    removeBg: false,
  },
];

let totalCost = 0;

async function removeBg(filePath) {
  const formData = new FormData();
  formData.append('image_file', fs.createReadStream(filePath));
  formData.append('size', 'auto');
  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVEBG_KEY, ...formData.getHeaders() },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.text();
    console.log('  ⚠ remove.bg failed:', err.slice(0, 100));
    return;
  }
  const buffer = await response.buffer();
  fs.writeFileSync(filePath, buffer);
  console.log('  ✓ Background removed');
}

async function generateImage(item, index) {
  const outputPath = path.join(__dirname, item.path);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`\n[${index + 1}/${IMAGES.length}] Generating: ${item.path}`);
  console.log(`  Prompt: ${item.prompt.slice(0, 80)}...`);

  try {
    const isWide = item.size === '1792x1024';
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
    fs.writeFileSync(outputPath, Buffer.from(buf));

    const cost = isWide ? 0.08 : 0.04;
    totalCost += cost;
    console.log(`  ✓ Generated (${(fs.statSync(outputPath).size / 1024).toFixed(0)}KB) — $${cost.toFixed(2)} (total: $${totalCost.toFixed(2)})`);

    if (item.removeBg) {
      await removeBg(outputPath);
    }
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  DALL-E Image Generation');
  console.log(`  ${IMAGES.length} images to generate`);
  console.log('═══════════════════════════════════════');

  for (let i = 0; i < IMAGES.length; i++) {
    await generateImage(IMAGES[i], i);
    if (i < IMAGES.length - 1) {
      console.log('  ⏳ Waiting 2s...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`  COMPLETE — ${IMAGES.length} images generated`);
  console.log(`  Total cost: ~$${totalCost.toFixed(2)}`);
  console.log('═══════════════════════════════════════');
}

main();
