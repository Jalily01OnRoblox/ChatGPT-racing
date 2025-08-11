let canvas = document.getElementById("gameCanvas");
let ctx = canvas.getContext("2d");

let trackImg = new Image();
trackImg.src = "track.png";

let carImg = new Image();
carImg.src = "car.png"; // You’ll need a car sprite, e.g., 32x16 px

// Spawn roughly in the middle of the bottom straight
let car = {
    x: 400,
    y: 700,
    angle: -90 * Math.PI / 180,
    speed: 0,
    maxSpeed: 5,
    acceleration: 0.2,
    friction: 0.05,
    turnSpeed: 3 * Math.PI / 180
};

let keys = {};

document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

function update() {
    if (keys["ArrowUp"]) car.speed += car.acceleration;
    if (keys["ArrowDown"]) car.speed -= car.acceleration;

    if (keys["ArrowLeft"]) car.angle -= car.turnSpeed;
    if (keys["ArrowRight"]) car.angle += car.turnSpeed;

    car.speed *= (1 - car.friction);

    if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
    if (car.speed < -car.maxSpeed/2) car.speed = -car.maxSpeed/2;

    car.x += Math.cos(car.angle) * car.speed;
    car.y += Math.sin(car.angle) * car.speed;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(trackImg, 0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.drawImage(carImg, -carImg.width/2, -carImg.height/2);
    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

trackImg.onload = () => {
    carImg.onload = () => {
        loop();
    };
};
