from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from datetime import datetime

# Gunakan PostgreSQL di Render, SQLite untuk lokal
if os.environ.get("RENDER"):
    DATABASE_URL = os.environ.get("DATABASE_URL")
    if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = "sqlite:///./snake.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(String, default=datetime.utcnow().isoformat())
    total_score = Column(Integer, default=0)
    total_coins = Column(Integer, default=0)
    owned_skins = Column(JSON, default=["default", "green", "blue"])
    current_skin = Column(String, default="default")
    games_played = Column(Integer, default=0)
    kills = Column(Integer, default=0)
    deaths = Column(Integer, default=0)

class GameSession(Base):
    __tablename__ = "game_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True)
    players = Column(JSON, default=[])
    start_time = Column(String)
    end_time = Column(String)
    winner = Column(String, nullable=True)
    room_type = Column(String)  # "private" or "global"

# Buat tabel
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()