import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket
from game_logic import GameRoom, GRID_WIDTH, GRID_HEIGHT
import time

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, str] = {}  # user_id -> room_id
        self.rooms: Dict[str, GameRoom] = {
            "global": GameRoom("global", max_players=50, is_private=False)
        }
        self.game_task = None
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.user_rooms:
            room_id = self.user_rooms[user_id]
            if room_id in self.rooms:
                self.rooms[room_id].remove_player(user_id)
            del self.user_rooms[user_id]
        
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def broadcast_to_room(self, message: dict, room_id: str, exclude_user: str = None):
        if room_id not in self.rooms:
            return
        
        room = self.rooms[room_id]
        for player_id in room.players:
            if player_id != exclude_user and player_id in self.active_connections:
                try:
                    await self.active_connections[player_id].send_json(message)
                except:
                    pass
    
    async def handle_message(self, user_id: str, data: dict):
        if "action" not in data:
            return
        
        action = data["action"]
        
        if action == "join_room":
            room_id = data.get("room_id", "global")
            username = data.get("username", "Player")
            skin = data.get("skin", "default")
            color = data.get("color", "#00FF00")
            
            # Create private room if it doesn't exist
            if room_id not in self.rooms and room_id != "global":
                self.rooms[room_id] = GameRoom(room_id, max_players=2, is_private=True)
            
            if room_id in self.rooms:
                room = self.rooms[room_id]
                if room.add_player(user_id, username, skin, color):
                    self.user_rooms[user_id] = room_id
                    await self.send_personal_message({
                        "type": "room_joined",
                        "room_id": room_id,
                        "grid_size": {"width": GRID_WIDTH, "height": GRID_HEIGHT}
                    }, user_id)
                    
                    # Broadcast new player to room
                    await self.broadcast_to_room({
                        "type": "player_joined",
                        "player": {
                            "id": user_id,
                            "username": username,
                            "skin": skin,
                            "color": color
                        }
                    }, room_id, exclude_user=user_id)
        
        elif action == "move":
            if user_id in self.user_rooms:
                room_id = self.user_rooms[user_id]
                if room_id in self.rooms:
                    direction = data.get("direction")
                    if direction in ["UP", "DOWN", "LEFT", "RIGHT"]:
                        from game_logic import Direction
                        dir_map = {
                            "UP": Direction.UP,
                            "DOWN": Direction.DOWN,
                            "LEFT": Direction.LEFT,
                            "RIGHT": Direction.RIGHT
                        }
                        self.rooms[room_id].players[user_id].update_direction(dir_map[direction])
        
        elif action == "leave_room":
            if user_id in self.user_rooms:
                room_id = self.user_rooms[user_id]
                self.disconnect(user_id)
                await self.broadcast_to_room({
                    "type": "player_left",
                    "player_id": user_id
                }, room_id)
    
    async def game_loop(self):
        while True:
            start_time = time.time()
            
            # Update all rooms
            for room_id, room in self.rooms.items():
                room.update()
                
                # Send game state to all players in room
                state = room.get_state()
                await self.broadcast_to_room({
                    "type": "game_state",
                    "state": state,
                    "leaderboard": room.get_leaderboard()
                }, room_id)
            
            # Calculate sleep time to maintain tick rate
            elapsed = time.time() - start_time
            sleep_time = max(0, 1.0 / 60 - elapsed)
            await asyncio.sleep(sleep_time)

manager = ConnectionManager()