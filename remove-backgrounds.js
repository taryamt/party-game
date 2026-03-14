/**
 * Remove solid backgrounds from DALL-E generated PNGs.
 * DALL-E cannot produce true transparency, so we strip backgrounds
 * by detecting near-black, near-white, and checkerboard-gray pixels.
 * Usage: node remove-backgrounds.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DIRS = [
  path.join(__dirname, 'public', 'assets', 'characters'),
  path.join(__dirname, 'public', 'assets', 'ui'),
];

// Background color thresholds
const isBlack = (r, g, b) => r < 30 && g < 30 && b < 30;
const isWhite = (r, g, b) => r > 225 && g > 225 && b > 225;
const isCheckerGray = (r, g, b) => {
  // Checkerboard grays are typically ~191 or ~204
  const avg = (r + g + b) / 3;
  return Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && avg > 170 && avg < 215;
};
const isBackground = (r, g, b) => isBlack(r, g, b) || isWhite(r, g, b) || isCheckerGray(r, g, b);

// Distance to nearest background color (0-1 range)
function bgProximity(r, g, b) {
  // Black proximity
  const blackDist = Math.sqrt(r * r + g * g + b * b) / 441.67; // max dist = sqrt(3*255^2)
  // White proximity
  const wr = 255 - r, wg = 255 - g, wb = 255 - b;
  const whiteDist = Math.sqrt(wr * wr + wg * wg + wb * wb) / 441.67;
  // Checker gray proximity (center ~192)
  const gr = r - 192, gg = g - 192, gb = b - 192;
  const grayDist = Math.sqrt(gr * gr + gg * gg + gb * gb) / 441.67;
  return Math.min(blackDist, whiteDist, grayDist);
}

async function processImage(filePath) {
  const filename = path.basename(filePath);
  process.stdout.write(`  Processing ${filename}... `);

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const { width, height, channels } = metadata;

    // Ensure we get RGBA
    const raw = await image.ensureAlpha().raw().toBuffer();
    const pixels = new Uint8Array(raw);
    const totalPixels = width * height;

    // First pass: detect dominant background color from corners
    const cornerSamples = [];
    const sampleSize = Math.min(20, Math.floor(width / 10));
    for (let y = 0; y < sampleSize; y++) {
      for (let x = 0; x < sampleSize; x++) {
        // Top-left
        let idx = (y * width + x) * 4;
        cornerSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
        // Top-right
        idx = (y * width + (width - 1 - x)) * 4;
        cornerSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
        // Bottom-left
        idx = ((height - 1 - y) * width + x) * 4;
        cornerSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
        // Bottom-right
        idx = ((height - 1 - y) * width + (width - 1 - x)) * 4;
        cornerSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
      }
    }

    // Find the most common background type
    let blackCount = 0, whiteCount = 0, grayCount = 0;
    for (const [r, g, b] of cornerSamples) {
      if (isBlack(r, g, b)) blackCount++;
      else if (isWhite(r, g, b)) whiteCount++;
      else if (isCheckerGray(r, g, b)) grayCount++;
    }

    const bgType = blackCount >= whiteCount && blackCount >= grayCount ? 'black'
      : whiteCount >= grayCount ? 'white' : 'gray';

    // Determine specific background check
    let isBgPixel;
    if (bgType === 'black') {
      isBgPixel = (r, g, b) => r < 40 && g < 40 && b < 40;
    } else if (bgType === 'white') {
      isBgPixel = (r, g, b) => r > 215 && g > 215 && b > 215;
    } else {
      isBgPixel = (r, g, b) => isCheckerGray(r, g, b) || isBlack(r, g, b);
    }

    // Second pass: flood fill from edges to find connected background
    const visited = new Uint8Array(totalPixels);
    const isBg = new Uint8Array(totalPixels);
    const queue = [];

    // Seed from all edge pixels
    for (let x = 0; x < width; x++) {
      queue.push(x); // top row
      queue.push((height - 1) * width + x); // bottom row
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push(y * width); // left col
      queue.push(y * width + (width - 1)); // right col
    }

    // BFS flood fill
    let head = 0;
    while (head < queue.length) {
      const pos = queue[head++];
      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];

      if (!isBgPixel(r, g, b)) continue;
      isBg[pos] = 1;

      const x = pos % width, y = Math.floor(pos / width);
      if (x > 0) queue.push(pos - 1);
      if (x < width - 1) queue.push(pos + 1);
      if (y > 0) queue.push(pos - width);
      if (y < height - 1) queue.push(pos + width);
    }

    // Third pass: apply transparency with edge feathering
    let transparentCount = 0;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      if (isBg[i]) {
        pixels[idx + 3] = 0; // fully transparent
        transparentCount++;
      } else {
        // Edge feathering: check if adjacent to background
        const x = i % width, y = Math.floor(i / width);
        let bgNeighbors = 0, totalNeighbors = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            totalNeighbors++;
            if (isBg[ny * width + nx]) bgNeighbors++;
          }
        }
        if (bgNeighbors > 0 && totalNeighbors > 0) {
          const ratio = bgNeighbors / totalNeighbors;
          if (ratio > 0.3) {
            // Semi-transparent edge pixel
            pixels[idx + 3] = Math.round(255 * (1 - ratio * 0.8));
          }
        }
      }
    }

    const percent = ((transparentCount / totalPixels) * 100).toFixed(1);

    // Save
    await sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels: 4 } })
      .png()
      .toFile(filePath + '.tmp');

    fs.renameSync(filePath + '.tmp', filePath);
    console.log(`OK (${bgType} bg, ${percent}% transparent)`);
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
  }
}

async function main() {
  console.log('=== Remove Backgrounds from DALL-E PNGs ===\n');

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`Skipping ${dir} (not found)`);
      continue;
    }

    console.log(`Processing ${path.relative(__dirname, dir)}/`);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
    for (const file of files) {
      await processImage(path.join(dir, file));
    }
    console.log('');
  }

  console.log('Done! All backgrounds removed.');
}

main();
