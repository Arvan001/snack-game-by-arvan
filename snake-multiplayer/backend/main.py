from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import uuid
import asyncio
from typing import List

from database import get_db, User, GameSession
from auth import authenticate_user, create_access_token, get_password_hash, get_current_user
from websocket_manager import manager
import models

app = FastAPI(title="Snake Multiplayer API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# API Routes
@app.post("/register")
async def register(username: str, password: str, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(password)
    user = User(
        username=username,
        password_hash=hashed_password,
        owned_skins=["default", "green", "blue", "red"]
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"message": "User created successfully", "user_id": user.id}

@app.post("/login")
async def login(username: str, password: str, db: Session = Depends(get_db)):
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    access_token = create_access_token(data={"sub": username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "total_score": user.total_score,
            "total_coins": user.total_coins,
            "owned_skins": user.owned_skins,
            "current_skin": user.current_skin
        }
    }

@app.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "total_score": current_user.total_score,
        "total_coins": current_user.total_coins,
        "owned_skins": current_user.owned_skins,
        "current_skin": current_user.current_skin,
        "games_played": current_user.games_played,
        "kills": current_user.kills,
        "deaths": current_user.deaths
    }

@app.get("/leaderboard")
async def get_global_leaderboard(db: Session = Depends(get_db), limit: int = 10):
    users = db.query(User).order_by(User.total_score.desc()).limit(limit).all()
    return [
        {
            "username": user.username,
            "total_score": user.total_score,
            "total_coins": user.total_coins,
            "games_played": user.games_played
        }
        for user in users
    ]

@app.post("/buy_skin")
async def buy_skin(skin_id: str, price: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.total_coins < price:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    if skin_id in current_user.owned_skins:
        raise HTTPException(status_code=400, detail="Skin already owned")
    
    current_user.total_coins -= price
    current_user.owned_skins.append(skin_id)
    db.commit()
    
    return {"message": "Skin purchased successfully"}

@app.post("/select_skin")
async def select_skin(skin_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if skin_id not in current_user.owned_skins:
        raise HTTPException(status_code=400, detail="Skin not owned")
    
    current_user.current_skin = skin_id
    db.commit()
    
    return {"message": "Skin selected successfully"}

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(client_id, data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@app.on_event("startup")
async def startup_event():
    # Start game loop in background
    asyncio.create_task(manager.game_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)