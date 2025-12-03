const API_KEY = "af711887a7ce95136044c8e17a621335";
let currentTempC = null;
let isCelsius = true;

function getWeather() {
    const city = document.getElementById("cityInput").value.trim();
    if (!city) {
        alert("Please enter a city name!");
        return;
    }

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`)
    .then(res => res.json())
    .then(data => {
        console.log(data);

        if (data.cod !== 200) {
            alert("City not found!");
            return;
        }

        // Weather info
        const temp = data.main.temp;
        currentTempC = temp;
        const description = data.weather[0].main.toLowerCase();
        const icon = data.weather[0].icon;
        const timezone = data.timezone; // offset in seconds

        // REAL LOCAL TIME
        const localTime = new Date(Date.now() + timezone * 1000);
        const formattedTime = localTime.toUTCString().slice(17, 25);

        // Update UI
        document.getElementById("cityName").innerHTML = `<h3>${data.name}, ${data.sys.country}</h3>`;
        document.getElementById("localTime").innerHTML = `Local Time: ${formattedTime}`;
        document.getElementById("temperature").innerHTML = `${temp.toFixed(1)}°C`;
        document.getElementById("description").innerHTML = `Weather: ${data.weather[0].description}`;
        document.getElementById("humidity").innerHTML = `Humidity: ${data.main.humidity}%`;
        document.getElementById("wind").innerHTML = `Wind: ${data.wind.speed} m/s`;

        document.getElementById("weatherIcon").src = `https://openweathermap.org/img/wn/${icon}@2x.png`;

        // Background animation
        changeBackground(description);
    })
    .catch(err => console.error(err));
}

function toggleTemp() {
    if (currentTempC === null) return;
    isCelsius = !isCelsius;

    const tempElement = document.getElementById("temperature");
    const toggleText = document.querySelector(".toggle");

    if (isCelsius) {
        tempElement.innerHTML = `${currentTempC.toFixed(1)}°C`;
        toggleText.innerText = "Switch to °F";
    } else {
        const tempF = (currentTempC * 9/5) + 32;
        tempElement.innerHTML = `${tempF.toFixed(1)}°F`;
        toggleText.innerText = "Switch to °C";
    }
}

function changeBackground(desc) {
    if (desc.includes("rain")) {
        document.body.className = "rainy";
    } else if (desc.includes("cloud")) {
        document.body.className = "cloudy";
    } else if (desc.includes("snow")) {
        document.body.className = "snowy";
    } else {
        document.body.className = "sunny";
    }
}