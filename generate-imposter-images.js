require('dotenv').config();
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const dir = 'public/assets/imposter';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function generate(filename, prompt, aspectRatio = '1:1') {
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    console.log(`  SKIP (exists): ${filename}`);
    return;
  }
  console.log(`\nGenerating ${filename}...`);
  const output = await replicate.run('black-forest-labs/flux-2-pro', {
    input: { prompt, aspect_ratio: aspectRatio, output_format: 'png' }
  });

  const url = String(output);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
  console.log(`  OK: ${filename}`);
  await new Promise(r => setTimeout(r, 2000));
}

async function main() {
  console.log('Generating Imposter game assets with flux-2-pro...\n');

  // 1. HOME CARD BACKGROUND
  await generate('card-bg.png',
    `dark mysterious detective game card illustration, vertical card format, deep crimson and dark brown atmosphere, cobblestone alley at night seen from slight above angle, single warm golden streetlamp casting dramatic cone of light, large ornate magnifying glass floating in center as hero element, subtle fog at ground level, shadowy doorways in background, question marks and footprints subtly visible in shadows, flat illustration style, thick clean outlines, bold saturated colors, cel shading, no people no characters no text, professional game UI card background`,
    '2:3'
  );

  // 2. TILING BACKGROUND TEXTURE
  await generate('bg-texture.png',
    `seamless tileable dark background pattern for a detective mystery party game, deep crimson dark red color #1a0505, scattered subtle detective symbols: tiny magnifying glasses, small footprints, question marks, eye symbols, fingerprints, all drawn in slightly lighter crimson barely visible, flat minimal illustration, consistent symbol sizing, evenly distributed spacing, seamlessly tileable pattern, no text no characters, very subtle not overwhelming, square format perfect for tiling`,
    '1:1'
  );

  // 3. PASS SCREEN EYE
  await generate('eye-hero.png',
    `large dramatic stylized eye illustration for a mystery party game, centered single eye looking directly forward, dark crimson background #1a0505 baked in, eye has dramatic lighting, slight glow around iris, thick bold outlines, flat cartoon illustration style, cel shading, deep red and amber tones, slightly unsettling but fun party game aesthetic, no text no other elements, eye fills most of frame, square format`,
    '1:1'
  );

  // 4. DISCUSSION HEADER
  await generate('discussion-header.png',
    `detective investigation corkboard header decoration, wide landscape format, wooden corkboard texture at top, several pins with strings connecting small clue cards, question marks on papers, a small magnifying glass pinned up, one paper says SUSPECTS in bold, warm amber and brown tones, thick outlines, flat cartoon illustration, cel shading, no people no faces, designed to sit at top of a game screen as header decoration, wide banner proportions`,
    '16:9'
  );

  // 5. CAUGHT STAMP
  await generate('stamp-caught.png',
    `dramatic rubber stamp graphic for a party game result screen, deep crimson red background #1a0505 baked in, large bold stamp that reads CAUGHT in thick block letters, stamp has classic rubber stamp texture and ink bleed effect, slightly rotated 5 degrees, stamp ring border around text, red ink on dark background, bold and dramatic, flat graphic design style, thick outlines, no other elements, stamp fills most of frame`,
    '1:1'
  );

  // 6. ESCAPED STAMP
  await generate('stamp-escaped.png',
    `dramatic rubber stamp graphic for a party game result screen, deep dark crimson background #1a0505 baked in, large bold stamp that reads ESCAPED in thick block letters, stamp has classic rubber stamp texture and ink bleed effect, slightly rotated minus 5 degrees, stamp ring border around text, dark shadowy ink on dark background, ominous and dramatic, flat graphic design style, thick outlines, no other elements, stamp fills most of frame`,
    '1:1'
  );

  console.log('\n✓ All 6 Imposter assets generated!');
  console.log('Saved to public/assets/imposter/');
}

main().catch(console.error);
