"""
Pydantic schemas for NutriVoice AI - Model Context Protocol & Bedrock Converse API
Strict schema definitions for food entries, macro summaries, and nutrition recommendations.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class FoodItem(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the food item, e.g. 'Grilled Salmon'")
    portion: str = Field(default="1 serving", description="Portion size, e.g. '200g', '1 cup', '1 slice'")
    calories: float = Field(..., ge=0, description="Estimated calories (kcal)")
    protein_g: float = Field(..., ge=0, description="Protein in grams")
    carbs_g: float = Field(..., ge=0, description="Carbohydrates in grams")
    fat_g: float = Field(..., ge=0, description="Fat in grams")
    fiber_g: float = Field(default=0.0, ge=0, description="Dietary fiber in grams")
    is_ambiguous: bool = Field(default=False, description="Flag indicating if the food item lacks size, topping, or preparation details")
    disambiguation_prompt: Optional[str] = Field(
        default=None,
        description="Structured follow-up question for Alexa to clarify toppings, crust, preparation, or size"
    )

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Food item name cannot be empty")
        return clean


class LogFoodEntryInput(BaseModel):
    user_id: int = Field(default=1, description="Unique user identifier")
    meal_type: MealType = Field(..., description="Meal category: breakfast, lunch, dinner, snack")
    items: List[FoodItem] = Field(..., min_length=1, description="List of recognized food items")
    timestamp: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp or time string (e.g. '2026-10-15T12:30:00Z')"
    )


class DailySummaryInput(BaseModel):
    user_id: int = Field(default=1, description="Unique user identifier")
    date: Optional[str] = Field(
        default=None,
        description="Date in YYYY-MM-DD format (defaults to current date if omitted)"
    )


class NutritionRecommendationInput(BaseModel):
    user_id: int = Field(default=1, description="Unique user identifier")
    user_goal: str = Field(
        ...,
        description="Nutritional or fitness goal, e.g. 'muscle_gain', 'fat_loss', 'keto_adaptation', 'endurance', 'cardiac_health'"
    )
    target_calories: Optional[float] = Field(default=None, ge=500, le=10000, description="Optional daily caloric target")
    dietary_preference: Optional[str] = Field(default=None, description="e.g. 'high-protein', 'vegan', 'keto', 'mediterranean'")


# Output schemas
class DisambiguationNotice(BaseModel):
    needs_clarification: bool = False
    ambiguous_items: List[str] = Field(default_factory=list)
    alexa_prompt: Optional[str] = None


class FoodEntryResponse(BaseModel):
    status: str
    entry_id: Optional[int] = None
    meal_type: str
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_fiber_g: float
    items: List[FoodItem]
    disambiguation: Optional[DisambiguationNotice] = None
    logged_at: str


class DailySummaryResponse(BaseModel):
    date: str
    user_id: int
    target_calories: float = 2200.0
    consumed_calories: float
    remaining_calories: float
    target_protein_g: float = 160.0
    consumed_protein_g: float
    remaining_protein_g: float
    target_carbs_g: float = 220.0
    consumed_carbs_g: float
    remaining_carbs_g: float
    target_fat_g: float = 65.0
    consumed_fat_g: float
    remaining_fat_g: float
    total_fiber_g: float
    meal_count: int
    meals: List[Dict[str, Any]]
    adherence_score: float  # Percentage, e.g. 92.5


class NutritionRecommendationResponse(BaseModel):
    user_goal: str
    daily_caloric_target: float
    macro_distribution: Dict[str, float]  # {'protein_g': 180, 'carbs_g': 200, 'fat_g': 60}
    suggested_meals: List[Dict[str, Any]]
    clinical_rationale: str
    voice_response_summary: str
