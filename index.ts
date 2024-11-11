function humanizeTime(time_secs: number) {
  const hours = Math.floor(time_secs / 3600);
  const minutes = Math.floor((time_secs % 3600) / 60);
  const seconds = Math.floor(time_secs % 60);

  if (hours > 0) {
    return `${hours} hours ${minutes} minutes ${seconds} seconds`;
  } else if (minutes > 0) {
    return `${minutes} minutes ${seconds} seconds`;
  } else {
    return `${seconds} seconds`;
  }
}

// Получаем данные аккаунта из переменных окружения
const INIT_DATA = process.env.ACCOUNT_1_INIT_DATA || "";
const DELAY = parseInt(process.env.DELAY || "5000");
const TAPS_PER_SYNC = parseInt(process.env.TAPS_PER_SYNC || "15");
const RAND_THRESHOLD = parseFloat(process.env.RANDOMIZATION_THRESHOLD || "0.2");

let user_agent = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
][Math.floor(Math.random() * 3)];

let jb, cookies: string | null, coinsPerTap, currentEnergy: number, currentCoins, ENERGY_REFILL_TIME: number;

async function auth() {
  let r = await fetch("https://qlyuker.io/api/auth/start", {
    method: "POST",
    headers: {
      TGPlatform: user_agent.includes("iPhone") ? "ios" : "android",
      "User-Agent": user_agent,
    },
    body: JSON.stringify({
      startData: INIT_DATA,
    }),
  });

  if (!r.ok) {
    console.log(`❌Auth ERR, status - ${r.status}, response:\n"${await r.text()}"`);
    process.exit(1);
  }

  console.log("✅Auth OK");
  jb = await r.json();
  cookies = r.headers.get("Set-Cookie");

  coinsPerTap = jb["user"]["coinsPerTap"];
  currentEnergy = jb["user"]["currentEnergy"];
  currentCoins = jb["user"]["currentCoins"];

  ENERGY_REFILL_TIME = Math.ceil(jb["user"]["maxEnergy"] / jb["user"]["energyPerSec"]);

  if (!jb["user"]["dailyReward"]["claimed"]) {
    let headers: Record<string, string> = {
      TGPlatform: user_agent.includes("iPhone") ? "ios" : "android",
      "User-Agent": user_agent,
    };

    if (cookies) {
      headers.Cookie = cookies;
    }

    let dr = await fetch("https://qlyuker.io/api/tasks/daily", {
      method: "POST",
      headers: headers,
    });
    if (dr.ok) {
      console.log(`⭐️Claimed day #${jb["user"]["dailyReward"]["day"]} daily reward (+${jb["sharedConfig"]["dailyCalendar"][jb["user"]["dailyReward"]["day"]]["reward"]} seeds)`);
    } else {
      console.log("❌Failed to claim the daily reward");
    }
  } else {
    console.log("😌Daily reward is already claimed");
  }
}
await auth();

console.log(`🧓User: ${jb?.["user"]?.["firstName"] ?? ""} ${jb?.["user"]?.["lastName"] ?? ""}`);
console.log(`💰Seeds: ${Math.floor(jb?.["user"]?.["currentCoins"] ?? 0)}`);
console.log(`⚡️Energy: ${Math.floor(jb?.["user"]?.["currentEnergy"] ?? 0)}/${jb?.["user"]?.["maxEnergy"] ?? 0}\n`);

async function mainLoop() {
  let taps = Math.floor(TAPS_PER_SYNC + (Math.random() - 0.5) * 2 * RAND_THRESHOLD * TAPS_PER_SYNC);
  let r = await fetch("https://qlyuker.io/api/game/sync", {
    method: "POST",
    headers: {
      ...(cookies && { Cookie: cookies }),
      TGPlatform: user_agent.includes("iPhone") ? "ios" : "android",
      "User-Agent": user_agent,
    },
    body: JSON.stringify({
      currentEnergy: currentEnergy,
      clientTime: Math.floor(Date.now() / 1000),
      taps: taps,
    }),
  });

  if (r.ok) {
    let jb = await r.json();
    currentEnergy = jb["currentEnergy"];
    console.log(`🐦+${taps} taps | 💰${Math.floor(jb["currentCoins"])} seeds | ⚡️Energy: ${Math.floor(currentEnergy)}`);
    if (currentEnergy == 0) {
      clearInterval(intId);
      setTimeout(() => {
        intId = setInterval(mainLoop, DELAY);
      }, ENERGY_REFILL_TIME * 1000);
      console.log(`⏳Ran out of energy, waiting for ${humanizeTime(ENERGY_REFILL_TIME)} to restart ...`);
      return;
    }
    currentCoins = jb["currentCoins"];
  } else {
    console.log(`❌Error, status - ${r.status}, response:\n"${await r.text()}"`);
  }
}

let intId = setInterval(mainLoop, DELAY);
setInterval(auth, 1000 * 60 * 60);