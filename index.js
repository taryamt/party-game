const Anthropic = require("@anthropic-ai/sdk");
const readline = require("readline");

const client = new Anthropic();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function clearScreen() {
  process.stdout.write("\x1B[2J\x1B[0f");
}

function banner() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║       GUESS THE IMPOSTER             ║");
  console.log("╚══════════════════════════════════════╝");
  console.log();
}

async function generateWordAndHint(category) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20241022",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Pick a specific, well-known word from the category "${category}". Then create a subtle hint that relates to it but does NOT give it away directly. The hint should be vague enough that someone could guess several things from it.

Respond in exactly this JSON format with no other text:
{"word": "the word", "hint": "the subtle hint"}`,
      },
    ],
  });

  const text = response.content[0].text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse AI response");
  return JSON.parse(match[0]);
}

async function main() {
  clearScreen();
  banner();

  console.log("Welcome! One player will be the host.\n");

  const category = await ask("Host, enter a category (e.g. fruits, movies, jobs): ");
  if (!category.trim()) {
    console.log("No category entered. Exiting.");
    rl.close();
    return;
  }

  console.log(`\nGenerating a secret word for "${category}"...`);
  let wordData;
  try {
    wordData = await generateWordAndHint(category.trim());
  } catch (err) {
    console.error("Error generating word:", err.message);
    rl.close();
    return;
  }

  const { word, hint } = wordData;

  // Collect player names
  clearScreen();
  banner();
  console.log("Category: " + category.trim());
  console.log("\nNow enter player names (minimum 3). Type 'done' when finished.\n");

  const players = [];
  while (true) {
    const name = await ask(`Player ${players.length + 1} name (or 'done'): `);
    if (name.trim().toLowerCase() === "done") {
      if (players.length < 3) {
        console.log("Need at least 3 players!");
        continue;
      }
      break;
    }
    if (!name.trim()) continue;
    if (players.includes(name.trim())) {
      console.log("Name already taken!");
      continue;
    }
    players.push(name.trim());
  }

  // Pick a random imposter
  const imposterIndex = Math.floor(Math.random() * players.length);
  const imposter = players[imposterIndex];

  // Each player views their clue privately
  for (let i = 0; i < players.length; i++) {
    clearScreen();
    banner();
    console.log(`It's ${players[i]}'s turn to view their clue.\n`);
    console.log("Make sure only YOU can see the screen!\n");
    await ask("Press Enter when ready...");

    clearScreen();
    banner();
    console.log(`--- ${players[i]}'s CLUE ---\n`);

    if (i === imposterIndex) {
      console.log(`  Hint: "${hint}"\n`);
      console.log("  (You might be the imposter... or maybe not!)\n");
    } else {
      console.log(`  The word is: ${word.toUpperCase()}\n`);
      console.log("  (Don't say the word out loud!)\n");
    }

    await ask("Press Enter to clear and pass to the next player...");
  }

  // Discussion phase
  clearScreen();
  banner();
  console.log("All players have seen their clues!\n");
  console.log("DISCUSSION TIME!");
  console.log("Talk amongst yourselves. Ask questions, describe");
  console.log("things related to the word, and figure out who");
  console.log("seems clueless!\n");
  await ask("Press Enter when discussion is over and ready to vote...");

  // Voting phase
  clearScreen();
  banner();
  console.log("VOTING TIME!\n");
  console.log("Players: " + players.join(", ") + "\n");

  const votes = {};
  players.forEach((p) => (votes[p] = 0));

  for (const voter of players) {
    let vote;
    while (true) {
      vote = await ask(`${voter}, who do you think is the imposter? `);
      vote = vote.trim();
      if (!players.includes(vote)) {
        console.log(`  Invalid name. Choose from: ${players.join(", ")}`);
        continue;
      }
      if (vote === voter) {
        console.log("  You can't vote for yourself!");
        continue;
      }
      break;
    }
    votes[vote]++;
    console.log(`  Vote recorded!\n`);
  }

  // Tally votes
  clearScreen();
  banner();
  console.log("RESULTS\n");

  console.log("Vote tally:");
  const sortedVotes = Object.entries(votes)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [name, count] of sortedVotes) {
    const bar = "█".repeat(count);
    console.log(`  ${name}: ${bar} (${count} vote${count !== 1 ? "s" : ""})`);
  }
  console.log();

  // Determine who was voted out
  const maxVotes = sortedVotes[0][1];
  const votedOut = sortedVotes.filter(([, count]) => count === maxVotes);

  if (votedOut.length > 1) {
    console.log("It's a TIE! No one is eliminated.\n");
    console.log(`The imposter was: ${imposter}`);
    console.log("IMPOSTER WINS!\n");
  } else {
    const accused = votedOut[0][0];
    console.log(`The group voted out: ${accused}\n`);

    if (accused === imposter) {
      console.log("CORRECT! The group found the imposter!");
      console.log("CREW WINS!\n");
    } else {
      console.log("WRONG! That was an innocent player!");
      console.log(`The real imposter was: ${imposter}`);
      console.log("IMPOSTER WINS!\n");
    }
  }

  console.log(`The secret word was: ${word.toUpperCase()}`);
  console.log(`The hint was: "${hint}"\n`);

  await ask("Press Enter to exit...");
  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  rl.close();
  process.exit(1);
});
