const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const trackImg = new Image();
trackImg.src = "track.png";

let aiCars = [];
let playerCar = null;

function spawnAICar() {
    fetch("http://127.0.0.1:8000/spawn")
        .then(res => res.json())
        .then(data => {
            aiCars.push({ x: data.x, y: data.y });
        });
}

function updateAICars() {
    fetch("http://127.0.0.1:8000/update_ai")
        .then(res => res.json())
        .then(data => {
            aiCars = data;
        });
}

function drawTrack() {
    ctx.drawImage(trackImg, 0, 0, canvas.width, canvas.height);
}

function drawCars() {
    ctx.fillStyle = "red"; // AI car color
    aiCars.forEach(car => {
        ctx.beginPath();
        ctx.arc(car.x, car.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function gameLoop() {
    drawTrack();
    drawCars();
    requestAnimationFrame(gameLoop);
}

trackImg.onload = () => {
    spawnAICar();
    setInterval(updateAICars, 100); // update AI every 100ms
    gameLoop();
};
