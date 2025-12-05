const API_KEY = "af711887a7ce95136044c8e17a621335"; 

// DOM elements
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const tempToggle = document.getElementById("tempToggle");
const unitLabel = document.getElementById("unitLabel");
const cityName = document.getElementById("cityName");
const timeLocal = document.getElementById("timeLocal");
const tempValue = document.getElementById("tempValue");
const weatherDesc = document.getElementById("weatherDesc");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const sunTimesEl = document.getElementById("sunTimes");
const weatherCanvas = document.getElementById("weatherCanvas");
const weatherIcon = document.getElementById("weatherIcon");
const recentList = document.getElementById("recentList");
const forecastList = document.getElementById("forecastList");
const hourlyContainer = document.getElementById("hourlyTemps"); 
const adviceEl = document.getElementById("weatherAdvice");

// State
let currentWeather = null;
let lastForecast = null; // Store forecast globally to persist during unit toggle
let currentLocalClockInterval = null;
let useCelsius = true;

// Recent searches (localStorage)
const RECENT_KEY = "recent_weather";

function loadRecent() {
  const raw = localStorage.getItem(RECENT_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveRecent(city) {
  let arr = loadRecent();
  arr = arr.filter((c) => c.toLowerCase() !== city.toLowerCase());
  arr.unshift(city);
  if (arr.length > 5) arr.pop();
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  renderRecent();
}

function renderRecent() {
  recentList.innerHTML = "";
  loadRecent().forEach((city) => {
    const btn = document.createElement("button");
    btn.textContent = city;
    btn.addEventListener("click", () => fetchWeather(city));
    recentList.appendChild(btn);
  });
}
renderRecent();

function getAdvice(condition, temp, isNight) {
  condition = condition.toLowerCase();
  
  if (condition.includes("rain") || condition.includes("drizzle")) {
      return "Don't forget your umbrella! ☔ It's a wet one today.";
  }
  
  if (condition.includes("thunder")) {
      return "Stormy weather alert! ⚡ Best to stay indoors if you can.";
  }
  
  if (condition.includes("snow")) {
      return "It's freezing! ❄️ Wear a heavy coat, gloves, and a scarf.";
  }
  
  if (temp > 30) {
      return "It's scorching hot! 🥵 Stay hydrated and wear sunscreen.";
  }
  
  if (temp < 10) {
      return "It's quite cold. 🧣 A thick jacket is recommended.";
  }
  
  if (condition.includes("clear")) {
      return isNight 
          ? "Clear skies tonight. 🌌 Perfect for stargazing!" 
          : "It's a beautiful sunny day! 😎 Enjoy the sunshine.";
  }

  if (condition.includes("cloud")) {
      return "It's a bit gloomy/cloudy. ☁️ A light jacket might be good.";
  }
  return "Have a wonderful day! 😊";
}

// Helpers C to F
function cToF(c) {
  return (c * 9) / 5 + 32;
}

function formatTemp(v) {
  return Math.round(v) + (useCelsius ? "°C" : "°F");
}

function getAQIDescription(aqi) {
  switch (aqi) {
    case 1: return "Good 😊";
    case 2: return "Fair 🙂";
    case 3: return "Moderate 😐";
    case 4: return "Poor 😷";
    case 5: return "Very Poor 🚫";
    default: return "Unknown";
  }
}

// Time & Date Logic
function getLocalDateTime(timezoneOffsetSeconds) {
  const targetInstant = new Date(Date.now() + (new Date().getTimezoneOffset() * 60000) + (timezoneOffsetSeconds * 1000));
  
  const dateStr = targetInstant.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
  
  const timeStr = targetInstant.toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  
  return `${dateStr} • ${timeStr}`;
}

function displayTimeFromUnix(unix, timezoneOffsetSeconds) {
    // JS Date automatically converts to local browser time.
    // The easiest way to show "City Time" is to use UTC methods + offset.
    const date = new Date((unix + timezoneOffsetSeconds) * 1000);
    // 2. Format using UTC to prevent browser from adding its own timezone again
    return date.toLocaleTimeString("en-US", { 
      timeZone: "UTC", 
      hour: '2-digit', 
      minute: '2-digit' 
  });
}

// Icons & Animations
function conditionToClass(main, id, isNight = false) {
  main = (main || "").toLowerCase();
  if (main.includes("rain") || main.includes("drizzle")) return "rain";
  if (main.includes("snow")) return "snow";
  if (main.includes("thunder")) return "thunder";
  if (main.includes("smoke") || main.includes("haze") || main.includes("mist")) return "smoke";
  if (main.includes("cloud")) return "clouds";
  if (main.includes("clear")) return isNight ? "night" : "sunny";
  return "clouds";
}

function createIconSVG(main, isNight = false) {
    main = (main || "").toLowerCase();
    const stroke = `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;
    
    if (main.includes("rain")) 
        return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" ${stroke}><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7H17A5 5 0 0 0 7 8"/></svg>`;
    
    if (main.includes("snow")) 
        return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" ${stroke}><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/></svg>`;
    
    if (main.includes("thunder")) 
        return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" ${stroke}><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><path d="M13 11l-4 6h6l-4 6"/></svg>`;
        
    if (main.includes("cloud")) 
        return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" ${stroke}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
    
    if (main.includes("clear") && isNight) 
        return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" ${stroke}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    
    // Sunny/Default
    return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" ${stroke}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
}

// Animation Renderer
function clearAnimations() {
  weatherCanvas.className = "weather-canvas";
  weatherCanvas.innerHTML = '<div class="sky-overlay"></div>';
}

function renderAnimationsFor(conditionClass) {
  clearAnimations();
  weatherCanvas.classList.add(conditionClass);
  const container = weatherCanvas;

  //  SUNNY
  if (conditionClass === "sunny") {
    container.innerHTML += `
        <div class="sun"></div>
        <div class="cloud small"></div>
        <div class="cloud med"></div>
    `;
  } 
  //  CLOUDS
  else if (conditionClass === "clouds") {
    container.innerHTML += `
        <div class="cloud big"></div>
        <div class="cloud med" style="top:20%"></div>
        <div class="cloud small" style="top:40%"></div>
    `;
  } 
  //  RAIN
  else if (conditionClass === "rain") {
    container.innerHTML += `<div class="cloud big"></div>`;
    // Create 40 rain drops
    for(let i=0; i<40; i++) {
        const drop = document.createElement("div");
        drop.className="drop";
        drop.style.left = Math.random()*100 + "%";
        drop.style.animationDuration = (0.5 + Math.random()) + "s";
        drop.style.animationDelay = Math.random() + "s";
        container.appendChild(drop);
    }
  } 
  //  SNOW
  else if (conditionClass === "snow") {
    container.innerHTML += `<div class="cloud med"></div>`;
    // Create 60 snowflakes
    for(let i=0; i<60; i++) {
        const flake = document.createElement("div");
        flake.className = "snowflake";
        flake.style.left = Math.random() * 100 + "%";
        flake.style.animationDuration = (3 + Math.random() * 5) + "s"; // Slower fall
        flake.style.animationDelay = Math.random() + "s";
        flake.style.opacity = Math.random();
        container.appendChild(flake);
    }
  }
  else if (conditionClass === "smoke") {
    container.innerHTML += `<div class="haze-layer"></div>`;
  } 
  //  THUNDER
  else if (conditionClass === "thunder") {
    container.innerHTML += `<div class="cloud big"></div>`;
    // Rain drops for storm
    for(let i=0; i<50; i++) {
        const drop = document.createElement("div");
        drop.className="drop";
        drop.style.left = Math.random()*100 + "%";
        drop.style.animationDuration = (0.5 + Math.random()) + "s";
        container.appendChild(drop);
    }
  } 
  //  NIGHT / CLEAR
  else if (conditionClass === "night") {
    const stars = document.createElement("div");
    stars.className = "stars";
    for(let i=0; i<50; i++) {
        const s = document.createElement("div");
        s.className = "star";
        s.style.top = Math.random()*100 + "%";
        s.style.left = Math.random()*100 + "%";
        s.style.animationDelay = Math.random()*3 + "s";
        stars.appendChild(s);
    }
    container.appendChild(stars);
    container.innerHTML += `<div class="moon"></div>`;
  }
}

// Data Fetching
async function fetchWeather(city) {
  if (!city) return;
  cityName.textContent = "Loading...";
  
  try {
    // Current Weather
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`);
    const data = await res.json();
    
    if (data.cod !== 200) {
      cityName.textContent = "City not found 😔";
      resetUI();
      return;
    }
    currentWeather = data;

    // Forecast
    const foreRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`);
    const foreData = await foreRes.json();
    lastForecast = foreData; // Save to global state

    updateUI(currentWeather, lastForecast);
    saveRecent(city);

  } catch (err) {
    console.error(err);
    cityName.textContent = "Error fetching data";
  }
}

// resetUI
function resetUI() {

  const adviceEl = document.getElementById("weatherAdvice");
  if (adviceEl) adviceEl.textContent = "—";
  
  cityName.textContent = "City not found 😔"; 
  timeLocal.textContent = "—";
  tempValue.textContent = "--";
  weatherDesc.textContent = "—";

  humidityEl.textContent = "--";
  windEl.textContent = "--";
  sunTimesEl.textContent = "-- / --";

  const aqiEl = document.getElementById("aqi");
  if (aqiEl) {
      aqiEl.textContent = "--";
      aqiEl.style.color = "inherit";
  }

  forecastList.innerHTML = "";
  hourlyContainer.innerHTML = "";
  weatherIcon.innerHTML = "";

  if (currentLocalClockInterval) {
      clearInterval(currentLocalClockInterval);
      currentLocalClockInterval = null;
  }

  clearAnimations(); 
}

// Update UI
function updateUI(current, forecastRaw) {
  // Use global forecast if argument is null (occurs during Unit Toggle)
  if (!forecastRaw && lastForecast) forecastRaw = lastForecast;

  //  Basic Info
  cityName.textContent = `${current.name}, ${current.sys.country}`;
  
  // Clock Interval
  if (currentLocalClockInterval) clearInterval(currentLocalClockInterval);
  timeLocal.textContent = getLocalDateTime(current.timezone);
  currentLocalClockInterval = setInterval(() => {
    timeLocal.textContent = getLocalDateTime(current.timezone);
  }, 1000);

  //  Main Weather Stats
  weatherDesc.textContent = current.weather[0].description;
  humidityEl.textContent = current.main.humidity + "%";
  windEl.textContent = current.wind.speed.toFixed(1);
  
  // AQI
  const { lat, lon } = current.coord;
  fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    .then(r => r.json())
    .then(d => {
        if(d.list && d.list[0]) {
            const val = d.list[0].main.aqi;
            document.getElementById("aqi").textContent = getAQIDescription(val);
        }
    });

  sunTimesEl.textContent = `${displayTimeFromUnix(current.sys.sunrise, current.timezone)} / ${displayTimeFromUnix(current.sys.sunset, current.timezone)}`;

  // Temperature Display
  let tempC = current.main.temp;
  let displayTemp = useCelsius ? tempC : cToF(tempC);
  tempValue.textContent = formatTemp(displayTemp);

  // Icons & Background
  const isNight = (Date.now()/1000 > current.sys.sunset || Date.now()/1000 < current.sys.sunrise);

  // Smart Advice (Now safe because isNight exists)
  if (adviceEl) {
    const cond = current.weather[0].main;
    const t = current.main.temp;
    adviceEl.textContent = getAdvice(cond, t, isNight);
  }

  weatherIcon.innerHTML = createIconSVG(current.weather[0].main, isNight);
  const animClass = conditionToClass(current.weather[0].main, current.weather[0].id, isNight);
  renderAnimationsFor(animClass);

  // Daily Forecast (Processing 6 days)
  if (forecastRaw && forecastRaw.list) {
    const byDay = {};
    forecastRaw.list.forEach(entry => {
        const d = new Date(entry.dt * 1000);
        const dayName = d.toLocaleDateString("en-US", { weekday: 'short' });
        if(!byDay[dayName]) byDay[dayName] = [];
        byDay[dayName].push(entry);
    });

    forecastList.innerHTML = "";
    Object.keys(byDay).slice(0, 6).forEach(day => {
        const entries = byDay[day];
        // Calculate avg temp for the day
        const avgTemp = entries.reduce((sum, e) => sum + e.main.temp, 0) / entries.length;
        const iconMain = entries[Math.floor(entries.length/2)].weather[0].main;
        
        const el = document.createElement("div");
        el.className = "forecast-item";
        el.innerHTML = `
            <strong>${day}</strong>
            <div>${formatTemp(useCelsius ? avgTemp : cToF(avgTemp))}</div>
            <small class="muted">${iconMain}</small>
        `;
        forecastList.appendChild(el);
    });

    // Hourly Forecast (Logic Fixed: Next 24 Hours)
    // The API returns data every 3 hours. We take the next 8 items (8*3 = 24h)
    const next24h = forecastRaw.list.slice(0, 8); 
    
    hourlyContainer.innerHTML = "";
    next24h.forEach(entry => {
        const d = new Date(entry.dt * 1000);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const temp = entry.main.temp;
        
        const item = document.createElement("div");
        item.className = "hourly-item";
        item.innerHTML = `
            <strong>${timeStr}</strong>
            <div>${formatTemp(useCelsius ? temp : cToF(temp))}</div>
            <small class="muted">${entry.weather[0].main}</small>
        `;
        hourlyContainer.appendChild(item);
        // Add to observer for scroll effect
        observer.observe(item);
    });
  }
}

// Unit Toggle
tempToggle.addEventListener("change", () => {
  useCelsius = !tempToggle.checked;
  unitLabel.textContent = useCelsius ? "°C" : "°F";
  if (currentWeather) {
    updateUI(currentWeather, lastForecast);
  }
});

// Search Events
searchBtn.addEventListener("click", () => {
  const q = cityInput.value.trim();
  if (q) fetchWeather(q);
});
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// Scroll Observer (Scrollspy)
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if(entry.isIntersecting) {
            entry.target.classList.add("active");
        } else {
            entry.target.classList.remove("active");
        }
    });
}, { root: hourlyContainer, threshold: 0.5 });


// default geolocation
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
       const { latitude, longitude } = pos.coords;
       fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`)
        .then(r=>r.json())
        .then(data => {
            currentWeather = data;
            return fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`);
        })
        .then(r=>r.json())
        .then(fore => {
            lastForecast = fore;
            updateUI(currentWeather, lastForecast);
            saveRecent(currentWeather.name);
        })
        .catch(() => fetchWeather("New York"));
    }, 
    () => fetchWeather("New York")
  );
} else {
  fetchWeather("New York");
}