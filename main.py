"""
NutriVoice AI Backend & MCP Server
FastAPI application connecting Alexa+ and AWS Bedrock Converse API with local health persistence.
"""
from datetime import datetime, timedelta
import json
import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import Base, SessionLocal, engine
from mcp_server import mcp_app, record_monitor_log
from models import FoodEntryRecord, HealthLog, MedicationSchedule, PantryItem, UserDailyGoal, UserProfile

# Create tables
Base.metadata.create_all(bind=engine)


def seed_initial_data():
    """Seeds default user profile, daily macro goals, and meals if not already present."""
    db = SessionLocal()
    try:
        user = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if not user:
            user = UserProfile(
                id=1,
                username="alexa_user",
                dietary_preferences="high-protein",
                allergies="peanuts"
            )
            db.add(user)
            db.commit()

        goal = db.query(UserDailyGoal).filter(UserDailyGoal.user_id == 1).first()
        if not goal:
            goal = UserDailyGoal(
                user_id=1,
                target_calories=2200.0,
                target_protein_g=160.0,
                target_carbs_g=220.0,
                target_fat_g=65.0,
                target_fiber_g=35.0
            )
            db.add(goal)
            db.commit()

        # Seed meals for today if table is empty
        entries_count = db.query(FoodEntryRecord).count()
        if entries_count == 0:
            now = datetime.utcnow()
            today_830am = datetime(now.year, now.month, now.day, 8, 30, 0)
            today_115pm = datetime(now.year, now.month, now.day, 13, 15, 0)
            today_445pm = datetime(now.year, now.month, now.day, 16, 45, 0)

            # Breakfast: 420 kcal, 18g P, 65g C, 10g F, 8g fiber
            meal_1 = FoodEntryRecord(
                user_id=1,
                meal_type="breakfast",
                meal_title="Steel-Cut Oats with Blueberries & Chia Seeds",
                total_calories=420.0,
                total_protein_g=18.0,
                total_carbs_g=65.0,
                total_fat_g=10.0,
                total_fiber_g=8.0,
                items_json=json.dumps([
                    {"name": "Steel-Cut Oats", "portion": "1 cup cooked", "calories": 250.0, "protein_g": 10.0, "carbs_g": 48.0, "fat_g": 4.0, "fiber_g": 5.0, "is_ambiguous": False},
                    {"name": "Fresh Blueberries", "portion": "1/2 cup", "calories": 42.0, "protein_g": 0.5, "carbs_g": 10.5, "fat_g": 0.2, "fiber_g": 1.8, "is_ambiguous": False},
                    {"name": "Chia Seeds & Whey", "portion": "1 tbsp + 10g scoop", "calories": 128.0, "protein_g": 7.5, "carbs_g": 6.5, "fat_g": 5.8, "fiber_g": 1.2, "is_ambiguous": False}
                ]),
                source="Alexa Echo Show",
                logged_at=today_830am
            )

            # Lunch: 722 kcal, 48g P, 47g C, 26g F, 11.9g fiber
            meal_2 = FoodEntryRecord(
                user_id=1,
                meal_type="lunch",
                meal_title="Grilled Salmon with Quinoa & Avocado",
                total_calories=722.0,
                total_protein_g=48.0,
                total_carbs_g=47.0,
                total_fat_g=26.0,
                total_fiber_g=11.9,
                items_json=json.dumps([
                    {"name": "Grilled Wild Salmon", "portion": "1 fillet (180g)", "calories": 340.0, "protein_g": 38.0, "carbs_g": 0.0, "fat_g": 18.0, "fiber_g": 0.0, "is_ambiguous": False},
                    {"name": "Cooked Quinoa", "portion": "1 cup (185g)", "calories": 222.0, "protein_g": 8.0, "carbs_g": 39.0, "fat_g": 3.5, "fiber_g": 5.2, "is_ambiguous": False},
                    {"name": "Hass Avocado", "portion": "1/2 medium", "calories": 160.0, "protein_g": 2.0, "carbs_g": 8.0, "fat_g": 4.5, "fiber_g": 6.7, "is_ambiguous": False}
                ]),
                source="Alexa Echo Show",
                logged_at=today_115pm
            )

            # Snack: 308 kcal, 56g P, 33g C, 6g F, 2.5g fiber
            # Total sum: 420 + 722 + 308 = 1450 kcal
            # Protein: 18 + 48 + 56 = 122g
            # Carbs: 65 + 47 + 33 = 145g
            # Fat: 10 + 26 + 6 = 42g
            meal_3 = FoodEntryRecord(
                user_id=1,
                meal_type="snack",
                meal_title="Greek Yogurt with Raw Almonds & Whey",
                total_calories=308.0,
                total_protein_g=56.0,
                total_carbs_g=33.0,
                total_fat_g=6.0,
                total_fiber_g=2.5,
                items_json=json.dumps([
                    {"name": "Nonfat Greek Yogurt", "portion": "1 cup (227g)", "calories": 130.0, "protein_g": 24.0, "carbs_g": 8.0, "fat_g": 0.0, "fiber_g": 0.0, "is_ambiguous": False},
                    {"name": "Whey Isolate Protein", "portion": "1 scoop (30g)", "calories": 120.0, "protein_g": 28.0, "carbs_g": 2.0, "fat_g": 1.0, "fiber_g": 0.0, "is_ambiguous": False},
                    {"name": "Raw Almonds & Honey", "portion": "10 almonds + 1 tsp honey", "calories": 58.0, "protein_g": 4.0, "carbs_g": 23.0, "fat_g": 5.0, "fiber_g": 2.5, "is_ambiguous": False}
                ]),
                source="Alexa Mobile",
                logged_at=today_445pm
            )

            db.add_all([meal_1, meal_2, meal_3])
            db.commit()

            # Record initial monitor log
            record_monitor_log(
                tool_name="log_food_entry",
                direction="OUTGOING",
                payload={
                    "tool": "log_food_entry",
                    "arguments": {
                        "meal_type": "lunch",
                        "items": [
                            {"name": "Grilled Salmon", "calories": 340, "protein_g": 38, "carbs_g": 0, "fat_g": 18},
                            {"name": "Quinoa", "calories": 222, "protein_g": 8, "carbs_g": 39, "fat_g": 3.5},
                            {"name": "Avocado", "calories": 160, "protein_g": 2, "carbs_g": 8, "fat_g": 4.5}
                        ]
                    },
                    "result": {"status": "success", "total_calories": 722, "total_protein_g": 48}
                },
                latency_ms=412.5,
                status="success"
            )
            record_monitor_log(
                tool_name="get_daily_summary",
                direction="OUTGOING",
                payload={"tool": "get_daily_summary", "arguments": {"date": now.strftime("%Y-%m-%d")}},
                latency_ms=194.2,
                status="success"
            )

    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    seed_initial_data()
    yield
    # Shutdown


app = FastAPI(
    title="NutriVoice AI Agent Backend",
    description="Model Context Protocol (MCP) server & Alexa+ backend powered by AWS Bedrock Converse API",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for local dev servers and frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include MCP Router
app.include_router(mcp_app)


class UserCreate(BaseModel):
    username: str
    dietary_preferences: str = "balanced"
    allergies: str = ""


class PantryCreate(BaseModel):
    user_id: int
    item_name: str
    quantity: str
    category: str = "general"
    expiration_date: str = None


class MedicationCreate(BaseModel):
    user_id: int
    medication_name: str
    dosage: str
    schedule_time: str


@app.get("/")
def read_root():
    static_index = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if os.path.exists(static_index):
        return FileResponse(
            static_index,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {
        "project": "NutriVoice AI",
        "track": "Alexa+ Track & AWS Builder Mini Challenge",
        "status": "active",
        "version": "2.0.0",
        "aws_region": os.getenv("AWS_REGION", "us-east-1"),
        "bedrock_model": os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0"),
        "endpoints": {
            "mcp_tools_list": "/mcp/tools/list",
            "mcp_tools_call": "/mcp/tools/call",
            "voice_converse": "/mcp/voice/converse",
            "meals_stream": "/mcp/meals",
            "daily_targets": "/mcp/targets/daily",
            "tool_monitor": "/mcp/monitor/logs"
        }
    }


@app.post("/users/", status_code=201)
def create_user(user: UserCreate):
    db = SessionLocal()
    try:
        db_user = UserProfile(
            username=user.username,
            dietary_preferences=user.dietary_preferences,
            allergies=user.allergies,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return {
            "message": "User created successfully",
            "user_id": db_user.id,
            "username": db_user.username,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400, detail=f"Error creating user: {str(e)}"
        )
    finally:
        db.close()


@app.post("/pantry/", status_code=201)
def add_pantry_item(item: PantryCreate):
    db = SessionLocal()
    try:
        db_item = PantryItem(
            user_id=item.user_id,
            item_name=item.item_name,
            quantity=item.quantity,
            category=item.category,
            expiration_date=item.expiration_date,
        )
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return {"message": "Pantry item added successfully", "item_id": db_item.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400, detail=f"Error adding pantry item: {str(e)}"
        )
    finally:
        db.close()


@app.post("/medications/", status_code=201)
def add_medication(med: MedicationCreate):
    db = SessionLocal()
    try:
        db_med = MedicationSchedule(
            user_id=med.user_id,
            medication_name=med.medication_name,
            dosage=med.dosage,
            schedule_time=med.schedule_time,
        )
        db.add(db_med)
        db.commit()
        db.refresh(db_med)
        return {
            "message": "Medication schedule added successfully",
            "med_id": db_med.id,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400, detail=f"Error adding medication: {str(e)}"
        )
    finally:
        db.close()


# Mount static directory and assets if present
static_dir = os.path.join(os.path.dirname(__file__), "static")
assets_dir = os.path.join(static_dir, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

