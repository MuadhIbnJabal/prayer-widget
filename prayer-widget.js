
const PRAYER_CSV_URL = "prayers.csv";

let allData = [];
let prayers = [];
let jumuahTime = "";
let selectedDate = "";
let countdownInterval = null;
let highlightInterval = null;

/* ---------------- LOAD CSV ---------------- */

async function loadPrayers() {
  try {
    const res = await fetch(PRAYER_CSV_URL);

    if (!res.ok) {
      throw new Error(`Could not load prayers.csv: ${res.status}`);
    }

    const text = await res.text();
    allData = parseCSV(text);

    if (!allData.length) {
      console.error("No prayer data found in CSV.");
      return;
    }

    // Use the user's local date, not UTC.
    selectedDate = getLocalDate(new Date());
    renderSelectedDate();

  } catch (err) {
    console.error("Failed to load CSV:", err);
  }
}

/* ---------------- CSV PARSER ---------------- */

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/);

  return rows.slice(1).map(row => {
    const values = row.split(",").map(value => value.trim());

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
  }).filter(row => row.date);
}

/* ---------------- LOCAL DATE HELPERS ---------------- */

function getLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftDate(amount) {
  const date = new Date(`${selectedDate}T12:00:00`);
  date.setDate(date.getDate() + amount);

  const newDate = getLocalDate(date);
  const firstDate = allData[0].date;
  const lastDate = allData[allData.length - 1].date;

  // Do not navigate beyond the dates available in the CSV.
  if (newDate < firstDate || newDate > lastDate) {
    return;
  }

  selectedDate = newDate;
  renderSelectedDate();
}

function isToday(dateString) {
  return dateString === getLocalDate(new Date());
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

/* ---------------- SHOW SELECTED DATE ---------------- */

function renderSelectedDate() {
  // Stop the previous day's timers before rebuilding the widget.
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (highlightInterval) {
    clearInterval(highlightInterval);
    highlightInterval = null;
  }

  const dayData = allData.find(row => row.date === selectedDate);

  if (!dayData) {
    console.error(`No prayer data found for ${selectedDate}.`);
    return;
  }

  prayers = buildPrayers(dayData);
  jumuahTime = dayData.jumuah || "N/A";

  renderWidget();

  // The live countdown and highlighting are for TODAY only.
  if (isToday(selectedDate)) {
    initLogic();
  }
}

/* ---------------- RENDER UI ---------------- */

function renderWidget() {
  const container = document.getElementById("prayer-widget");
  const todaySelected = isToday(selectedDate);

  const firstDate = allData[0].date;
  const lastDate = allData[allData.length - 1].date;

  container.innerHTML = `
    <div class="prayer-widget">

      <div class="date-section">
        <button
          class="date-arrow"
          id="previous-date"
          type="button"
          aria-label="Previous day"
          ${selectedDate <= firstDate ? "disabled" : ""}
        >&#8249;</button>

        <div class="gregorian"></div>

        <button
          class="date-arrow"
          id="next-date"
          type="button"
          aria-label="Next day"
          ${selectedDate >= lastDate ? "disabled" : ""}
        >&#8250;</button>
      </div>

      ${
        todaySelected
          ? `
            <div class="countdown-box">
              <div class="countdown-title"></div>
              <div class="countdown-time" id="countdown"></div>

              <div class="countdown-labels">
                <span>HOURS</span>
                <span>MINUTES</span>
                <span>SECONDS</span>
              </div>
            </div>
          `
          : `
            <div class="masjid-brand-box">
              <div class="masjid-brand-name">
                Masjid Mu’adh Ibn Jabal
              </div>

              <div class="brand-divider"></div>

              <div class="masjid-brand-subtitle">
                JAMA'AH TIMES
              </div>
            </div>
          `
      }

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

  document.getElementById("previous-date").addEventListener("click", () => {
    shiftDate(-1);
  });

  document.getElementById("next-date").addEventListener("click", () => {
    shiftDate(1);
  });
}

/* ---------------- DATE DISPLAY ---------------- */

function renderDate() {
  // Parse at midday to avoid date shifts around daylight-saving changes.
  const date = new Date(`${selectedDate}T12:00:00`);

  const gregorian = date.toLocaleDateString("en-GB", {
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
    if (!prayers.length || !document.getElementById("countdown")) return;

    const now = new Date();
    let nextPrayer = null;

    for (const p of prayers) {
      // Skip Sunrise completely.
      if (p.name === "SUNRISE") continue;

      // Friday: replace Zuhr with Jumu'ah.
      if (now.getDay() === 5 && p.name === "ZUHR") {
        const [jh, jm] = jumuahTime.split(":");
        const jumuahDate = new Date();

        jumuahDate.setHours(Number(jh), Number(jm), 0, 0);

        if (jumuahDate > now) {
          nextPrayer = {
            name: "JUMU'AH",
            date: jumuahDate
          };
          break;
        }

        // Jumu'ah has passed; move on to Asr.
        continue;
      }

      const [h, m] = p.time.split(":");
      const prayerDate = new Date();

      prayerDate.setHours(Number(h), Number(m), 0, 0);

      if (prayerDate > now) {
        nextPrayer = {
          name: p.name,
          date: prayerDate
        };
        break;
      }
    }

    // After Isha, count down to tomorrow's Fajr.
    if (!nextPrayer) {
      const fajr = prayers.find(p => p.name === "FAJR");

      if (!fajr) return;

      const [h, m] = fajr.time.split(":");
      const tomorrow = new Date();

      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(Number(h), Number(m), 0, 0);

      nextPrayer = {
        name: "FAJR",
        date: tomorrow
      };
    }

    const diff = nextPrayer.date - now;

    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    document.getElementById("countdown").textContent =
      `${String(hrs).padStart(2, "0")} : ${String(mins).padStart(2, "0")} : ${String(secs).padStart(2, "0")}`;

    document.querySelector(".countdown-title").textContent =
      `NEXT PRAYER: ${nextPrayer.name}`;
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

/* ---------------- HIGHLIGHT NEXT PRAYER ---------------- */

function highlightCurrentPrayer() {
  function update() {
    const now = new Date();
    let nextPrayer = null;

    for (const p of prayers) {
      // Skip Sunrise completely.
      if (p.name === "SUNRISE") continue;

      // Friday: replace Zuhr with Jumu'ah.
      if (now.getDay() === 5 && p.name === "ZUHR") {
        const [jh, jm] = jumuahTime.split(":");
        const jumuahDate = new Date();

        jumuahDate.setHours(Number(jh), Number(jm), 0, 0);

        if (jumuahDate > now) {
          nextPrayer = "JUMUAH";
          break;
        }

        continue;
      }

      const [h, m] = p.time.split(":");
      const prayerDate = new Date();

      prayerDate.setHours(Number(h), Number(m), 0, 0);

      if (prayerDate > now) {
        nextPrayer = p.name;
        break;
      }
    }

    // After Isha, highlight Fajr.
    if (!nextPrayer) {
      nextPrayer = "FAJR";
    }

    document.querySelectorAll(".prayer-card, .jummah-box").forEach(element => {
      element.classList.remove("active");

      if (element.dataset.prayer === nextPrayer) {
        element.classList.add("active");
      }
    });
  }

  update();
  highlightInterval = setInterval(update, 1000);
}

/* ---------------- INIT ---------------- */

function initLogic() {
  startCountdown();
  highlightCurrentPrayer();
}

/* ---------------- START ---------------- */

loadPrayers();
