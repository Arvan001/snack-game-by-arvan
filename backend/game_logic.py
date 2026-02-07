import asyncio
import random
import time
from typing import Dict, List, Tuple, Set
import json
from dataclasses import dataclass
from enum import Enum

class Direction(Enum):
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)

@dataclass
class Position:
    x: int
    y: int

class Snake:
    def __init__(self, player_id: str, username: str, skin: str = "default", color: str = "#00FF00"):
        self.player_id = player_id
        self.username = username
        self.skin = skin
        self.color = color
        self.reset()
    
    def reset(self):
        self.direction = Direction.RIGHT
        self.next_direction = Direction.RIGHT
        self.body = [Position(10, 10), Position(9, 10), Position(8, 10)]
        self.grow_pending = 0
        self.score = 0
        self.coins = 0
        self.alive = True
        self.speed = 10  # grid per second
        self.last_move_time = time.time()
    
    def update_direction(self, new_direction: Direction):
        # Prevent 180-degree turns
        opposite_map = {
            Direction.UP: Direction.DOWN,
            Direction.DOWN: Direction.UP,
            Direction.LEFT: Direction.RIGHT,
            Direction.RIGHT: Direction.LEFT
        }
        if new_direction != opposite_map.get(self.direction):
            self.next_direction = new_direction
    
    def move(self):
        if not self.alive:
            return
        
        current_time = time.time()
        if current_time - self.last_move_time < 1.0 / self.speed:
            return False
        
        self.direction = self.next_direction
        dx, dy = self.direction.value
        
        head = self.body[0]
        new_head = Position(
            (head.x + dx) % GRID_WIDTH,
            (head.y + dy) % GRID_HEIGHT
        )
        
        self.body.insert(0, new_head)
        
        if self.grow_pending > 0:
            self.grow_pending -= 1
        else:
            self.body.pop()
        
        self.last_move_time = current_time
        return True
    
    def grow(self, amount: int = 1):
        self.grow_pending += amount
        self.score += 10
    
    def add_coins(self, amount: int):
        self.coins += amount
    
    def kill(self):
        self.alive = False
    
    def respawn(self):
        self.reset()
        self.body = [
            Position(random.randint(5, GRID_WIDTH - 5), 
                    random.randint(5, GRID_HEIGHT - 5))
        ]
    
    def to_dict(self):
        return {
            "player_id": self.player_id,
            "username": self.username,
            "skin": self.skin,
            "color": self.color,
            "body": [(pos.x, pos.y) for pos in self.body],
            "alive": self.alive,
            "score": self.score,
            "coins": self.coins,
            "direction": self.direction.name
        }

class Food:
    def __init__(self):
        self.position = Position(random.randint(0, GRID_WIDTH - 1), 
                                random.randint(0, GRID_HEIGHT - 1))
        self.type = "normal"  # normal, golden, powerup
        self.value = random.choice([10, 20, 30])
    
    def respawn(self):
        self.position = Position(random.randint(0, GRID_WIDTH - 1), 
                                random.randint(0, GRID_HEIGHT - 1))
    
    def to_dict(self):
        return {
            "position": (self.position.x, self.position.y),
            "type": self.type,
            "value": self.value
        }

# Game Constants
GRID_SIZE = 20
GRID_WIDTH = 40
GRID_HEIGHT = 30
TICK_RATE = 60  # Hz

class GameRoom:
    def __init__(self, room_id: str, max_players: int = 10, is_private: bool = False):
        self.room_id = room_id
        self.max_players = max_players
        self.is_private = is_private
        self.players: Dict[str, Snake] = {}
        self.foods: List[Food] = []
        self.last_tick = time.time()
        self.running = True
        self.generate_food(20)
    
    def generate_food(self, count: int):
        for _ in range(count):
            self.foods.append(Food())
    
    def add_player(self, player_id: str, username: str, skin: str, color: str):
        if player_id in self.players:
            return True
        
        if len(self.players) >= self.max_players:
            return False
        
        snake = Snake(player_id, username, skin, color)
        # Set random starting position
        snake.body = [
            Position(random.randint(5, GRID_WIDTH - 5), 
                    random.randint(5, GRID_HEIGHT - 5))
        ]
        self.players[player_id] = snake
        return True
    
    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
    
    def update(self):
        current_time = time.time()
        delta_time = current_time - self.last_tick
        
        # Move all snakes
        for snake in self.players.values():
            snake.move()
        
        # Check collisions with food
        food_to_remove = []
        for food_idx, food in enumerate(self.foods):
            for snake in self.players.values():
                if not snake.alive:
                    continue
                
                head = snake.body[0]
                if head.x == food.position.x and head.y == food.position.y:
                    snake.grow(food.value // 10)
                    snake.add_coins(food.value // 5)
                    food_to_remove.append(food_idx)
                    # Play sound effect
                    break
        
        # Remove eaten food and spawn new ones
        for idx in sorted(food_to_remove, reverse=True):
            self.foods.pop(idx)
            self.foods.append(Food())
        
        # Check collisions with self and others
        for player_id, snake in self.players.items():
            if not snake.alive:
                continue
            
            head = snake.body[0]
            
            # Check collision with self
            for i, segment in enumerate(snake.body[1:], 1):
                if head.x == segment.x and head.y == segment.y:
                    snake.kill()
                    # Give coins to other players if any
                    for other_id, other_snake in self.players.items():
                        if other_id != player_id and other_snake.alive:
                            other_snake.add_coins(10)
                    break
            
            # Check collision with other snakes
            if snake.alive:
                for other_id, other_snake in self.players.items():
                    if other_id == player_id:
                        continue
                    
                    for segment in other_snake.body:
                        if head.x == segment.x and head.y == segment.y:
                            snake.kill()
                            other_snake.score += 50
                            other_snake.add_coins(20)
                            break
        
        # Auto-respawn dead snakes after 3 seconds
        for snake in self.players.values():
            if not snake.alive and current_time - snake.last_move_time > 3:
                snake.respawn()
        
        self.last_tick = current_time
    
    def get_state(self):
        return {
            "room_id": self.room_id,
            "players": {pid: snake.to_dict() for pid, snake in self.players.items()},
            "foods": [food.to_dict() for food in self.foods],
            "timestamp": time.time()
        }
    
    def get_leaderboard(self):
        players = list(self.players.values())
        players.sort(key=lambda x: x.score, reverse=True)
        return [
            {
                "username": snake.username,
                "score": snake.score,
                "coins": snake.coins,
                "alive": snake.alive
            }
            for snake in players
        ]