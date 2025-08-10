// game.js

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let trackImage = new Image();
let trackLoaded = false;

trackImage.onload = () => {
    console.log("Track loaded:", trackImage.width, trackImage.height);
    trackLoaded = true;
};
trackImage.src = "track.png";

// ===== Kart Class =====
class Kart {
    constructor(x, y, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isPlayer = isPlayer;
        this.speed = 0;
        this.maxSpeed = 3;
        this.angle = 0;
    }

    update(keys) {
        if (this.isPlayer) {
            if (keys["ArrowUp"]) this.speed = this.maxSpeed;
            else this.speed *= 0.95;

            if (keys["ArrowLeft"]) this.angle -= 3;
            if (keys["ArrowRight"]) this.angle += 3;
        } else {
            // Simple AI movement: drive forward and slowly turn
            this.speed = this.maxSpeed * 0.6;
            this.angle += 0.5; 
        }

        this.x += Math.cos(this.angle * Math.PI / 180) * this.speed;
        this.y += Math.sin(this.angle * Math.PI / 180) * this.speed;
    }

    draw(camX, camY) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.rotate(this.angle * Math.PI / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-10, -5, 20, 10);
        ctx.restore();
    }
}

// ===== Game Setup =====
let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

let player = new Kart(200, 200, "red", true);
let aiKarts = [
    new Kart(250, 200, "blue"),
    new Kart(300, 250, "green")
];

// Camera
let camX = 0;
let camY = 0;

// ===== Game Loop =====
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (trackLoaded) {
        ctx.drawImage(trackImage, -camX, -camY);
    } else {
        ctx.fillStyle = "gray";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    player.update(keys);
    aiKarts.forEach(ai => ai.update());

    // Camera follows player
    camX = player.x - canvas.width / 2;
    camY = player.y - canvas.height / 2;

    player.draw(camX, camY);
    aiKarts.forEach(ai => ai.draw(camX, camY));

    requestAnimationFrame(gameLoop);
}

gameLoop();
