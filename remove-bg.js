const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.REMOVEBG_API_KEY || 'your-remove-bg-api-key';

const files = [
  'public/assets/characters/imp-crew.png',
  'public/assets/characters/imp-evil.png',
  'public/assets/characters/trivia.png',
  'public/assets/characters/hottake-a.png',
  'public/assets/characters/hottake-b.png',
  'public/assets/characters/mafia.png',
  'public/assets/characters/millionaire.png',
  'public/assets/characters/feud.png',
  'public/assets/characters/wavelength.png',
  'public/assets/characters/alias.png',
  'public/assets/characters/drawing.png',
  'public/assets/characters/win.png',
  'public/assets/characters/lose.png',
  'public/assets/ui/banner-gold.png',
  'public/assets/ui/divider-stars.png',
  'public/assets/ui/crown-large.png',
  'public/assets/ui/score-badge.png',
  'public/assets/ui/vote-badge.png',
];

async function removeBg(filePath) {
  const formData = new FormData();
  formData.append('image_file', fs.createReadStream(filePath));
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY, ...formData.getHeaders() },
    body: formData
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const buffer = await response.buffer();
  fs.writeFileSync(filePath, buffer);
  console.log('✓ Done:', path.basename(filePath));
}

async function main() {
  console.log('Removing backgrounds from', files.length, 'images...');
  for (const file of files) {
    try {
      process.stdout.write('[Processing] ' + path.basename(file) + '... ');
      await removeBg(file);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error('✗ Failed:', path.basename(file), err.message);
    }
  }
  console.log('Done! Run: git add . && git commit -m "transparent character images" && git push');
}

main();
