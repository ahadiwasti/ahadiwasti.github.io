const toggle = document.getElementById("themeToggle");
const icon = document.getElementById("themeIcon");

const SUN = `<circle cx="12" cy="12" r="4" stroke="#1D9E75" stroke-width="2" fill="none"/><path stroke="#1D9E75" stroke-width="2" stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>`;
const MOON = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" fill="currentColor"/>`;

function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add("light");
    icon.innerHTML = MOON;
    toggle.style.color = "var(--accent)";
  } else {
    document.body.classList.remove("light");
    icon.innerHTML = SUN;
    toggle.style.color = "";
  }
}

// Load saved theme
const saved = localStorage.getItem("theme");
applyTheme(saved === "light");

toggle.addEventListener("click", () => {
  const isLight = !document.body.classList.contains("light");
  applyTheme(isLight);
  localStorage.setItem("theme", isLight ? "light" : "dark");
});

// Back to top
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    backToTop.classList.add("visible");
  } else {
    backToTop.classList.remove("visible");
  }
});

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});