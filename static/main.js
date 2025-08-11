// main.js - client that uses server centerline + /path for recovery

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const track = new Image();
track.src = 'track.png';

let trackW = 0, trackH = 0;
let centerline = [];

track.onload = async () => {
  trackW = track.width; trackH = track.height;
  console.log('track loaded', trackW, trackH);
  // fetch centerline from server
  try {
    const r = await fetch('/centerline');
    centerline = await r.json();
    console.log('centerline points', centerline.length);
  } catch (e) {
    console.warn('centerline fetch failed', e);
  }
  initGame();
};

track.onerror = () => console.error("Failed to load track.png — ensure it's ./static/track.png");

const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// Car class
class Car {
  constructor(x,y,color='red', isPlayer=false) {
    this.x = x; this.y = y; this.color = color;
    this.angle = 0; this.speed = 0;
    this.isPlayer = isPlayer;
    this.maxSpeed = 2.6;
    // AI fields
    this.wayIndex = 0;
    this.localPath = [];
    this.localIndex = 0;
    this.recalcTimer = 0;
  }
  async recalcLocalPath(goal) {
    // call server path API
    try {
      const res = await fetch('/path', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ start: {x:this.x,y:this.y}, goal:{x:goal.x,y:goal.y}, radius_px:160 })
      });
      const j = await res.json();
      if (j.path && j.path.length) {
        this.localPath = j.path;
        this.localIndex = 0;
      } else {
        this.localPath = [];
      }
    } catch (e) {
      console.error('path request failed', e);
    }
  }
  update() {
    if (this.isPlayer) {
      // controls: WASD or arrows
      if (keys['ArrowUp'] || keys['w'] || keys['W']) this.speed = Math.min(this.maxSpeed, this.speed + 0.12);
      else this.speed = Math.max(0, this.speed - 0.08);
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) this.angle -= 0.06;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) this.angle += 0.06;
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      return;
    }
    // AI: if have local path, follow it
    if (this.localPath.length > 0 && this.localIndex < this.localPath.length) {
      const t = this.localPath[this.localIndex];
      const dx = t.x - this.x, dy = t.y - this.y;
      const targ = Math.atan2(dy, dx);
      const diff = normalizeAngle(targ - this.angle);
      this.angle += clamp(diff, -0.06, 0.06);
      const slow = Math.max(0.45, 1 - Math.min(Math.abs(diff) / Math.PI, 0.8));
      this.speed = this.maxSpeed * slow;
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      if (Math.hypot(dx,dy) < 6) this.localIndex++;
      this.recalcTimer = Math.max(this.recalcTimer - 1, 0);
      return;
    }

    // Otherwise follow centerline waypoints (cheap)
    if (centerline.length > 0) {
      // ensure wayIndex in range
      if (this.wayIndex >= centerline.length) this.wayIndex = 0;
      const wp = centerline[this.wayIndex];
      const dx = wp.x - this.x, dy = wp.y - this.y;
      const targ = Math.atan2(dy, dx);
      const diff = normalizeAngle(targ - this.angle);
      this.angle += clamp(diff, -0.05, 0.05);
      // reduce speed when turning
      const turn = Math.min(1, Math.abs(diff) / 1.2);
      this.speed = this.maxSpeed * (1 - 0.5 * turn);
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      if (Math.hypot(dx,dy) < 14) this.wayIndex = (this.wayIndex + 1) % centerline.length;
      // if we detect we are far from waypoint (possible off-track), request server local path (throttle)
      if (Math.hypot(dx,dy) > 80 && this.recalcTimer <= 0) {
        // request recovery path to that waypoint
        this.recalcTimer = 30;
        this.recalcLocalPath(wp);
      }
    }
  }
  draw(camX,camY) {
    ctx.save();
    ctx.translate(this.x - camX, this.y - camY);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.fillRect(-8, -5, 16, 10);
    ctx.restore();
  }
}

function clamp(v,a,b){ return v<a ? a : v>b ? b : v; }
function normalizeAngle(a){ while(a>Math.PI) a-=Math.PI*2; while(a<-Math.PI) a+=Math.PI*2; return a; }

let player, ai;
function initGame() {
  // spawn near center of track by default
  const startX = trackW/2, startY = trackH/2;
  player = new Car(startX + 40, startY, 'dodgerblue', true);
  ai = new Car(startX - 40, startY, 'orange', false);
  player.angle = 0; ai.angle = 0;
  // main loop
  requestAnimationFrame(loop);
}

function drawMinimap(camX, camY) {
  if (!track.complete) return;
  const miniW = 200;
  const miniH = Math.round((trackH / trackW) * miniW);
  const ox = canvas.width - miniW - 10, oy = 10;
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.drawImage(track, ox, oy, miniW, miniH);
  const sx = miniW / trackW, sy = miniH / trackH;
  // draw centerline
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  for (let i=0;i<centerline.length;i++){
    const p = centerline[i];
    const px = ox + p.x * sx, py = oy + p.y * sy;
    if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.stroke();
  // cars
  ctx.fillStyle = player.color; ctx.fillRect(ox + player.x*sx -3, oy + player.y*sy -3, 6, 6);
  ctx.fillStyle = ai.color; ctx.fillRect(ox + ai.x*sx -3, oy + ai.y*sy -3, 6, 6);
  // ai local path
  if (ai.localPath && ai.localPath.length) {
    ctx.strokeStyle = 'rgba(255,255,0,0.9)'; ctx.beginPath();
    for (let i=0;i<ai.localPath.length;i++){
      const p = ai.localPath[i]; const px = ox + p.x*sx, py = oy + p.y*sy;
      if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function loop() {
  // update
  player.update();
  ai.update();

  // camera follows player
  const camX = player.x - canvas.width/2;
  const camY = player.y - canvas.height/2;

  // draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (track.complete) ctx.drawImage(track, -camX, -camY);
  else { ctx.fillStyle='#222'; ctx.fillRect(0,0,canvas.width,canvas.height); }

  // cars
  player.draw(camX, camY);
  ai.draw(camX, camY);

  // minimap
  drawMinimap(camX, camY);

  requestAnimationFrame(loop);
}
