from datetime import datetime
from database import Base
from sqlalchemy import Column, DateTime, Float, Integer, String, Text


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    dietary_preferences = Column(
        String(255), default="balanced"
    )  # e.g., vegan, keto, gluten-free
    allergies = Column(
        String(255), default=""
    )  # e.g., peanuts, shellfish
    created_at = Column(DateTime, default=datetime.utcnow)


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    item_name = Column(String(100), nullable=False)
    quantity = Column(String(50), nullable=False)  # e.g., "500g", "2 pieces"
    category = Column(
        String(50), default="general"
    )  # produce, dairy, protein, pantry
    expiration_date = Column(String(20), nullable=True)


class HealthLog(Base):
    __tablename__ = "health_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    metric_type = Column(
        String(50), nullable=False
    )  # e.g., "blood_sugar", "weight", "water_intake"
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # e.g., "mg/dL", "kg", "ml"
    notes = Column(Text, nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    medication_name = Column(String(100), nullable=False)
    dosage = Column(String(50), nullable=False)
    schedule_time = Column(String(20), nullable=False)  # e.g., "08:00 AM"
    status = Column(
        String(20), default="active"
    )  # active, taken, skipped


class FoodEntryRecord(Base):
    __tablename__ = "food_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False, default=1)
    meal_type = Column(String(50), nullable=False)  # breakfast, lunch, dinner, snack
    meal_title = Column(String(150), nullable=True)  # e.g. "Grilled Salmon with Quinoa & Avocado"
    total_calories = Column(Float, nullable=False, default=0.0)
    total_protein_g = Column(Float, nullable=False, default=0.0)
    total_carbs_g = Column(Float, nullable=False, default=0.0)
    total_fat_g = Column(Float, nullable=False, default=0.0)
    total_fiber_g = Column(Float, nullable=False, default=0.0)
    items_json = Column(Text, nullable=False)  # JSON serialized list of FoodItem dictionaries
    source = Column(String(50), default="Alexa Echo Show")  # Alexa Echo Show, Voice MCP, Web
    has_ambiguity = Column(Integer, default=0)  # 1 if disambiguation occurred
    disambiguation_prompt = Column(String(255), nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)


class UserDailyGoal(Base):
    __tablename__ = "user_daily_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True, nullable=False, default=1)
    target_calories = Column(Float, default=2200.0)
    target_protein_g = Column(Float, default=160.0)
    target_carbs_g = Column(Float, default=220.0)
    target_fat_g = Column(Float, default=65.0)
    target_fiber_g = Column(Float, default=35.0)
    updated_at = Column(DateTime, default=datetime.utcnow)

