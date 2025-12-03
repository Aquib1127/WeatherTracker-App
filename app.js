const API_KEY = "af711887a7ce95136044c8e17a621335";

// DOM elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const tempToggle = document.getElementById('tempToggle');
const unitLabel = document.getElementById('unitLabel');
const cityName = document.getElementById('cityName');
const timeLocal = document.getElementById('timeLocal');
const tempValue = document.getElementById('tempValue');
const weatherDesc = document.getElementById('weatherDesc');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const sunTimesEl = document.getElementById('sunTimes');
const weatherCanvas = document.getElementById('weatherCanvas');
const weatherIcon = document.getElementById('weatherIcon');
const recentList = document.getElementById('recentList');
const forecastList = document.getElementById('forecastList');

let currentWeather = null;
let currentLocalClockInterval = null;
let useCelsius = true;

// Recent searches (localStorage)
const RECENT_KEY = "recent_weather";
function loadRecent(){
  const raw = localStorage.getItem(RECENT_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveRecent(city){
  let arr = loadRecent();
  arr = arr.filter(c => c.toLowerCase() !== city.toLowerCase());
  arr.unshift(city);
  if(arr.length > 6) arr.pop();
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  renderRecent();
}
function renderRecent(){
  recentList.innerHTML = '';
  loadRecent().forEach(city => {
    const btn = document.createElement('button');
    btn.textContent = city;
    btn.addEventListener('click', () => fetchWeather(city));
    recentList.appendChild(btn);
  })
}
renderRecent();

// Helpers
function kelvinToC(k){ return k - 273.15; }
function cToF(c){ return (c * 9/5) + 32; }
function formatTemp(v){ return Math.round(v) + (useCelsius ? '°C' : '°F'); }
function getAQIDescription(aqi) {
  switch(aqi) {
    case 1: return "Good 😊";
    case 2: return "Fair 🙂";
    case 3: return "Moderate 😐";
    case 4: return "Poor 😷";
    case 5: return "Very Poor 🚫";
    default: return "Unknown";
  }
}

// gets REAL current time and date of searched city
function getLocalDateTime(timezoneOffsetSeconds){
  const targetInstant = new Date(Date.now() + timezoneOffsetSeconds * 1000);

  // Format date: e.g. 02 Dec 2025
  const dateStr = targetInstant.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });

  // Format time: HH:MM:SS
  const timeStr = targetInstant.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  });

  return `${dateStr} • ${timeStr}`;
}

// Sunrise & sunset
function displayTimeFromUnix(unix, tzOffsetSeconds = 0){
  const instantMs = (unix + tzOffsetSeconds) * 1000;
  return new Date(instantMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
}

// Determine main animation class from weather.main or id
function conditionToClass(main, id, isNight = false){
  main = (main || '').toLowerCase();
  if(main.includes('rain') || main.includes('drizzle')) return 'rain';
  if(main.includes('snow')) return 'snow';
  if(main.includes('thunder')) return 'thunder';
  if(main.includes('smoke') || main.includes('haze') || main.includes('mist')) return 'smoke';
  if(main.includes('cloud')) return 'clouds';
  if(main.includes('clear')) return isNight ? 'night' : 'sunny';
  return 'clouds';
}

// Simple SVG icon
function createIconSVG(main, isNight = false){
  main = (main || '').toLowerCase();
  if(main.includes('rain') || main.includes('drizzle')) {
    return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7H17A5 5 0 0 0 7 8"/></svg>`;
  }
  if(main.includes('snow')) {
    return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3v18M4 12h16M6.5 6.5l11 11M6.5 17.5l11-11"/></svg>`;
  }
  if(main.includes('thunder')) {
    return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M13 2L3 14h9l-1 8 10-12h-8z"/></svg>`;
  }
  if(main.includes('cloud')) {
    return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 15a4 4 0 0 1 4-4h1a6 6 0 1 1 11 3"/></svg>`;
  }
  if(main.includes('clear') && isNight) {
    return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
    </svg>`;
  }
  return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
}

// Animations
function clearAnimations(){
  weatherCanvas.className = 'weather-canvas';
  while(weatherCanvas.querySelector('.sun')) weatherCanvas.removeChild(weatherCanvas.querySelector('.sun'));
  const animEls = weatherCanvas.querySelectorAll('.cloud, .drop, .snowflake, .haze-layer, .stars');
  animEls.forEach(e => e.remove());
}

function renderAnimationsFor(conditionClass){
  clearAnimations();
  weatherCanvas.classList.add(conditionClass);

  if(conditionClass === 'sunny'){
    const sun = document.createElement('div');
    sun.className = 'sun';
    weatherCanvas.appendChild(sun);
    const c1 = document.createElement('div'); c1.className='cloud small'; weatherCanvas.appendChild(c1);
    const c2 = document.createElement('div'); c2.className='cloud med'; weatherCanvas.appendChild(c2);
  } else if(conditionClass === 'clouds'){
    for(let i=0;i<3;i++){
      const c = document.createElement('div');
      c.className = ['cloud','big','med','small'][i] || 'cloud small';
      c.style.top = (5 + i*25) + '%';
      c.style.left = (i*30) + '%';
      weatherCanvas.appendChild(c);
    }
  } else if(conditionClass === 'rain'){
    const c = document.createElement('div'); c.className='cloud big'; weatherCanvas.appendChild(c);
    for(let i=0;i<40;i++){
      const drop = document.createElement('div');
      drop.className='drop';
      drop.style.left = (Math.random()*100) + '%';
      drop.style.top = (Math.random()*-40) + 'vh';
      drop.style.animationDuration = (0.9 + Math.random()*0.7) + 's';
      drop.style.opacity = 0.6 + Math.random()*0.4;
      drop.style.transform = `rotate(${6 + Math.random()*10}deg)`;
      weatherCanvas.appendChild(drop);
    }
  } else if(conditionClass === 'snow'){
    const c = document.createElement('div'); c.className='cloud med'; weatherCanvas.appendChild(c);
    for(let i=0;i<30;i++){
      const flake = document.createElement('div');
      flake.className='snowflake';
      flake.style.left = (Math.random()*100) + '%';
      flake.style.top = (Math.random()*-40) + 'vh';
      flake.style.animationDuration = (6 + Math.random()*8) + 's';
      flake.style.opacity = 0.6 + Math.random()*0.4;
      flake.style.width = flake.style.height = (6 + Math.random()*6) + 'px';
      weatherCanvas.appendChild(flake);
    }
  } else if(conditionClass === 'thunder'){
    const c = document.createElement('div'); c.className='cloud big'; weatherCanvas.appendChild(c);
    for(let i=0;i<20;i++){
      const drop = document.createElement('div');
      drop.className='drop';
      drop.style.left = (Math.random()*100) + '%';
      drop.style.top = (Math.random()*-40) + 'vh';
      drop.style.animationDuration = (0.7 + Math.random()*0.5) + 's';
      weatherCanvas.appendChild(drop);
    }
  } else if(conditionClass === 'smoke'){
    const haze = document.createElement('div');
    haze.className = 'haze-layer';
    weatherCanvas.appendChild(haze);
  }else if(conditionClass === 'night'){
    // Create stars container
    const starsContainer = document.createElement('div');
    starsContainer.className = 'stars';
    weatherCanvas.appendChild(starsContainer);
  
    // Generate 60 random stars
    for(let i = 0; i < 60; i++){
      const star = document.createElement('div');
      star.className = 'star';
      star.style.top = Math.random() * 100 + '%';
      star.style.left = Math.random() * 100 + '%';
      star.style.animationDuration = (2 + Math.random() * 3) + 's';
      starsContainer.appendChild(star);
    }
  
    // Add moon
    const moon = document.createElement('div');
    moon.className = 'moon';
    weatherCanvas.appendChild(moon);
  }
}

// Fetch weather
async function fetchWeather(city){
  if(!city) return;
  cityName.textContent = 'Loading...';
  try {
    const current = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`).then(r=>r.json());
    if(current.cod && current.cod !== 200){
      cityName.textContent = 'City not found';
    
      // Clear other UI fields if city not found
      timeLocal.textContent = '—';
      tempValue.textContent = '--';
      weatherDesc.textContent = '—';
      humidityEl.textContent = '--';
      windEl.textContent = '--';
      sunTimesEl.textContent = '--';
      weatherIcon.innerHTML = '';
      forecastList.innerHTML = '';
      return;
    }
    currentWeather = current;

    const forecastRaw = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`).then(r=>r.json());

    updateUI(current, forecastRaw);
    saveRecent(city);

  } catch(err){
    console.error(err);
    cityName.textContent = 'Error fetching data';
  }
}

// Update UI
function updateUI(current, forecastRaw){
  const tz = current.timezone;
  const now = Date.now() / 1000; // current time in UNIX seconds
  const isNight = now > current.sys.sunset || now < current.sys.sunrise;

  cityName.textContent = `${current.name}, ${current.sys.country}`;

// FIXED REAL TIME HERE
  if (currentLocalClockInterval) {
    clearInterval(currentLocalClockInterval);
    currentLocalClockInterval = null;
  }

  // set immediate and then start an interval to update every second
  timeLocal.textContent = getLocalDateTime(current.timezone);
  currentLocalClockInterval = setInterval(() => {
    timeLocal.textContent = getLocalDateTime(current.timezone);
  }, 1000);

  const main = current.weather[0].main;
  weatherDesc.textContent = current.weather[0].description;
  humidityEl.textContent = current.main.humidity + '%';
  windEl.textContent = (current.wind.speed).toFixed(1);
  const { lat, lon } = current.coord;
  fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
  .then(r => r.json())
  .then(aqiData => {
    const aqiValue = aqiData.list[0].main.aqi;
    const aqiEl = document.getElementById('aqi');
    aqiEl.textContent = getAQIDescription(aqiValue);

    // Color‑coding based on AQI level
    switch(aqiValue) {
      case 1: aqiEl.style.color = '#4CAF50'; break;   // Good - Green
      case 2: aqiEl.style.color = '#CDDC39'; break;   // Fair - Lime
      case 3: aqiEl.style.color = '#FFC107'; break;   // Moderate - Amber
      case 4: aqiEl.style.color = '#FF5722'; break;   // Poor - Orange
      case 5: aqiEl.style.color = '#F44336'; break;   // Very Poor - Red
      default: aqiEl.style.color = '#e8eeff'; break;  // Fallback
    }
  })
  .catch(() => {
    document.getElementById('aqi').textContent = '--';
  });

  sunTimesEl.textContent = `${displayTimeFromUnix(current.sys.sunrise, tz)} / ${displayTimeFromUnix(current.sys.sunset, tz)}`;

  let tempC = current.main.temp;
  let displayTemp = useCelsius ? tempC : cToF(tempC);
  tempValue.textContent = formatTemp(displayTemp);

  weatherIcon.innerHTML = createIconSVG(main, isNight);

  const animClass = conditionToClass(main, current.weather[0].id, isNight);
  renderAnimationsFor(animClass);

  if(forecastRaw && forecastRaw.list){
    const byDay = {};
    forecastRaw.list.forEach(entry => {
      const d = new Date(entry.dt * 1000);
      const dayKey = d.toLocaleDateString();
      if(!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push(entry);
    });

    const days = Object.keys(byDay).slice(0,5);
    forecastList.innerHTML = '';

    days.forEach(dayKey => {
      const entries = byDay[dayKey];
      const temps = entries.map(e => e.main.temp);
      const avg = temps.reduce((a,b)=>a+b,0)/temps.length;
      const desc = entries[0].weather[0].main;
      const el = document.createElement('div');
      el.className = 'forecast-item';
      const d = new Date(entries[0].dt * 1000);
      el.innerHTML = `<strong>${d.toLocaleDateString(undefined,{weekday:'short'})}</strong>
        <div>${Math.round(useCelsius ? avg : cToF(avg))}${useCelsius ? '°C' : '°F'}</div>
        <small class="muted">${entries[0].weather[0].description}</small>`;
      forecastList.appendChild(el);
    });    
  }
}

// toggle units
tempToggle.addEventListener('change', () => {
  useCelsius = !tempToggle.checked; 
  unitLabel.textContent = useCelsius ? '°C' : '°F';

  if(currentWeather) {
    const tempC = currentWeather.main.temp;
    tempValue.textContent = formatTemp(useCelsius ? tempC : cToF(tempC));
    updateUI(currentWeather, null);
  }
});

// UI events
searchBtn.addEventListener('click', () => {
  const q = cityInput.value.trim();
  if(q) fetchWeather(q);
});
cityInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') searchBtn.click(); });

// Default load
// geolocation support
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`)
      .then(r => r.json())
      .then(current => {
        if(current.cod && current.cod !== 200){
          fetchWeather('Mumbai'); // fallback
          return;
        }
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`;
        fetch(forecastUrl)
          .then(r => r.json())
          .then(forecastRaw => {
            updateUI(current, forecastRaw);
            saveRecent(current.name);
          });
      })
      .catch(() => fetchWeather('Mumbai')); // fallback
  }, () => fetchWeather('Mumbai')); // fallback if denied
} else {
  fetchWeather('Mumbai'); // fallback if geolocation not supported
} 

cityInput.setAttribute('aria-label', 'Search city');