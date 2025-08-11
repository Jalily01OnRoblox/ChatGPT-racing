const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1024;
canvas.height = 1028;

let trackImg = new Image();
trackImg.src = "track.png";

class Car {
    constructor(x, y, color, isAI = false) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = 2;
        this.color = color;
        this.isAI = isAI;
        this.path = [];
        this.pathIndex = 0;
        this.targetCheckpointIndex = 1;
    }

    async requestPath() {
        const res = await fetch("http://127.0.0.1:8000/get_path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start_x: Math.floor(this.x),
                start_y: Math.floor(this.y),
                target_index: this.targetCheckpointIndex
            })
        });
        const data = await res.json();
        this.path = data.path;
        this.pathIndex = 0;
        this.targetCheckpointIndex = data.next_index;
    }

    update() {
        if (this.isAI) {
            if (this.path.length > 0) {
                let [tx, ty] = this.path[this.pathIndex];
                let dx = tx - this.x;
                let dy = ty - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 2) {
                    this.pathIndex++;
                    if (this.pathIndex >= this.path.length) {
                        this.requestPath();
                    }
                } else {
                    this.angle = Math.atan2(dy, dx);
                    this.x += Math.cos(this.angle) * this.maxSpeed;
                    this.y += Math.sin(this.angle) * this.maxSpeed;
                }
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(-10, -5, 20, 10);
        ctx.restore();
    }
}

let cars = [];
let player = null;

async function init() {
    const res = await fetch("http://127.0.0.1:8000/spawn");
    const data = await res.json();

    player = new Car(data.spawn_x, data.spawn_y, "blue", false);
    let ai = new Car(data.spawn_x + 30, data.spawn_y, "red", true);
    cars.push(player, ai);

    await ai.requestPath();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(trackImg, 0, 0);
    cars.forEach(c => {
        c.update();
        c.draw();
    });
    requestAnimationFrame(gameLoop);
}

trackImg.onload = () => {
    init().then(() => gameLoop());
};
