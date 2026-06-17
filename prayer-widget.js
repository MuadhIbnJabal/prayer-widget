const PRAYER_CSV_URL = "prayers.csv";

let allData = [];
let prayers = [];
let jumuahTime = "";
let countdownInterval = null;
let highlightInterval = null;

/* ---------------- LOAD CSV ---------------- */

async function loadPrayers() {
  try {
    const res = await fetch(PRAYER_CSV_URL);
    const text = await res.text();

    allData = parseCSV(text);

    const todayData = getTodayData(allData);

    if (!todayData) {
      console.error("No prayer data found for today.");
      return;
    }

    prayers = buildPrayers(todayData);
    jumuahTime = todayData.jumuah || "N/A";

    renderWidget();
    initLogic();

  } catch (err) {
    console.error("Failed to load CSV:", err);
  }
}

/* ---------------- CSV PARSER ---------------- */

function parseCSV(text) {
  const rows = text.trim().split("\n");

  return rows.slice(1).map(row => {
    const values = row.split(",");

    return {
      date: values[0],
      fajr: values[1],
      sunrise: values[2],
      zuhr: values[3],
      asr: values[4],
      maghrib: values[5],
      isha: values[6],
      jumuah: values[7]
    };
  });
}

/* ---------------- GET TODAY ---------------- */

function getTodayData(data) {
  const today = new Date().toISOString().split("T")[0];
  return data.find(row => row.date === today);
}

/* ---------------- BUILD PRAYERS ---------------- */

function buildPrayers(day) {
  return [
    { name: "FAJR", time: day.fajr },
    { name: "SUNRISE", time: day.sunrise },
    { name: "ZUHR", time: day.zuhr },
    { name: "ASR", time: day.asr },
    { name: "MAGHRIB", time: day.maghrib },
    { name: "ISHA", time: day.isha }
  ];
}

/* ---------------- RENDER UI ---------------- */

function renderWidget() {
  const container = document.getElementById("prayer-widget");

  container.innerHTML = `
    <div class="prayer-widget">

      <div class="date-section">
        <div class="gregorian"></div>
      </div>

      <div class="countdown-box">
        <div class="countdown-title"></div>
        <div class="countdown-time" id="countdown"></div>

        <div class="countdown-labels">
          <span>HOURS</span>
          <span>MINUTES</span>
          <span>SECONDS</span>
        </div>
      </div>

      <div class="prayers-grid">
        ${prayers.map(p => `
          <div class="prayer-card" data-prayer="${p.name}">
            <div class="prayer-name">${p.name}</div>
            <div class="prayer-time">${p.time}</div>
          </div>
        `).join("")}
      </div>

      <div class="jummah-box" data-prayer="JUMUAH">
  JUMU'AH &nbsp;&nbsp; ${jumuahTime}
</div>

    </div>
  `;

  renderDate();
}

/* ---------------- DATE ---------------- */

function renderDate() {
  const now = new Date();

  const gregorian = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  document.querySelector(".gregorian").textContent = gregorian;
}


/* ---------------- COUNTDOWN ---------------- */

function startCountdown() {

  function update() {

    if (!prayers.length) return;

    const now = new Date();
    let nextPrayer = null;

    for (const p of prayers) {

      // Skip Sunrise completely
      if (p.name === "SUNRISE") continue;

      // Friday: replace Zuhr with Jumu'ah
      if (
        now.getDay() === 5 &&
        p.name === "ZUHR"
      ) {

        const [jh, jm] =
          jumuahTime.split(":");

        const jumuahDate =
          new Date();

        jumuahDate.setHours(
          Number(jh),
          Number(jm),
          0,
          0
        );

        if (jumuahDate > now) {

          nextPrayer = {
            name: "JUMU'AH",
            date: jumuahDate
          };

          break;
        }

        // Jumu'ah has passed,
        // move on to Asr
        continue;
      }

      const [h, m] =
        p.time.split(":");

      const prayerDate =
        new Date();

      prayerDate.setHours(
        Number(h),
        Number(m),
        0,
        0
      );

      if (prayerDate > now) {

        nextPrayer = {
          name: p.name,
          date: prayerDate
        };

        break;
      }
    }

    // After Isha -> tomorrow's Fajr
    if (!nextPrayer) {

      const fajr =
        prayers.find(
          p => p.name === "FAJR"
        );

      const [h, m] =
        fajr.time.split(":");

      const tomorrow =
        new Date();

      tomorrow.setDate(
        tomorrow.getDate() + 1
      );

      tomorrow.setHours(
        Number(h),
        Number(m),
        0,
        0
      );

      nextPrayer = {
        name: "FAJR",
        date: tomorrow
      };
    }

    const diff =
      nextPrayer.date - now;

    const hrs = Math.floor(
      diff / 3600000
    );

    const mins = Math.floor(
      (diff % 3600000) / 60000
    );

    const secs = Math.floor(
      (diff % 60000) / 1000
    );

    document.getElementById(
      "countdown"
    ).textContent =
      `${String(hrs).padStart(2,"0")} : ${String(mins).padStart(2,"0")} : ${String(secs).padStart(2,"0")}`;

    document.querySelector(
      ".countdown-title"
    ).textContent =
      `NEXT PRAYER: ${nextPrayer.name}`;
  }

  update();

  countdownInterval =
    setInterval(update, 1000);
}


/* ---------------- HIGHLIGHT NEXT PRAYER ---------------- */

function highlightCurrentPrayer() {

  function update() {

    const now = new Date();
    let nextPrayer = null;

    for (const p of prayers) {

      // Skip Sunrise completely
      if (p.name === "SUNRISE") continue;

      // Friday: replace Zuhr with Jumu'ah
      if (
        now.getDay() === 5 &&
        p.name === "ZUHR"
      ) {

        const [jh, jm] =
          jumuahTime.split(":");

        const jumuahDate =
          new Date();

        jumuahDate.setHours(
          Number(jh),
          Number(jm),
          0,
          0
        );

        if (jumuahDate > now) {

          nextPrayer = "JUMUAH";
          break;
        }

        // Jumu'ah has passed,
        // move on to Asr
        continue;
      }

      const [h, m] =
        p.time.split(":");

      const prayerDate =
        new Date();

      prayerDate.setHours(
        Number(h),
        Number(m),
        0,
        0
      );

      if (prayerDate > now) {

        nextPrayer = p.name;
        break;
      }
    }

    // After Isha -> highlight Fajr
    if (!nextPrayer) {
      nextPrayer = "FAJR";
    }

    document
      .querySelectorAll(
        ".prayer-card, .jummah-box"
      )
      .forEach(element => {

        element.classList.remove("active");

        if (
          element.dataset.prayer ===
          nextPrayer
        ) {
          element.classList.add("active");
        }

      });
  }

  update();

  highlightInterval =
    setInterval(update, 1000);
}

/* ---------------- INIT ---------------- */

function initLogic() {
  startCountdown();
  highlightCurrentPrayer();
}

/* ---------------- START ---------------- */

loadPrayers();
