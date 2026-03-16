const GUAP_SCHEDULE = window.GUAP_3513_SCHEDULE;
const COLLEGE_SCHEDULE = window.SPHU_KO_3333_SCHEDULE;

const dayNames = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
};

const pairDefaultTimes = {
  1: "09:00–10:30",
  2: "10:40–12:10",
  3: "12:20–13:50",
  4: "14:30–16:00",
  5: "16:10–17:40",
  6: "17:50–19:20",
};

function getCurrentWeekType() {
  // На сайте ГУАП текущая неделя указана явно.
  // Здесь используем простую эвристику: считаем недели от 1 сентября.
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const semesterStart = new Date(year, 8, 1); // 1 сентября
  const diffMs = now - semesterStart;
  const weekNumber = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return weekNumber % 2 === 1 ? "odd" : "even";
}

function formatRussianDate(date) {
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const currentDateEl = document.getElementById("current-date");
  const weekTypeBadge = document.getElementById("week-type-badge");
  const weekLabel = document.getElementById("week-label");
  const dayTitle = document.getElementById("day-title");
  const lessonsContainer = document.getElementById("lessons-container");
  const emptyState = document.getElementById("empty-state");
  const lessonTemplate = document.getElementById("lesson-template");
  const todayBtn = document.getElementById("today-btn");
  const meetupInfo = document.getElementById("meetup-info");
  const meetupText = document.getElementById("meetup-text");
  const weekField = document.getElementById("week-field");

  const weekButtons = Array.from(
    document.querySelectorAll('.segmented-btn[data-week]'),
  );
  const groupSwitch = document.getElementById("group-switch");
  const groupButtons = groupSwitch
    ? Array.from(groupSwitch.querySelectorAll(".segmented-btn"))
    : [];
  const dayButtons = Array.from(document.querySelectorAll(".day-btn"));

  const today = new Date();
  const todayWeekDay = (() => {
    const jsDay = today.getDay(); // 0=Вс ... 6=Сб
    if (jsDay === 0) return 1; // воскресенье считаем как понедельник
    return Math.min(jsDay, 6);
  })();

  let selectedWeekMode = "auto"; // auto | odd | even
  let selectedDay = todayWeekDay;
  let selectedGroup = "guap"; // "guap" | "college"

  const currentWeekType = getCurrentWeekType();

  function getActiveSchedule() {
    return selectedGroup === "college" ? COLLEGE_SCHEDULE : GUAP_SCHEDULE;
  }

  function resolveWeekType() {
    if (selectedWeekMode === "auto") return currentWeekType;
    return selectedWeekMode;
  }

  function updateHeader() {
    const weekType = resolveWeekType();
    const activeSchedule = getActiveSchedule();
    if (selectedGroup === "college") {
      weekTypeBadge.textContent = "СПХФУ";
      weekLabel.textContent = `Группа ${activeSchedule.meta.group} (без деления по неделям)`;
    } else {
      const weekLabelText =
        weekType === "odd" ? "Нечётная неделя" : "Чётная неделя";
      weekTypeBadge.textContent =
        (selectedWeekMode === "auto" ? "Текущая: " : "") + weekLabelText;
      weekLabel.textContent = `${weekLabelText}, группа ${activeSchedule.meta.group}`;
    }
    dayTitle.textContent = dayNames[selectedDay] || "";
    currentDateEl.textContent = formatRussianDate(today);
  }

  function parseEndTime(timeStr, pair) {
    const base = timeStr || pairDefaultTimes[pair];
    if (!base) return null;
    const parts = base.split("–");
    if (parts.length !== 2) return null;
    const [h, m] = parts[1].split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function findLastEndTime(schedule, weekType, day) {
    // Для СПХФУ считаем чётную неделю такой же, как нечётную
    const effectiveWeekType =
      schedule === COLLEGE_SCHEDULE && weekType === "even" ? "odd" : weekType;
    const weekData =
      (schedule.weeks && schedule.weeks[effectiveWeekType]) || {};
    const dayLessons = weekData[day] || [];
    if (!dayLessons.length) return null;
    let maxEnd = null;
    dayLessons.forEach((lesson) => {
      const end = parseEndTime(lesson.time, lesson.pair);
      if (end != null && (maxEnd == null || end > maxEnd)) {
        maxEnd = end;
      }
    });
    return maxEnd;
  }

  function formatMinutes(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function updateMeetupInfo() {
    const weekType = resolveWeekType();
    const guapEnd = findLastEndTime(GUAP_SCHEDULE, weekType, selectedDay);
    const collegeEnd = findLastEndTime(COLLEGE_SCHEDULE, weekType, selectedDay);

    if (guapEnd == null && collegeEnd == null) {
      meetupInfo.classList.remove("hidden");
      meetupText.textContent = "У обеих групп в этот день нет пар — вы свободны весь день.";
      return;
    }

    if (guapEnd == null || collegeEnd == null) {
      meetupInfo.classList.remove("hidden");
      const groupWithNoClasses =
        guapEnd == null ? "ГУАП 3513" : "СПХФУ КО‑3333";
      const lastEnd = guapEnd != null ? guapEnd : collegeEnd;
      meetupText.textContent = `${groupWithNoClasses} в этот день без пар, вторая группа заканчивает в ${formatMinutes(lastEnd)} — с этого времени можно встречаться.`;
      return;
    }

    const meetupFrom = Math.max(guapEnd, collegeEnd);
    meetupInfo.classList.remove("hidden");
    meetupText.textContent = `Обе группы свободны после ${formatMinutes(meetupFrom)}.`;
  }

  function renderLessons() {
    const weekType = resolveWeekType();
    const activeSchedule = getActiveSchedule();
    const effectiveWeekType =
      activeSchedule === COLLEGE_SCHEDULE && weekType === "even"
        ? "odd"
        : weekType;
    const weekData =
      (activeSchedule.weeks && activeSchedule.weeks[effectiveWeekType]) || {};
    const dayLessons = weekData[selectedDay] || [];

    lessonsContainer.innerHTML = "";

    if (!dayLessons.length) {
      emptyState.classList.remove("hidden");
      updateMeetupInfo();
      return;
    }

    emptyState.classList.add("hidden");

    dayLessons
      .slice()
      .sort((a, b) => (a.pair || 0) - (b.pair || 0))
      .forEach((lesson) => {
        const node = lessonTemplate.content.cloneNode(true);
        const pairNumberEl = node.querySelector(".pair-number");
        const timeRangeEl = node.querySelector(".time-range");
        const nameEl = node.querySelector(".lesson-name");
        const typeEl = node.querySelector(".lesson-type");
        const teacherEl = node.querySelector(".lesson-teacher");
        const buildingEl = node.querySelector(".lesson-building");
        const roomEl = node.querySelector(".lesson-room");
        const formatEl = node.querySelector(".lesson-format");
        const commentEl = node.querySelector(".lesson-comment");

        pairNumberEl.textContent = `${lesson.pair || "—"} пара`;
        timeRangeEl.textContent =
          lesson.time || pairDefaultTimes[lesson.pair] || "";
        nameEl.textContent = lesson.name || "Дисциплина";
        typeEl.textContent = lesson.type || "";
        teacherEl.textContent = lesson.teacher || "";
        buildingEl.textContent = lesson.building || "";
        roomEl.textContent = lesson.room || "";
        formatEl.textContent = lesson.format || "";

        if (lesson.comment) {
          commentEl.textContent = lesson.comment;
          commentEl.style.display = "block";
        } else {
          commentEl.style.display = "none";
        }

        lessonsContainer.appendChild(node);
      });

    updateMeetupInfo();
  }

  weekButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      weekButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedWeekMode = btn.dataset.week;
      updateHeader();
      renderLessons();
    });
  });

  groupButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      groupButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedGroup = btn.dataset.group;
      if (weekField) {
        if (selectedGroup === "college") {
          weekField.classList.add("hidden");
        } else {
          weekField.classList.remove("hidden");
        }
      }
      updateHeader();
      renderLessons();
    });
  });

  dayButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      dayButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedDay = Number(btn.dataset.day);
      updateHeader();
      renderLessons();
    });
  });

  todayBtn.addEventListener("click", () => {
    const todayBtnForDay = dayButtons.find(
      (b) => Number(b.dataset.day) === todayWeekDay,
    );
    if (todayBtnForDay) {
      todayBtnForDay.click();
    }
    const autoBtn = weekButtons.find((b) => b.dataset.week === "auto");
    if (autoBtn) {
      autoBtn.click();
    }
  });

  updateHeader();
  renderLessons();
});

