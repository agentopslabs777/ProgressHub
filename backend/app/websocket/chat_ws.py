from typing import Dict, List, Set
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> Set of active WebSocket connections
        self.active_user_connections: Dict[str, Set[WebSocket]] = {}
        # Maps conversation_id -> Set of connected WebSockets
        self.conversation_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, conversation_id: str):
        await websocket.accept()
        if user_id not in self.active_user_connections:
            self.active_user_connections[user_id] = set()
        self.active_user_connections[user_id].add(websocket)

        if conversation_id not in self.conversation_rooms:
            self.conversation_rooms[conversation_id] = set()
        self.conversation_rooms[conversation_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str, conversation_id: str):
        if user_id in self.active_user_connections:
            self.active_user_connections[user_id].discard(websocket)
            if not self.active_user_connections[user_id]:
                del self.active_user_connections[user_id]

        if conversation_id in self.conversation_rooms:
            self.conversation_rooms[conversation_id].discard(websocket)
            if not self.conversation_rooms[conversation_id]:
                del self.conversation_rooms[conversation_id]

    async def broadcast_to_conversation(self, conversation_id: str, message_data: dict):
        if conversation_id in self.conversation_rooms:
            payload = json.dumps(message_data)
            dead_connections = set()
            for ws in self.conversation_rooms[conversation_id]:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead_connections.add(ws)
            for dead in dead_connections:
                self.conversation_rooms[conversation_id].discard(dead)

chat_manager = ConnectionManager()
