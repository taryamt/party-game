/**
 * Download Lottie JSON files from LottieFiles via their GraphQL API.
 * Usage: node download_lotties.js
 */
const fs = require('fs');
const path = require('path');

const URLS = [
  "https://lottiefiles.com/animations/confetti-partyyy-Wa6ZqQu2JW",
  "https://lottiefiles.com/animations/321-go-zxJXtObuj3",
  "https://lottiefiles.com/animations/cross-CFtVpSYnPX",
  "https://lottiefiles.com/animations/checkmark-animation-dJfka3ygAI",
  "https://lottiefiles.com/animations/star-burst-animation-9N1qvEFO9f",
  "https://lottiefiles.com/animations/trophy-yEGPe40FVr",
  "https://lottiefiles.com/animations/questions-hbahYVel4k",
  "https://lottiefiles.com/animations/loading-animation-0yMJ1aysad",
  "https://lottiefiles.com/animations/click-APUtcKq4gE",
  "https://lottiefiles.com/animations/heart-burst-KNWUh3e6SU",
  "https://lottiefiles.com/animations/magnifying-glass-uCcb0hPX6t",
  "https://lottiefiles.com/animations/ai-brain-842MIj3SPe",
  "https://lottiefiles.com/animations/fire-animation-zZ0tyv7uSp",
  "https://lottiefiles.com/animations/empty-ghost-jefFBa5UsX",
  "https://lottiefiles.com/animations/making-money-Os1hslOkjb",
  "https://lottiefiles.com/animations/green-splash-18CB9LFgou",
  "https://lottiefiles.com/animations/chat-bubble-7wBnruXppo",
  "https://lottiefiles.com/animations/wave-wave-I8wBBHAeqK",
  "https://lottiefiles.com/animations/loading-dots-tpHnmYPoJn",
  "https://lottiefiles.com/animations/process-fmpDUgNx8K",
  "https://lottiefiles.com/animations/thumbs-up-0TqyxC9x9J",
  "https://lottiefiles.com/animations/time-animation-PSQ66UEfL2",
  "https://lottiefiles.com/animations/crown-8ZbSEVZr5M",
  "https://lottiefiles.com/animations/lock-opens-and-turns-into-a-green-tick-4CwYRmG89G",
];

const OUT_DIR = path.join(__dirname, 'public', 'assets', 'lottie');
const GRAPHQL = 'https://graphql.lottiefiles.com/2022-08';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadLottie(url, index) {
  const segment = url.split('/').pop();           // "confetti-partyyy-Wa6ZqQu2JW"
  const parts = segment.split('-');
  const hash = parts.pop();                        // "Wa6ZqQu2JW"
  const slug = parts.join('-');                     // "confetti-partyyy"
  const filename = slug + '.json';

  process.stdout.write(`[${index + 1}/${URLS.length}] ${slug} (${hash})... `);

  try {
    // Query GraphQL for the JSON download URL
    const query = `{ publicAnimationByHash(hash: "${hash}") { jsonUrl lottieUrl name } }`;
    const gqlRes = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!gqlRes.ok) throw new Error(`GraphQL ${gqlRes.status}`);
    const gqlData = await gqlRes.json();
    const anim = gqlData?.data?.publicAnimationByHash;
    if (!anim) { console.log('SKIP (not found)'); return false; }

    let animationJson;

    if (anim.jsonUrl) {
      // Direct JSON download
      const jsonRes = await fetch(anim.jsonUrl);
      if (!jsonRes.ok) throw new Error(`JSON download ${jsonRes.status}`);
      animationJson = await jsonRes.json();
    } else if (anim.lottieUrl) {
      // dotLottie is a ZIP — extract animation JSON from it
      const { Blob } = await import('buffer');
      const lottieRes = await fetch(anim.lottieUrl);
      if (!lottieRes.ok) throw new Error(`dotLottie download ${lottieRes.status}`);
      const buf = Buffer.from(await lottieRes.arrayBuffer());

      // Parse ZIP manually (dotLottie is a zip with animations/*.json)
      const { createUnzip } = await import('zlib');
      // Simple approach: save temp, use built-in or find JSON in buffer
      // dotLottie ZIP structure: animations/<id>.json + manifest.json
      const tmpPath = path.join(OUT_DIR, '_tmp.lottie');
      fs.writeFileSync(tmpPath, buf);

      // Use Node's built-in to extract — or parse ZIP manually
      // Since we don't have a zip library, let's try to find JSON in the buffer
      // Look for the JSON start pattern after a local file header
      const jsonStart = buf.indexOf('{"v"');
      if (jsonStart === -1) {
        const jsonStart2 = buf.indexOf('{"nm"');
        if (jsonStart2 === -1) {
          fs.unlinkSync(tmpPath);
          console.log('SKIP (cannot parse .lottie)');
          return false;
        }
      }
      // Better approach: use the decompress npm or manual ZIP parse
      // For reliability, try fetching the page HTML to find jsonUrl
      fs.unlinkSync(tmpPath);

      // Fallback: try to get JSON URL from the page itself
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        // Look for JSON URLs in the page
        const jsonUrlMatch = html.match(/https:\/\/assets[^"']*\.json/);
        if (jsonUrlMatch) {
          const directRes = await fetch(jsonUrlMatch[0]);
          if (directRes.ok) {
            animationJson = await directRes.json();
          }
        }
      }
      if (!animationJson) {
        console.log('SKIP (only .lottie available, no JSON)');
        return false;
      }
    } else {
      console.log('SKIP (no URL)');
      return false;
    }

    const outPath = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, JSON.stringify(animationJson));
    const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`OK (${sizeKb} KB)`);
    return true;

  } catch (err) {
    console.log(`FAIL (${err.message})`);
    return false;
  }
}

async function main() {
  console.log(`Downloading ${URLS.length} Lottie animations...\n`);
  let success = 0, fail = 0;

  for (let i = 0; i < URLS.length; i++) {
    const ok = await downloadLottie(URLS[i], i);
    if (ok) success++; else fail++;
    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone: ${success} downloaded, ${fail} failed, ${URLS.length} total`);
  console.log(`Saved to: ${OUT_DIR}`);
}

main();
