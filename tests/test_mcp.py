"""
Pytest test suite for NutriVoice AI MCP Server & Bedrock Converse integration.
Tests tool listing, food entry logging, daily summaries, ambiguity detection, and voice agent pipeline.
"""
import os
import sys
import json
import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, SessionLocal, engine
from main import app, seed_initial_data
from models import FoodEntryRecord, MedicationSchedule, PantryItem, UserDailyGoal, UserProfile

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    yield


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    if response.headers.get("content-type") == "application/json":
        assert response.json()["project"] == "NutriVoice AI"


def test_list_mcp_tools():
    response = client.get("/mcp/tools/list")
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    tool_names = [t["name"] for t in data["tools"]]
    assert "log_food_entry" in tool_names
    assert "get_daily_summary" in tool_names
    assert "get_nutrition_recommendation" in tool_names
    assert "get_personalized_recipe" in tool_names
    assert "log_health_metric" in tool_names
    assert "check_medication_schedule" in tool_names


def test_call_mcp_log_food_entry_success():
    payload = {
        "tool": "log_food_entry",
        "arguments": {
            "user_id": 1,
            "meal_type": "lunch",
            "items": [
                {
                    "name": "Grilled Wild Salmon",
                    "portion": "1 fillet (180g)",
                    "calories": 340.0,
                    "protein_g": 38.0,
                    "carbs_g": 0.0,
                    "fat_g": 18.0,
                    "fiber_g": 0.0,
                    "is_ambiguous": False
                },
                {
                    "name": "Organic Quinoa",
                    "portion": "1 cup (185g)",
                    "calories": 222.0,
                    "protein_g": 8.0,
                    "carbs_g": 39.0,
                    "fat_g": 3.5,
                    "fiber_g": 5.2,
                    "is_ambiguous": False
                }
            ]
        }
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["tool"] == "log_food_entry"
    assert data["result"]["total_calories"] == 562.0
    assert data["result"]["total_protein_g"] == 46.0
    assert "entry_id" in data["result"]


def test_call_mcp_log_food_entry_ambiguity_fallback():
    payload = {
        "tool": "log_food_entry",
        "arguments": {
            "user_id": 1,
            "meal_type": "dinner",
            "items": [
                {
                    "name": "Pizza Slice",
                    "portion": "1 regular slice",
                    "calories": 285.0,
                    "protein_g": 12.0,
                    "carbs_g": 36.0,
                    "fat_g": 10.4,
                    "fiber_g": 2.1,
                    "is_ambiguous": True,
                    "disambiguation_prompt": "Was your pizza slice cheese, pepperoni, or veggie, and was it regular or deep dish?"
                }
            ]
        }
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    data = response.json()
    result = data["result"]
    assert result["disambiguation"] is not None
    assert result["disambiguation"]["needs_clarification"] is True
    assert "Pizza Slice" in result["disambiguation"]["ambiguous_items"]
    assert "pepperoni" in result["disambiguation"]["alexa_prompt"]


def test_call_mcp_get_daily_summary():
    payload = {
        "tool": "get_daily_summary",
        "arguments": {
            "user_id": 1
        }
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    data = response.json()
    res = data["result"]
    assert res["target_calories"] == 2200.0
    assert res["target_protein_g"] == 160.0
    assert res["consumed_calories"] >= 0
    assert "adherence_score" in res


def test_call_mcp_get_nutrition_recommendation():
    payload = {
        "tool": "get_nutrition_recommendation",
        "arguments": {
            "user_id": 1,
            "user_goal": "muscle_gain",
            "target_calories": 2600.0
        }
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    data = response.json()
    res = data["result"]
    assert res["user_goal"] == "muscle_gain"
    assert res["daily_caloric_target"] == 2600.0
    assert "protein_g" in res["macro_distribution"]
    assert len(res["suggested_meals"]) > 0


def test_voice_converse_agent_pipeline():
    payload = {
        "prompt": "Alexa, log a grilled salmon with quinoa and avocado"
    }
    response = client.post("/mcp/voice/converse", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "latency_ms" in data
    assert "tokens" in data
    assert len(data["thought_pipeline"]) >= 3
    assert any("Intent" in step["name"] for step in data["thought_pipeline"])


def test_call_mcp_health_log():
    payload = {
        "tool": "log_health_metric",
        "arguments": {
            "user_id": 1,
            "metric_type": "water_intake",
            "value": 500.0,
            "unit": "ml",
            "notes": "Post workout hydration",
        },
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    assert "Successfully logged" in response.json()["result"]


def test_call_mcp_medication_schedule():
    payload = {
        "tool": "check_medication_schedule",
        "arguments": {"user_id": 1},
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    assert "status" in response.json()


def test_call_mcp_recipe_generation():
    payload = {
        "tool": "get_personalized_recipe",
        "arguments": {"user_id": 1},
    }
    response = client.post("/mcp/tools/call", json=payload)
    assert response.status_code == 200
    res_val = response.json()["result"]
    assert "recipe" in res_val
    assert "Protein" in res_val["recipe"] or "Recipe" in res_val["recipe"] or "Bowl" in res_val["recipe"]


def test_meals_feed_and_daily_targets():
    meals_resp = client.get("/mcp/meals")
    assert meals_resp.status_code == 200
    meals = meals_resp.json()["meals"]
    assert len(meals) >= 1

    targets_resp = client.get("/mcp/targets/daily")
    assert targets_resp.status_code == 200
    t_data = targets_resp.json()
    assert t_data["target_calories"] == 2200.0
    assert t_data["target_protein_g"] == 160.0
