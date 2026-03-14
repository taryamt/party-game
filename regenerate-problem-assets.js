require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

/**
 * Regenerate problem images with proper transparent backgrounds.
 * Text prompts only — no image input.
 * Usage: node regenerate-problem-assets.js
 */
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ASSETS_DIR = path.join(__dirname, 'public', 'assets');
const COST_1024 = 0.040;
const COST_1792 = 0.080;
const DELAY_MS = 2000;

const IMAGES = [
  // ── Characters ──
  {
    file: 'characters/imp-crew.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon green blob monster with one large eye, holding magnifying glass, chibi style, thick black outline, cel shading, NO BACKGROUND, pure transparent background, PNG with alpha channel, white space around character only, isolated character on nothing, 1024x1024',
  },
  {
    file: 'characters/imp-evil.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon red blob monster with shifty sideways eye, sneaky smirk, hiding magnifying glass, chibi style, thick black outline, cel shading, NO BACKGROUND, pure transparent background, PNG with alpha channel, isolated character on nothing, 1024x1024',
  },
  {
    file: 'characters/trivia.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon brain creature with glasses, floating, smug expression, small arms, chibi style, purple color, thick black outline, cel shading, NO BACKGROUND, pure transparent background, isolated on nothing, 1024x1024',
  },
  {
    file: 'characters/hottake-a.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon teal flame character with face, floating hands, cool expression, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated character, 1024x1024',
  },
  {
    file: 'characters/hottake-b.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon red orange flame character with face, passionate expression, floating hands, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated character, 1024x1024',
  },
  {
    file: 'characters/mafia.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon dark blob shadow creature, white glowing eyes, tiny fedora hat, mysterious, thick outline, purple glow effect, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/millionaire.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon gold coin character with face, top hat, monocle, tiny arms, smug expression, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/feud.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'two cute cartoon horseshoe magnet characters facing each other, orange and cyan colors, excited expressions, electric sparks between, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/wavelength.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon sine wave creature with glossy eyes, purple and cyan colors, vibrating, concentrating expression, thick black outline, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/alias.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon lips character with floating eyes above, hot pink, tiny floating hands, frantic expression, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/drawing.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon paintbrush character, multicolor bristle head with eyes, orange handle body, paint drips, tiny feet, happy grin, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/win.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon gold blob character jumping in celebration, arms raised, huge smile, stars exploding around it, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  {
    file: 'characters/lose.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'cute cartoon blue grey blob character looking sad, drooping, small tear, rain cloud above, thick black outline, cel shading, NO BACKGROUND, transparent background, isolated, 1024x1024',
  },
  // ── UI Elements ──
  {
    file: 'ui/banner-gold.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'decorative gold banner ribbon, ornate scroll design, gold color, NO BACKGROUND, fully transparent background, PNG alpha channel, banner shape only, 1024x256',
  },
  {
    file: 'ui/divider-stars.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'decorative horizontal divider with stars and sparkles, gold and white, NO BACKGROUND, transparent background, thin decorative line with stars, wide format, 1024x128',
  },
  {
    file: 'ui/pack-card-decoration.png',
    size: '1024x1024',
    cost: COST_1024,
    prompt: 'small collection of cute decorative elements, stars sparkles and geometric shapes, gold and white, flat illustration, NO BACKGROUND, fully transparent background, 1024x1024',
  },
];

const TOTAL = IMAGES.length;
const estimatedCost = IMAGES.reduce((sum, img) => sum + img.cost, 0);

let totalCost = 0;
let generated = 0;
let skipped = 0;
let failed = 0;

async function regenerateImage(img, index) {
  const outPath = path.join(ASSETS_DIR, img.file);
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  const tag = `[${index + 1}/${TOTAL}]`;

  // Check if exists and offer skip
  if (fs.existsSync(outPath)) {
    // Back up existing file
    const backupPath = outPath + '.bak';
    fs.copyFileSync(outPath, backupPath);
  }

  process.stdout.write(`${tag} Regenerating ${img.file}... `);

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: img.prompt,
      n: 1,
      size: img.size,
      quality: 'standard',
      response_format: 'b64_json',
    });

    const b64 = response.data[0].b64_json;
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(outPath, buffer);

    totalCost += img.cost;
    generated++;
    const sizeKb = (buffer.length / 1024).toFixed(0);
    console.log(`OK ${sizeKb} KB ($${totalCost.toFixed(2)} spent)`);

    // Remove backup on success
    const backupPath = outPath + '.bak';
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  } catch (err) {
    failed++;
    const msg = err?.error?.message || err?.message || String(err);
    console.log(`FAIL (${msg})`);

    // Restore backup on failure
    const backupPath = outPath + '.bak';
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, outPath);
      fs.unlinkSync(backupPath);
      console.log(`  Restored original from backup`);
    }
  }
}

async function main() {
  console.log('=== Regenerate Problem Assets ===');
  console.log(`Total images: ${TOTAL}`);
  console.log(`Est. cost:    $${estimatedCost.toFixed(2)}`);
  console.log(`Output:       ${ASSETS_DIR}/`);
  console.log('');

  for (let i = 0; i < IMAGES.length; i++) {
    await regenerateImage(IMAGES[i], i);
    if (i < IMAGES.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('');
  console.log('=== Done ===');
  console.log(`Generated: ${generated}  Skipped: ${skipped}  Failed: ${failed}  Cost: $${totalCost.toFixed(2)}`);
}

main();
