class AI {
    constructor(x, y, angle = 0) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 0;
        this.maxSpeed = 2;
        this.turnSpeed = 0.05;
    }

    update() {
        // TEST TARGET (center of map)
        const targetX = roadGrid.length / 2;
        const targetY = roadGrid[0].length / 2;

        const dx = targetX - this.x;
        const dy = targetY - this.y;

        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - this.angle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

        if (angleDiff > 0.05) this.angle += this.turnSpeed;
        else if (angleDiff < -0.05) this.angle -= this.turnSpeed;

        this.speed = this.maxSpeed * 0.8;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    draw(ctx, cameraX, cameraY) {
        ctx.save();
        ctx.translate(this.x - cameraX, this.y - cameraY);
        ctx.rotate(this.angle);
        ctx.fillStyle = "red";
        ctx.fillRect(-10, -5, 20, 10);
        ctx.restore();
    }
}
