"""Download Lottie JSON files from LottieFiles URLs via their GraphQL API."""
import requests, json, os, sys, time

URLS = [
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
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "public", "assets", "lottie")
GRAPHQL = "https://graphql.lottiefiles.com/2022-08"

os.makedirs(OUT_DIR, exist_ok=True)
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

success, fail = 0, 0
for url in URLS:
    # Extract hash (last segment after final hyphen) and slug (middle part)
    parts = url.rstrip("/").split("/")[-1]  # e.g. "confetti-partyyy-Wa6ZqQu2JW"
    hash_id = parts.split("-")[-1]
    slug = "-".join(parts.split("-")[:-1])  # e.g. "confetti-partyyy"
    filename = slug + ".json"

    print(f"[{success+fail+1}/{len(URLS)}] {slug} (hash: {hash_id})...", end=" ", flush=True)

    try:
        # Query GraphQL for the JSON download URL
        query = '{ publicAnimationByHash(hash: "%s") { jsonUrl lottieUrl name } }' % hash_id
        resp = session.post(GRAPHQL, json={"query": query}, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        anim = data.get("data", {}).get("publicAnimationByHash")
        if not anim:
            print("SKIP (not found in API)")
            fail += 1
            continue

        json_url = anim.get("jsonUrl")
        lottie_url = anim.get("lottieUrl")

        if json_url:
            # Direct JSON download
            r = session.get(json_url, timeout=30)
            r.raise_for_status()
            animation_data = r.json()
            out_path = os.path.join(OUT_DIR, filename)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(animation_data, f, separators=(",", ":"))
            size_kb = os.path.getsize(out_path) / 1024
            print(f"OK ({size_kb:.0f} KB)")
            success += 1

        elif lottie_url:
            # dotLottie is a ZIP — extract the animation JSON from it
            import zipfile, io
            r = session.get(lottie_url, timeout=30)
            r.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
                # Find the animation JSON inside the .lottie zip
                json_files = [n for n in zf.namelist() if n.endswith(".json") and "manifest" not in n.lower()]
                if not json_files:
                    print("SKIP (no JSON in .lottie)")
                    fail += 1
                    continue
                animation_data = json.loads(zf.read(json_files[0]))
                out_path = os.path.join(OUT_DIR, filename)
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(animation_data, f, separators=(",", ":"))
                size_kb = os.path.getsize(out_path) / 1024
                print(f"OK via .lottie ({size_kb:.0f} KB)")
                success += 1
        else:
            print("SKIP (no download URL)")
            fail += 1

    except Exception as e:
        print(f"FAIL ({e})")
        fail += 1

    time.sleep(0.3)  # Be nice to the API

print(f"\nDone: {success} downloaded, {fail} failed, {len(URLS)} total")
print(f"Saved to: {OUT_DIR}")
