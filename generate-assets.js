require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in .env file');
  console.error('Make sure .env exists and contains: OPENAI_API_KEY=sk-...');
  process.exit(1);
} else {
  console.log('✓ API key loaded successfully');
}

/**
 * Generate art assets for Party Games using DALL-E 3 API.
 * Usage: node generate-assets.js
 * Reads OPENAI_API_KEY from .env file.
 */
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_DIR = path.join(__dirname, 'public', 'assets');
const BUDGET = 9.00;
const COST_1024 = 0.040;
const COST_1792 = 0.080;
const DELAY_MS = 2000;

const BASE_STYLE = 'flat illustration, cute cartoon style, thick black outlines, cel-shading with soft highlights, vibrant saturated colors, party game aesthetic, no realistic elements, no people no humans';

let totalCost = 0;
let totalGenerated = 0;
let totalSkipped = 0;
let totalFailed = 0;

// ═══════════════════════════════════════
// ASSET DEFINITIONS
// ═══════════════════════════════════════

const CHARACTERS = [
  {
    file: 'imp-crew.png',
    prompt: 'a wobbly asymmetrical green blob creature with one giant round glossy eye centered on its body, tiny stubby arms too small for its body, holding a small magnifying glass up curiously, innocent wide open expression, slightly nervous with one tiny sweat bead, primary color #4ade80 bright green, gold accents on magnifying glass, cute non-humanoid creature, round glossy eyes with white highlight dot, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'imp-evil.png',
    prompt: 'a wobbly asymmetrical red blob creature with one giant round glossy eye shifted sideways not looking straight ahead, tiny stubby arms, magnifying glass tucked behind its body, sneaky guilty smirk, small sweat drop, primary color #ef4444 red, dark red shadows, gold accents, trying hard to look normal but failing, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'trivia.png',
    prompt: 'a stylized floating brain creature, smooth rounded cloud-like folds, cute not gross, tiny round gold-framed glasses, small stubby arms, smug confident expression, soft purple #c084fc, deep purple shadows, gold glasses frames, shadow underneath suggesting levitation, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'hottake-a.png',
    prompt: 'a living teal flame creature, teardrop flame body, face in lower portion, flame tip curls left, glowing core visible, tiny floating hands no arms, cool calm confident expression, primary color #06D6A0 teal, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'hottake-b.png',
    prompt: 'a living coral flame creature, teardrop flame body, face in lower portion, flame tip curls right, glowing core visible, tiny floating hands no arms, hot passionate intense expression, primary color #EF6351 coral red, inner glow orange, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'mafia.png',
    prompt: 'a mysterious shadow creature, round body filled with deep purple-black #1e1b4b, only two glowing white eyes visible, tiny gold-banded fedora on top, cape-like drape at bottom, soft purple glow radiating outward, sinister but cute, thick black outline, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'millionaire.png',
    prompt: 'a fat round gold coin character standing upright, face stamped into coin surface, tiny arms, tiny top hat on top edge, monocle over one eye, smug wealthy expression, primary color #fbbf24 gold, cream face area, shiny gloss, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'feud.png',
    prompt: 'two horseshoe magnet characters facing each other, U-shape bodies with faces in the curves, tiny legs, leaning toward each other, gold electric sparks between them, left magnet #f97316 orange, right magnet #06b6d4 cyan, competitive eager expressions, cute non-humanoid creatures, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'wavelength.png',
    prompt: 'abstract creature from continuous sine wave line looping into body shape, glossy eyes within wave loops, wave alternates purple #8b5cf6 and cyan #06b6d4, soft radial glow, small floating dial knob, concentrating expression, appears to vibrate, cute non-humanoid creature, thick black outline, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'alias.png',
    prompt: 'large expressive cartoon lips as main body, big puckered pink lips, glossy eyes floating above lips, tiny floating hands one pointing one covering mouth, white teeth visible, primary color #ec4899 hot pink, frantic urgency expression, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'drawing.png',
    prompt: 'living paintbrush character, round fluffy multicolor bristle head with eyes peeking out, orange cylindrical handle body #f97316, colorful paint drips, tiny feet, huge chaotic happy grin, small canvas beside it with terrible scribble drawing, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'win.png',
    prompt: 'round gold blob creature jumping in celebration, arms raised, huge smile, eyes as happy crescents, gold #FFD166, stars and sparkles exploding, tiny trophy above head, motion lines, pure joy, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
  {
    file: 'lose.png',
    prompt: 'round blue-grey blob creature looking dejected, slouched posture, downcast eyes, single tear, tiny rain cloud above head, muted #94a3b8, still cute and pouting not tragic, cute non-humanoid creature, thick black outline, cel-shading, transparent background, no humans, 1024x1024, high quality',
  },
];

const SCENES = [
  { file: 'home-bg.png', prompt: 'cozy game night room, table with board games cards dice and snacks, warm lamplight casting soft shadows, bookshelves on walls, plants in corners, no people, flat illustration, thick outlines, warm gold and navy palette, inviting party atmosphere, 1792x1024' },
  { file: 'imp-setup.png', prompt: 'dark mysterious alley at night, foggy atmosphere, single streetlamp cone of light, shadowy doorways and fire escapes, no people, flat illustration, thick outlines, dark navy and purple with gold light accents, spooky but cute, 1792x1024' },
  { file: 'imp-crew-bg.png', prompt: 'cozy warmly lit living room, soft warm lighting, bookshelves plants soft furnishings armchairs, no people, flat illustration, thick outlines, warm gold and cream palette, safe and inviting, 1792x1024' },
  { file: 'imp-imposter-bg.png', prompt: 'dark dramatic room, deep red and black, single harsh spotlight from above, long dramatic shadows, ominous feeling, no people, flat illustration, thick outlines, red and dark navy palette, 1792x1024' },
  { file: 'imp-discuss-bg.png', prompt: 'detective investigation corkboard scene, strings connecting clues and question marks, magnifying glasses scattered around, newspaper clippings, no people, flat illustration, thick outlines, warm amber and navy, 1792x1024' },
  { file: 'imp-caught.png', prompt: 'dramatic spotlight on empty center stage, confetti raining down, prison bar silhouette on one side, celebratory atmosphere, no people, flat illustration, thick outlines, gold and red palette, 1792x1024' },
  { file: 'imp-escaped.png', prompt: 'dark city rooftop at night, shadow disappearing into darkness, city lights twinkling below, mysterious escape atmosphere, no people, flat illustration, thick outlines, dark blue and purple with gold lights, 1792x1024' },
  { file: 'trivia-setup.png', prompt: 'colorful quiz show stage, three podiums with buzzers, spotlights from above, giant question marks as decorations, scoreboard on wall, no people, flat illustration, thick outlines, purple and gold, game show energy, 1792x1024' },
  { file: 'trivia-question-bg.png', prompt: 'giant chalkboard covered in equations question marks and colorful doodles, chalk marks everywhere, wooden frame, no people, flat illustration, thick outlines, dark green chalkboard with bright chalk colors, 1792x1024' },
  { file: 'trivia-correct-bg.png', prompt: 'explosion of books lightbulbs and stars bursting outward from center, celebration energy, bright and colorful, no people, flat illustration, thick outlines, gold and teal palette, 1792x1024' },
  { file: 'trivia-wrong-bg.png', prompt: 'scattered papers and books flying everywhere, comedic chaos, question marks spinning, no people, flat illustration, thick outlines, soft muted colors with red accents, funny not sad, 1792x1024' },
  { file: 'hottake-setup.png', prompt: 'debate stage split perfectly down middle, two podiums facing each other, dramatic spotlight each side, crowd silhouettes, no people up close, flat illustration, thick outlines, teal left coral right, 1792x1024' },
  { file: 'hottake-question-bg.png', prompt: 'crowd split down the middle into two halves, each side different color, electric tension between them, no people faces, abstract crowd shapes, flat illustration, thick outlines, teal and coral palette, 1792x1024' },
  { file: 'hottake-results-bg.png', prompt: 'giant scales of justice perfectly balanced or tipping, crowd reaction energy, dramatic lighting, no people, flat illustration, thick outlines, gold and purple palette, 1792x1024' },
  { file: 'mafia-night.png', prompt: 'moonlit village at night, dark houses with warm lit windows, full moon and stars, mysterious shadows, no people, flat illustration, thick outlines, deep navy and purple with warm window glow, eerie cute atmosphere, 1792x1024' },
  { file: 'mafia-day.png', prompt: 'sunny village town square, houses around a central plaza, warm daytime light, accusatory atmosphere suggested by layout, no people, flat illustration, thick outlines, warm yellow and terracotta palette, 1792x1024' },
  { file: 'millionaire-setup.png', prompt: 'game show stage with dramatic spotlights, single ornate armchair in center spotlight, money symbols floating, luxurious gold decor, curtains, no people, flat illustration, thick outlines, gold and deep purple, 1792x1024' },
  { file: 'millionaire-question-bg.png', prompt: 'hot seat armchair from behind in spotlight, audience seats visible in darkness beyond, dramatic atmosphere, no people, flat illustration, thick outlines, gold and dark palette, 1792x1024' },
  { file: 'feud-setup.png', prompt: 'game show stage with two long podiums facing each other across a gap, big buzzer in center, scoreboard above, lights and cameras, no people, flat illustration, thick outlines, orange and cyan palette, 1792x1024' },
  { file: 'wavelength-setup.png', prompt: 'abstract radio wave tower landscape, waves emanating outward, dials and frequency displays, cosmic starry background, no people, flat illustration, thick outlines, purple and cyan palette, 1792x1024' },
  { file: 'alias-setup.png', prompt: 'cozy living room game night setting, cards scattered on table, timer visible, warm lighting, speech bubbles floating around, no people, flat illustration, thick outlines, pink and warm palette, 1792x1024' },
  { file: 'drawing-setup.png', prompt: 'art studio scene, easels with canvases, paint pots everywhere, colorful paint splashes on floor and walls, brushes scattered, no people, flat illustration, thick outlines, orange and multicolor palette, 1792x1024' },
  { file: 'win-bg.png', prompt: 'massive celebration scene, fireworks exploding in night sky, confetti raining, stars bursting, streamers everywhere, pure joy energy, no people, flat illustration, thick outlines, gold pink and teal palette, 1792x1024' },
  { file: 'lose-bg.png', prompt: 'comedic rainy scene, single sad rain cloud with rain falling, puddles reflecting light, small rainbow peeking through clouds, still cute and warm not depressing, no people, flat illustration, thick outlines, soft blue grey with rainbow accents, 1792x1024' },
  { file: 'scoreboard-bg.png', prompt: 'grand podium scene, three tiered platforms labeled 1st 2nd 3rd, spotlights on each tier, confetti and stars floating, trophy on top tier, no people, flat illustration, thick outlines, gold silver bronze palette, 1792x1024' },
  { file: 'loading-bg.png', prompt: 'cozy waiting room scene, comfortable chairs, game boxes on shelves, warm lighting, clock on wall, plants, no people, flat illustration, thick outlines, warm navy and gold palette, inviting calm atmosphere, 1792x1024' },
];

const UI_ELEMENTS = [
  { file: 'card-frame-gold.png', prompt: 'ornate gold decorative card frame border, thick rounded corners, gold color #FFD166, jewel decorations at corners, no background inside frame just border, flat illustration, thick outlines, transparent center and background, 1024x1024' },
  { file: 'card-frame-red.png', prompt: 'same ornate card frame but coral red #EF6351 color scheme, thick rounded corners, jewel decorations at corners, transparent center and background, flat illustration, 1024x1024' },
  { file: 'card-frame-teal.png', prompt: 'same ornate card frame but teal #06D6A0 color scheme, thick rounded corners, jewel decorations, transparent center and background, flat illustration, 1024x1024' },
  { file: 'banner-gold.png', prompt: 'decorative banner ribbon shape, gold #FFD166 color, thick outlines, bunting style with scalloped edges, no text, flat illustration, transparent background, 1024x1024' },
  { file: 'divider-stars.png', prompt: 'horizontal decorative divider made of stars and sparkles, gold and white, flat illustration, thick outlines, transparent background, wide format 1024x256' },
  { file: 'score-badge.png', prompt: 'cute circular badge design, gold star in center, thick outlines, decorative rays around edge, flat illustration, transparent background, 1024x1024' },
  { file: 'vote-badge.png', prompt: 'cute circular voting badge, checkmark or vote symbol in center, teal color scheme, thick outlines, flat illustration, transparent background, 1024x1024' },
  { file: 'timer-frame.png', prompt: 'decorative frame for timer display, clock elements integrated into border design, orange color scheme, thick outlines, flat illustration, transparent background with frame only, 1024x1024' },
  { file: 'crown-large.png', prompt: 'large ornate cartoon crown, gold #FFD166, jewels in red teal and purple, thick outlines, cel-shading, transparent background, flat illustration, 1024x1024' },
  { file: 'speech-bubble-1.png', prompt: 'large rounded speech bubble with thick outline, clean interior for text, tail pointing bottom-left, gold border white fill, flat illustration, transparent background, 1024x1024' },
  { file: 'speech-bubble-2.png', prompt: 'thought bubble style with circle dots leading to main bubble, thick outline, clean white interior, purple border, flat illustration, transparent background, 1024x1024' },
  { file: 'pack-card-decoration.png', prompt: 'small collection of cute decorative elements for pack cards, stars sparkles and small geometric shapes, gold and white, flat illustration, transparent background, 1024x1024' },
];

const BACKGROUNDS = [
  { file: 'bg-dark-stars.png', prompt: 'deep dark navy background with subtle scattered stars and tiny sparkles, very subtle not overwhelming, gradient from darker navy at edges to slightly lighter in center, no characters no objects, just atmospheric background texture, flat illustration style, 1792x1024' },
  { file: 'bg-warm-cozy.png', prompt: 'warm cream and gold toned background, subtle repeating pattern of tiny game night icons dice cards stars very small and subtle, warm atmosphere, no characters, flat illustration, 1792x1024' },
  { file: 'bg-celebration.png', prompt: 'festive background with scattered confetti shapes and streamers, colorful but not overwhelming, transparent-ish feel, no characters, flat illustration, thick outlines, multicolor on dark navy, 1792x1024' },
  { file: 'bg-mystery.png', prompt: 'dark mysterious background, subtle fog effect, tiny stars, deep purple and navy gradient, atmospheric, no characters no objects, flat illustration, 1792x1024' },
  { file: 'bg-pattern-gold.png', prompt: 'seamless repeating pattern background, small cute cartoon icons related to party games, stars crowns dice cards hearts, gold on dark navy, subtle not overwhelming, flat illustration, 1792x1024' },
];

const DOODLES = [
  { file: 'doodles-sheet-1.png', prompt: 'collection of 20 small cute cartoon doodle elements on transparent background with space between each, including star, crown, lightning bolt, heart, speech bubble, question mark, exclamation mark, dice, playing card, trophy, each with thick black outline, vibrant colors, cel-shaded, arranged in 4x5 grid, transparent background, 1024x1024' },
  { file: 'doodles-sheet-2.png', prompt: 'collection of 20 small cute cartoon doodle elements on transparent background, including magnifying glass, sparkle, musical note, fire flame, thumbs up, clock, ribbon bow, confetti pieces, diamond, party popper, paint splash, brain, coin, fedora hat, buzzer button, wave lines, microphone, pencil, each thick black outline vibrant colors, transparent background, 1024x1024' },
  { file: 'doodles-game-icons.png', prompt: 'collection of 9 small cute circular icon badges one for each game, imposter detective badge, trivia brain badge, hot take flame badge, mafia shadow badge, millionaire coin badge, feud magnets badge, wavelength wave badge, alias lips badge, drawing brush badge, each in its game color, thick outlines, flat illustration, transparent background arranged in 3x3 grid, 1024x1024' },
];

// ═══════════════════════════════════════
// BUILD FULL JOB LIST
// ═══════════════════════════════════════

const jobs = [];

CHARACTERS.forEach(c => jobs.push({ ...c, dir: 'characters', size: '1024x1024', cost: COST_1024 }));
SCENES.forEach(s => jobs.push({ ...s, dir: 'scenes', size: '1792x1024', cost: COST_1792 }));
UI_ELEMENTS.forEach(u => jobs.push({ ...u, dir: 'ui', size: '1024x1024', cost: COST_1024 }));
BACKGROUNDS.forEach(b => jobs.push({ ...b, dir: 'backgrounds', size: '1792x1024', cost: COST_1792 }));
DOODLES.forEach(d => jobs.push({ ...d, dir: 'doodles', size: '1024x1024', cost: COST_1024 }));

const TOTAL_JOBS = jobs.length;
const estimatedCost = jobs.reduce((sum, j) => sum + j.cost, 0);

// ═══════════════════════════════════════
// GENERATION
// ═══════════════════════════════════════

async function generateImage(job, index) {
  const outDir = path.join(BASE_DIR, job.dir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, job.file);

  // Skip if already exists
  if (fs.existsSync(outPath)) {
    totalSkipped++;
    console.log(`[${index + 1}/${TOTAL_JOBS}] ${job.file} — SKIP (already exists)`);
    return;
  }

  // Budget check
  if (totalCost + job.cost > BUDGET) {
    totalFailed++;
    console.log(`[${index + 1}/${TOTAL_JOBS}] ${job.file} — SKIP (would exceed $${BUDGET.toFixed(2)} budget)`);
    return;
  }

  const tag = `[${index + 1}/${TOTAL_JOBS}]`;
  process.stdout.write(`${tag} Generating ${job.file}... `);

  try {
    const fullPrompt = `${BASE_STYLE}. ${job.prompt}`;
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: job.size,
      quality: 'standard',
      response_format: 'b64_json',
    });

    const b64 = response.data[0].b64_json;
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(outPath, buffer);

    totalCost += job.cost;
    totalGenerated++;
    const sizeKb = (buffer.length / 1024).toFixed(0);
    console.log(`\u2713 ${sizeKb} KB ($${totalCost.toFixed(2)} spent / $${BUDGET.toFixed(2)} budget)`);

  } catch (err) {
    totalFailed++;
    const msg = err?.error?.message || err?.message || String(err);
    console.log(`\u2717 FAIL (${msg})`);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not found. Create a .env file with:\nOPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════');
  console.log('  PARTY GAMES ASSET GENERATOR');
  console.log('═══════════════════════════════════════');
  console.log(`Total images: ${TOTAL_JOBS}`);
  console.log(`Estimated cost: $${estimatedCost.toFixed(2)}`);
  console.log(`Budget: $${BUDGET.toFixed(2)}`);
  console.log(`Output: ${BASE_DIR}/`);
  console.log('');
  console.log(`  Characters: ${CHARACTERS.length} @ $${COST_1024}/ea`);
  console.log(`  Scenes:     ${SCENES.length} @ $${COST_1792}/ea`);
  console.log(`  UI:         ${UI_ELEMENTS.length} @ $${COST_1024}/ea`);
  console.log(`  Backgrounds:${BACKGROUNDS.length} @ $${COST_1792}/ea`);
  console.log(`  Doodles:    ${DOODLES.length} @ $${COST_1024}/ea`);
  console.log('═══════════════════════════════════════\n');

  for (let i = 0; i < jobs.length; i++) {
    await generateImage(jobs[i], i);
    // Delay between generations (skip delay for skipped files)
    if (i < jobs.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  GENERATION COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log(`Total images generated: ${totalGenerated}`);
  console.log(`Total skipped (existing): ${totalSkipped}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Total cost: $${totalCost.toFixed(2)}`);
  console.log(`Files saved to: ${BASE_DIR}/`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Run: git add public/assets/');
  console.log('  2. Run: git commit -m "add all art assets"');
  console.log('  3. Run: git push');
  console.log('  Then come back to integrate assets into the app!');
  console.log('═══════════════════════════════════════');
}

main();
