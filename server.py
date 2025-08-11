from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image
import heapq, math

# --------------------
# CONFIG
# --------------------
TRACK_IMAGE = "track.png"
SPAWN_PERCENT_X = 0.5     # middle horizontally
SPAWN_PERCENT_Y = 0.2     # 20% down vertically
CHECKPOINT_STEP = 150     # pixels between checkpoints
SEARCH_RADIUS = 200       # for local A* search

# --------------------
# LOAD TRACK
# --------------------
img = Image.open(TRACK_IMAGE).convert("RGB")
WIDTH, HEIGHT = img.size
pixels = img.load()

# Boolean walkable map
walkable = [[pixels[x, y] != (0, 0, 0) for x in range(WIDTH)] for y in range(HEIGHT)]

# Spawn point
spawn_x = int(WIDTH * SPAWN_PERCENT_X)
spawn_y = int(HEIGHT * SPAWN_PERCENT_Y)

# --------------------
# AUTO-GENERATE CHECKPOINTS
# --------------------
checkpoints = []
visited = [[False]*WIDTH for _ in range(HEIGHT)]

def bfs_path(start_x, start_y, step):
    from collections import deque
    q = deque()
    q.append((start_x, start_y))
    visited[start_y][start_x] = True
    count = 0
    while q:
        x, y = q.popleft()
        count += 1
        if count % step == 0:
            checkpoints.append((x, y))
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < WIDTH and 0 <= ny < HEIGHT:
                if not visited[ny][nx] and walkable[ny][nx]:
                    visited[ny][nx] = True
                    q.append((nx, ny))

bfs_path(spawn_x, spawn_y, CHECKPOINT_STEP)

# Loop path: connect last checkpoint back to first
checkpoints.append(checkpoints[0])

# --------------------
# A* PATHFINDING
# --------------------
def heuristic(a, b):
    return math.dist(a, b)

def astar(start, goal):
    sx, sy = start
    gx, gy = goal
    queue = [(0, (sx, sy))]
    came_from = {}
    cost_so_far = { (sx, sy): 0 }

    while queue:
        _, current = heapq.heappop(queue)
        if current == (gx, gy):
            break
        cx, cy = current
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nx, ny = cx+dx, cy+dy
            if 0 <= nx < WIDTH and 0 <= ny < HEIGHT and walkable[ny][nx]:
                new_cost = cost_so_far[current] + 1
                if (nx, ny) not in cost_so_far or new_cost < cost_so_far[(nx, ny)]:
                    cost_so_far[(nx, ny)] = new_cost
                    priority = new_cost + heuristic((nx, ny), (gx, gy))
                    heapq.heappush(queue, (priority, (nx, ny)))
                    came_from[(nx, ny)] = current
    # Reconstruct path
    path = []
    node = (gx, gy)
    while node in came_from:
        path.append(node)
        node = came_from[node]
    path.append((sx, sy))
    path.reverse()
    return path

# --------------------
# API
# --------------------
app = FastAPI()

class PathRequest(BaseModel):
    start_x: int
    start_y: int
    target_index: int

@app.post("/get_path")
def get_path(req: PathRequest):
    target = checkpoints[req.target_index % len(checkpoints)]
    path = astar((req.start_x, req.start_y), target)
    return {"path": path, "next_index": (req.target_index+1) % len(checkpoints)}

@app.get("/spawn")
def spawn():
    return {
        "spawn_x": spawn_x,
        "spawn_y": spawn_y,
        "checkpoints": checkpoints
    }
