require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

/**
 * Regenerate character images with proper transparent backgrounds.
 * Text prompts only — no image input.
 * Usage: node regenerate-problem-assets.js
 */
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHAR_DIR = path.join(__dirname, 'public', 'assets', 'characters');
const COST_PER = 0.040;
const DELAY_MS = 2500;

const BASE_STYLE = 'flat illustration, cute cartoon style, thick black outlines, cel-shading with soft highlights, vibrant saturated colors, party game aesthetic, no realistic elements, no people no humans, PNG with fully transparent background, no checkerboard, no white background, no colored background, only the character visible';

const CHARACTERS = [
  {
    file: 'imp-crew.png',
    prompt: 'a wobbly asymmetrical green blob creature with one giant round glossy eye centered on its body, tiny stubby arms too small for its body, holding a small magnifying glass up curiously, innocent wide open expression, slightly nervous with one tiny sweat bead, primary color #4ade80 bright green, gold accents on magnifying glass, cute non-humanoid creature, round glossy eyes with white highlight dot, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'imp-evil.png',
    prompt: 'a wobbly asymmetrical red blob creature with one giant round glossy eye shifted sideways not looking straight ahead, tiny stubby arms, magnifying glass tucked behind its body, sneaky guilty smirk, small sweat drop, primary color #ef4444 red, dark red shadows, gold accents, trying hard to look normal but failing, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'trivia.png',
    prompt: 'a stylized floating brain creature, smooth rounded cloud-like folds, cute not gross, tiny round gold-framed glasses, small stubby arms, smug confident expression, soft purple #c084fc, deep purple shadows, gold glasses frames, shadow underneath suggesting levitation, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'hottake-a.png',
    prompt: 'a living teal flame creature, teardrop flame body, face in lower portion, flame tip curls left, glowing core visible, tiny floating hands no arms, cool calm confident expression, primary color #06D6A0 teal, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'hottake-b.png',
    prompt: 'a living coral flame creature, teardrop flame body, face in lower portion, flame tip curls right, glowing core visible, tiny floating hands no arms, hot passionate intense expression, primary color #EF6351 coral red, inner glow orange, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'mafia.png',
    prompt: 'a mysterious shadow creature, round body filled with deep purple-black #1e1b4b, only two glowing white eyes visible, tiny gold-banded fedora on top, cape-like drape at bottom, soft purple glow radiating outward, sinister but cute, thick black outline, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'millionaire.png',
    prompt: 'a fat round gold coin character standing upright, face stamped into coin surface, tiny arms, tiny top hat on top edge, monocle over one eye, smug wealthy expression, primary color #fbbf24 gold, cream face area, shiny gloss, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'feud.png',
    prompt: 'two horseshoe magnet characters facing each other, U-shape bodies with faces in the curves, tiny legs, leaning toward each other, gold electric sparks between them, left magnet #f97316 orange, right magnet #06b6d4 cyan, competitive eager expressions, cute non-humanoid creatures, thick black outline, cel-shading, fully transparent background, isolated characters only, 1024x1024',
  },
  {
    file: 'wavelength.png',
    prompt: 'abstract creature from continuous sine wave line looping into body shape, glossy eyes within wave loops, wave alternates purple #8b5cf6 and cyan #06b6d4, soft radial glow, small floating dial knob, concentrating expression, appears to vibrate, cute non-humanoid creature, thick black outline, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'alias.png',
    prompt: 'large expressive cartoon lips as main body, big puckered pink lips, glossy eyes floating above lips, tiny floating hands one pointing one covering mouth, white teeth visible, primary color #ec4899 hot pink, frantic urgency expression, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'drawing.png',
    prompt: 'living paintbrush character, round fluffy multicolor bristle head with eyes peeking out, orange cylindrical handle body #f97316, colorful paint drips, tiny feet, huge chaotic happy grin, small canvas beside it with terrible scribble drawing, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'win.png',
    prompt: 'round gold blob creature jumping in celebration, arms raised, huge smile, eyes as happy crescents, gold #FFD166, stars and sparkles exploding, tiny trophy above head, motion lines, pure joy, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
  {
    file: 'lose.png',
    prompt: 'round blue-grey blob creature looking dejected, slouched posture, downcast eyes, single tear, tiny rain cloud above head, muted #94a3b8, still cute and pouting not tragic, cute non-humanoid creature, thick black outline, cel-shading, fully transparent background, isolated character only, 1024x1024',
  },
];

let totalCost = 0;
let generated = 0;
let failed = 0;

async function regenerateCharacter(char, index) {
  const outPath = path.join(CHAR_DIR, char.file);

  // Back up existing file
  if (fs.existsSync(outPath)) {
    const backupPath = outPath + '.bak';
    fs.copyFileSync(outPath, backupPath);
  }

  const tag = `[${index + 1}/${CHARACTERS.length}]`;
  process.stdout.write(`${tag} Regenerating ${char.file}... `);

  try {
    const fullPrompt = `${BASE_STYLE}. ${char.prompt}`;
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    });

    const b64 = response.data[0].b64_json;
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(outPath, buffer);

    totalCost += COST_PER;
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
      console.log(`  Restored original ${char.file} from backup`);
    }
  }
}

async function main() {
  fs.mkdirSync(CHAR_DIR, { recursive: true });

  console.log('=== Regenerate Character Assets ===');
  console.log(`Characters: ${CHARACTERS.length}`);
  console.log(`Est. cost:  $${(CHARACTERS.length * COST_PER).toFixed(2)}`);
  console.log(`Output:     ${CHAR_DIR}/`);
  console.log('');

  for (let i = 0; i < CHARACTERS.length; i++) {
    await regenerateCharacter(CHARACTERS[i], i);
    if (i < CHARACTERS.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('');
  console.log('=== Done ===');
  console.log(`Generated: ${generated}  Failed: ${failed}  Cost: $${totalCost.toFixed(2)}`);
}

main();
