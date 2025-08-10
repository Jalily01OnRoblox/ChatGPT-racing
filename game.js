const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const trackImage = new Image();
trackImage.src = 'track.png';

const terrainCanvas = document.createElement('canvas');
const terrainCtx = terrainCanvas.getContext('2d');

let terrainLoaded = false;
let roadGrid = [];

trackImage.onload = () => {
    terrainCanvas.width = trackImage.width;
    terrainCanvas.height = trackImage.height;
    terrainCtx.drawImage(trackImage, 0, 0);
    terrainLoaded = true;

    // Generate road grid (1 = road, 0 = off-road)
    const imgData = terrainCtx.getImageData(0, 0, trackImage.width, trackImage.height);
    roadGrid = [];
    for (let x = 0; x < trackImage.width; x++) {
        roadGrid[x] = [];
        for (let y = 0; y < trackImage.height; y++) {
            const idx = (y * trackImage.width + x) * 4;
            const r = imgData.data[idx];
            const g = imgData.data[idx+1];
            const b = imgData.data[idx+2];
            // Assuming road is light gray in track.png
            roadGrid[x][y] = (r > 100 && g > 100 && b > 100) ? 1 : 0;
        }
    }
};

const keys = { ArrowUp: false, ArrowLeft: false, ArrowRight: false };
window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

class Kart {
    constructor(x, y, color = 'red', isAI = false) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = 3;
        this.friction = 0.05;
        this.turnSpeed = 0.05;
        this.color = color;
        this.isAI = isAI;
        this.path = [];
        this.pathIndex = 0;
        this.pathTimer = 0;
    }

    updateAI() {
        if (!roadGrid.length) return;
        if (this.pathTimer <= 0 || this.pathIndex >= this.path.length) {
            const start = { x: Math.floor(this.x), y: Math.floor(this.y) };
            // Pick a goal 200px ahead on the road
            const goal = { x: start.x + Math.floor(Math.random() * 100) - 50, y: start.y + Math.floor(Math.random() * 100) - 50 };
            const astar = new AStar(roadGrid);
            this.path = astar.findPath(start, goal);
            this.pathIndex = 0;
            this.pathTimer = 60; // recalc every second
        }
        this.pathTimer--;

        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const target = this.path[this.pathIndex];
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            let angleDiff = targetAngle - this.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            if (angleDiff > 0.05) this.angle += this.turnSpeed;
            else if (angleDiff < -0.05) this.angle -= this.turnSpeed;
            this.speed = this.maxSpeed;
            if (Math.hypot(dx, dy) < 5) this.pathIndex++;
        }
    }

    update() {
        if (!this.isAI) {
            if (keys.ArrowUp) this.speed += this.acceleration;
            else this.speed -= this.friction;
            if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
            if (this.speed < 0) this.speed = 0;
            if (keys.ArrowLeft) this.angle -= this.turnSpeed;
            if (keys.ArrowRight) this.angle += this.turnSpeed;
        } else {
            this.updateAI();
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    draw(camX, camY) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(-10, -5, 20, 10);
        ctx.restore();
    }
}

const player = new Kart(200, 200, 'red', false);
const aiCars = [
    new Kart(220, 220, 'blue', true),
    new Kart(240, 240, 'green', true)
];

function gameLoop() {
    if (!terrainLoaded) {
        requestAnimationFrame(gameLoop);
        return;
    }

    player.update();
    aiCars.forEach(ai => ai.update());

    const camX = player.x - canvas.width / 2;
    const camY = player.y - canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(trackImage, -camX, -camY);

    player.draw(camX, camY);
    aiCars.forEach(ai => ai.draw(camX, camY));

    requestAnimationFrame(gameLoop);
}

gameLoop();
