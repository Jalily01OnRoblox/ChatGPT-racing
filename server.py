# server.py
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Tuple, List
from PIL import Image
import math
import heapq
import os

# ---- Config ----
TRACK_FILENAME = "static/track.png"   # in ./static/
CELL_SIZE = 4                         # grid cell size (px)
LOCAL_RADIUS_PX = 160                 # local A* radius used for /path
CENTERLINE_STEP_PX = 6                # sampling step for centerline
BRIGHTNESS_THRESHOLD = 150            # threshold to detect road (adjust if needed)
# ----------------

app = FastAPI()
# serve static files at root
app.mount("/", StaticFiles(directory="static", html=True), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load track image on startup
if not os.path.exists(TRACK_FILENAME):
    raise RuntimeError(f"Missing {TRACK_FILENAME} — put your track.png into static/")

img = Image.open(TRACK_FILENAME).convert("RGB")
W, H = img.size
pixels = img.load()
COLS = math.ceil(W / CELL_SIZE)
ROWS = math.ceil(H / CELL_SIZE)

# Build boolean grid: True = road/walkable
grid = [[False] * COLS for _ in range(ROWS)]

def build_grid():
    for r in range(ROWS):
        for c in range(COLS):
            px = min(W - 1, int(c * CELL_SIZE + CELL_SIZE / 2))
            py = min(H - 1, int(r * CELL_SIZE + CELL_SIZE / 2))
            r_, g_, b_ = pixels[px, py]
            brightness = (r_ + g_ + b_) / 3.0
            grid[r][c] = brightness < BRIGHTNESS_THRESHOLD

build_grid()

# Build simple centerline (row-scan midpoint)
centerline = []
def build_centerline():
    global centerline
    centerline = []
    for py in range(0, H, CENTERLINE_STEP_PX):
        left = None; right = None
        # find leftmost road pixel
        for px in range(W):
            r_, g_, b_ = pixels[px, py]
            if (r_ + g_ + b_) / 3.0 < BRIGHTNESS_THRESHOLD:
                left = px; break
        # find rightmost road pixel
        for px in range(W - 1, -1, -1):
            r_, g_, b_ = pixels[px, py]
            if (r_ + g_ + b_) / 3.0 < BRIGHTNESS_THRESHOLD:
                right = px; break
        if left is not None and right is not None and (right - left) > 4:
            centerline.append(( (left + right) / 2.0, py ))
    # fallback if empty
    if not centerline:
        cx, cy = W/2, H/2
        r = min(cx, cy) * 0.7
        for i in range(36):
            a = i / 36.0 * 2 * math.pi
            centerline.append((cx + math.cos(a)*r, cy + math.sin(a)*r))

build_centerline()

# Helpers
def world_to_cell(x: float, y: float) -> Tuple[int,int]:
    c = int(max(0, min(COLS-1, math.floor(x / CELL_SIZE))))
    r = int(max(0, min(ROWS-1, math.floor(y / CELL_SIZE))))
    return (r, c)

def cell_to_world(rc: Tuple[int,int]) -> Tuple[float,float]:
    r, c = rc
    return ((c + 0.5) * CELL_SIZE, (r + 0.5) * CELL_SIZE)

def nearest_walkable_world(x: float, y: float, max_px=200):
    sr, sc = world_to_cell(x, y)
    if grid[sr][sc]:
        return cell_to_world((sr, sc))
    max_cells = math.ceil(max_px / CELL_SIZE)
    for radius in range(1, max_cells+1):
        for dy in range(-radius, radius+1):
            for dx in range(-radius, radius+1):
                if abs(dx) != radius and abs(dy) != radius:
                    continue
                rr = sr + dy; cc = sc + dx
                if 0 <= rr < ROWS and 0 <= cc < COLS and grid[rr][cc]:
                    return cell_to_world((rr, cc))
    return None

# Local A* (search window clamped around start)
def astar_local_world(start_w: Tuple[float,float], goal_w: Tuple[float,float], radius_px: int):
    sr, sc = world_to_cell(*start_w)
    gr, gc = world_to_cell(*goal_w)
    half = max(3, math.ceil(radius_px / CELL_SIZE))
    r0 = max(0, sr - half); r1 = min(ROWS-1, sr + half)
    c0 = max(0, sc - half); c1 = min(COLS-1, sc + half)
    wR = r1 - r0 + 1; wC = c1 - c0 + 1
    # convert to local coordinates
    start = (sr - r0, sc - c0)
    goal = (gr - r0, gc - c0)
    def in_bounds(n): return 0 <= n[0] < wR and 0 <= n[1] < wC
    def is_walk(n):
        rr = n[0] + r0; cc = n[1] + c0
        return grid[rr][cc]
    # if start/goal not walkable, snap inside window
    if not is_walk(start):
        found=False
        for rr in range(wR):
            for cc in range(wC):
                if is_walk((rr,cc)):
                    start=(rr,cc); found=True; break
            if found: break
    if not is_walk(goal):
        found=False
        for rr in range(wR):
            for cc in range(wC):
                if is_walk((rr,cc)):
                    goal=(rr,cc); found=True; break
            if found: break
    if not is_walk(start) or not is_walk(goal):
        return []
    def h(a,b): return math.hypot(a[0]-b[0], a[1]-b[1])
    neighbors = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]
    open_heap = []
    start_k = (start[0], start[1])
    gscore = {start_k:0.0}
    fscore = {start_k:h(start,goal)}
    heapq.heappush(open_heap, (fscore[start_k], start))
    came = {}
    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current == goal:
            # reconstruct
            path=[]
            cur=current
            while tuple(cur) in came:
                path.append((cur[1]+c0, cur[0]+r0))  # (c,r) -> (col,row)
                cur = came[tuple(cur)]
            path.append((start[1]+c0, start[0]+r0))
            path.reverse()
            # convert to world center coords:
            world=[]
            for cc, rr in path:
                world.append( ((cc + 0.5) * CELL_SIZE, (rr + 0.5) * CELL_SIZE) )
            return world
        for d in neighbors:
            nr, nc = current[0] + d[0], current[1] + d[1]
            if not in_bounds((nr,nc)): continue
            if not is_walk((nr,nc)): continue
            tentative = gscore.get((current[0],current[1)), 1e9) + (math.hypot(d[0],d[1]))
            key = (nr,nc)
            if tentative < gscore.get(key, 1e9):
                came[key] = current
                gscore[key] = tentative
                heapq.heappush(open_heap, (tentative + h((nr,nc), goal), (nr,nc)))
    return []

# API models
class Point(BaseModel):
    x: float
    y: float

class PathRequest(BaseModel):
    start: Point
    goal: Point
    radius_px: int = LOCAL_RADIUS_PX

@app.get("/centerline")
def get_centerline():
    return [{"x": x, "y": y} for x,y in centerline]

@app.post("/path")
def compute_path(req: PathRequest):
    start = (req.start.x, req.start.y)
    goal = (req.goal.x, req.goal.y)
    # snap start/goal to nearest walkable nearby if needed
    s_snap = nearest_walkable_world(*start, max_px=req.radius_px) or start
    g_snap = nearest_walkable_world(*goal, max_px=req.radius_px) or goal
    path = astar_local_world(s_snap, g_snap, req.radius_px)
    # respond with list of {"x":..., "y":...}
    return JSONResponse({"path": [{"x":p[0], "y":p[1]} for p in path]})
