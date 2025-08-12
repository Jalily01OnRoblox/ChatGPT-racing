from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math
import heapq
import random
from PIL import Image

# === CONFIG ===
TRACK_IMAGE_PATH = "track.png"
WAYPOINT_SPACING = 15  # pixels between AI waypoints
CAR_SPEED = 2  # pixels per update

# === FastAPI setup ===
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Track loading ===
track_img = Image.open(TRACK_IMAGE_PATH).convert("RGB")
width, height = track_img.size
pixels = track_img.load()

def is_track(x, y):
    """Check if pixel is driveable (white track)"""
    if 0 <= x < width and 0 <= y < height:
        r, g, b = pixels[x, y]
        return r > 200 and g > 200 and b > 200
    return False

# === AI State ===
cars = []
waypoints = []

class Car:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.path = []
        self.target_index = 0

# === Pathfinding ===
def heuristic(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])

def a_star(start, goal):
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {start: 0}
    f_score = {start: heuristic(start, goal)}

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            path.reverse()
            return path

        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            neighbor = (current[0] + dx, current[1] + dy)
            if not is_track(*neighbor):
                continue
            tentative_g = g_score[current] + 1
            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic(neighbor, goal)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))
    return []

# === Generate waypoints around track (lap loop) ===
def generate_loop_waypoints():
    points = []
    for y in range(0, height, WAYPOINT_SPACING):
        for x in range(0, width, WAYPOINT_SPACING):
            if is_track(x, y):
                points.append((x, y))
    return points

waypoints = generate_loop_waypoints()

# === API Models ===
class PathRequest(BaseModel):
    start_x: int
    start_y: int
    goal_x: int
    goal_y: int

# === Routes ===
@app.get("/spawn")
def spawn_car():
    """Spawn a single AI car on track"""
    while True:
        x = random.randint(0, width-1)
        y = random.randint(0, height-1)
        if is_track(x, y):
            car = Car(x, y)
            cars.append(car)
            return {"x": x, "y": y}

@app.post("/path")
def get_path(data: PathRequest):
    """Generate a path from start to goal using A*"""
    path = a_star((data.start_x, data.start_y), (data.goal_x, data.goal_y))
    return {"path": path}

@app.get("/update_ai")
def update_ai():
    """Move AI cars along their lap loop"""
    results = []
    for car in cars:
        if not car.path:
            # Choose next waypoint randomly for now
            target = random.choice(waypoints)
            car.path = a_star((car.x, car.y), target)
            car.target_index = 0

        if car.target_index < len(car.path):
            tx, ty = car.path[car.target_index]
            dx = tx - car.x
            dy = ty - car.y
            dist = math.hypot(dx, dy)
            if dist < CAR_SPEED:
                car.x, car.y = tx, ty
                car.target_index += 1
            else:
                car.x += int(CAR_SPEED * dx / dist)
                car.y += int(CAR_SPEED * dy / dist)

        results.append({"x": car.x, "y": car.y})
    return results
