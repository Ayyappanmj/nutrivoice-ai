"""
Model Context Protocol (MCP) Server for NutriVoice AI
Exposes standardized nutrition and wellness tools for Alexa+ & Bedrock Converse agents.
"""
from datetime import datetime, date as dt_date
import json
import logging
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, Query, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from aws_bedrock_service import AWSBedrockService, CONVERSE_TOOLS_SPEC
from database import SessionLocal
from models import FoodEntryRecord, HealthLog, MedicationSchedule, PantryItem, UserDailyGoal, UserProfile
from schemas import (
    DailySummaryInput,
    DailySummaryResponse,
    DisambiguationNotice,
    FoodEntryResponse,
    FoodItem,
    LogFoodEntryInput,
    NutritionRecommendationInput,
    NutritionRecommendationResponse,
)

logger = logging.getLogger("nutrivoice.mcp")
mcp_app = APIRouter(prefix="/mcp", tags=["Model Context Protocol"])
bedrock_service = AWSBedrockService()

# In-memory circular buffer for recent tool monitoring payloads
RECENT_TOOL_MONITOR_LOGS: List[Dict[str, Any]] = []
MAX_MONITOR_LOGS = 20


def record_monitor_log(
    tool_name: str,
    direction: str,
    payload: Dict[str, Any],
    latency_ms: float = 0.0,
    status: str = "success"
):
    entry = {
        "id": f"log_{int(time.time() * 1000)}_{len(RECENT_TOOL_MONITOR_LOGS)}",
        "timestamp": datetime.utcnow().strftime("%H:%M:%S.%f")[:-3],
        "tool": tool_name,
        "direction": direction,
        "status": status,
        "latency_ms": latency_ms,
        "payload": payload
    }
    RECENT_TOOL_MONITOR_LOGS.insert(0, entry)
    if len(RECENT_TOOL_MONITOR_LOGS) > MAX_MONITOR_LOGS:
        RECENT_TOOL_MONITOR_LOGS.pop()


# --------------------------------------------------------------------------
# MCP Tool 1: log_food_entry
# --------------------------------------------------------------------------
async def log_food_entry_core(input_data: LogFoodEntryInput, db: Session) -> FoodEntryResponse:
    """
    Core business logic for logging food entries, calculating cumulative macronutrients,
    and flagging ambiguous items for Alexa clarification.
    """
    total_cal = sum(item.calories for item in input_data.items)
    total_pro = sum(item.protein_g for item in input_data.items)
    total_car = sum(item.carbs_g for item in input_data.items)
    total_fat = sum(item.fat_g for item in input_data.items)
    total_fib = sum(item.fiber_g for item in input_data.items)

    ambiguous_items = [item.name for item in input_data.items if item.is_ambiguous]
    has_ambiguity = len(ambiguous_items) > 0
    disambiguation_notice = None

    if has_ambiguity:
        prompts = [
            item.disambiguation_prompt
            for item in input_data.items
            if item.is_ambiguous and item.disambiguation_prompt
        ]
        clarification_msg = prompts[0] if prompts else f"Could you provide more details regarding {', '.join(ambiguous_items)}?"
        disambiguation_notice = DisambiguationNotice(
            needs_clarification=True,
            ambiguous_items=ambiguous_items,
            alexa_prompt=clarification_msg
        )

    # Derive title
    item_names = [i.name for i in input_data.items]
    if len(item_names) == 1:
        meal_title = item_names[0]
    elif len(item_names) == 2:
        meal_title = f"{item_names[0]} & {item_names[1]}"
    else:
        meal_title = f"{item_names[0]}, {item_names[1]} + {len(item_names)-2} more"

    timestamp_dt = datetime.utcnow()
    if input_data.timestamp:
        try:
            timestamp_dt = datetime.fromisoformat(input_data.timestamp.replace("Z", "+00:00"))
        except Exception:
            timestamp_dt = datetime.utcnow()

    entry_record = FoodEntryRecord(
        user_id=input_data.user_id,
        meal_type=input_data.meal_type.value,
        meal_title=meal_title,
        total_calories=round(total_cal, 1),
        total_protein_g=round(total_pro, 1),
        total_carbs_g=round(total_car, 1),
        total_fat_g=round(total_fat, 1),
        total_fiber_g=round(total_fib, 1),
        items_json=json.dumps([item.model_dump() for item in input_data.items]),
        source="Alexa Echo Show",
        has_ambiguity=1 if has_ambiguity else 0,
        disambiguation_prompt=disambiguation_notice.alexa_prompt if disambiguation_notice else None,
        logged_at=timestamp_dt
    )
    db.add(entry_record)
    db.commit()
    db.refresh(entry_record)

    return FoodEntryResponse(
        status="success",
        entry_id=entry_record.id,
        meal_type=entry_record.meal_type,
        total_calories=entry_record.total_calories,
        total_protein_g=entry_record.total_protein_g,
        total_carbs_g=entry_record.total_carbs_g,
        total_fat_g=entry_record.total_fat_g,
        total_fiber_g=entry_record.total_fiber_g,
        items=input_data.items,
        disambiguation=disambiguation_notice,
        logged_at=entry_record.logged_at.isoformat()
    )


# --------------------------------------------------------------------------
# MCP Tool 2: get_daily_summary
# --------------------------------------------------------------------------
async def get_daily_summary_core(input_data: DailySummaryInput, db: Session) -> DailySummaryResponse:
    """
    Computes daily macronutrient totals, remaining target budget, and adherence score.
    """
    target_date_str = input_data.date or dt_date.today().isoformat()
    try:
        query_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except Exception:
        query_date = dt_date.today()
        target_date_str = query_date.isoformat()

    # Retrieve user goals
    goal = db.query(UserDailyGoal).filter(UserDailyGoal.user_id == input_data.user_id).first()
    target_cal = goal.target_calories if goal else 2200.0
    target_pro = goal.target_protein_g if goal else 160.0
    target_car = goal.target_carbs_g if goal else 220.0
    target_fat = goal.target_fat_g if goal else 65.0

    # Query entries for date
    entries = db.query(FoodEntryRecord).filter(
        FoodEntryRecord.user_id == input_data.user_id
    ).all()

    # Filter by date in python for SQLite date-compatibility
    day_entries = [e for e in entries if e.logged_at.date() == query_date]

    consumed_cal = sum(e.total_calories for e in day_entries)
    consumed_pro = sum(e.total_protein_g for e in day_entries)
    consumed_car = sum(e.total_carbs_g for e in day_entries)
    consumed_fat = sum(e.total_fat_g for e in day_entries)
    total_fib = sum(e.total_fiber_g for e in day_entries)

    # Format meals
    meal_list = []
    for e in day_entries:
        try:
            items_parsed = json.loads(e.items_json)
        except Exception:
            items_parsed = []
        meal_list.append({
            "id": e.id,
            "meal_type": e.meal_type,
            "meal_title": e.meal_title,
            "time": e.logged_at.strftime("%I:%M %p"),
            "calories": e.total_calories,
            "protein_g": e.total_protein_g,
            "carbs_g": e.total_carbs_g,
            "fat_g": e.total_fat_g,
            "fiber_g": e.total_fiber_g,
            "source": e.source,
            "has_ambiguity": bool(e.has_ambiguity),
            "disambiguation_prompt": e.disambiguation_prompt,
            "items": items_parsed
        })

    # Adherence score calculation (closeness to target)
    cal_ratio = min(consumed_cal / target_cal, 1.0) if target_cal else 1.0
    pro_ratio = min(consumed_pro / target_pro, 1.0) if target_pro else 1.0
    adherence = round(((cal_ratio * 0.5) + (pro_ratio * 0.5)) * 100, 1)

    return DailySummaryResponse(
        date=target_date_str,
        user_id=input_data.user_id,
        target_calories=target_cal,
        consumed_calories=round(consumed_cal, 1),
        remaining_calories=round(max(0.0, target_cal - consumed_cal), 1),
        target_protein_g=target_pro,
        consumed_protein_g=round(consumed_pro, 1),
        remaining_protein_g=round(max(0.0, target_pro - consumed_pro), 1),
        target_carbs_g=target_car,
        consumed_carbs_g=round(consumed_car, 1),
        remaining_carbs_g=round(max(0.0, target_car - consumed_car), 1),
        target_fat_g=target_fat,
        consumed_fat_g=round(consumed_fat, 1),
        remaining_fat_g=round(max(0.0, target_fat - consumed_fat), 1),
        total_fiber_g=round(total_fib, 1),
        meal_count=len(day_entries),
        meals=meal_list,
        adherence_score=adherence
    )


# --------------------------------------------------------------------------
# MCP Tool 3: get_nutrition_recommendation
# --------------------------------------------------------------------------
async def get_nutrition_recommendation_core(input_data: NutritionRecommendationInput) -> NutritionRecommendationResponse:
    """
    Formulates clinical nutrition and macro recommendations aligned with specific user goals.
    """
    goal = input_data.user_goal.lower()
    target_cal = input_data.target_calories

    if "muscle" in goal or "bulk" in goal:
        cal = target_cal or 2600.0
        macros = {"protein_g": 195.0, "carbs_g": 280.0, "fat_g": 75.0, "fiber_g": 38.0}
        rationale = "Hypertrophy-focused protocol: 2.2g protein per kg of bodyweight with complex carbohydrates timing around training."
        meals = [
            {"meal": "Breakfast", "recommendation": "Egg whites + 2 whole eggs, steel-cut oats with whey isolate & berries"},
            {"meal": "Post-Workout", "recommendation": "Dextrose or banana with 40g whey protein isolate"},
            {"meal": "Dinner", "recommendation": "Grilled wild salmon (220g) with roasted sweet potato & steamed asparagus"}
        ]
        voice = f"For muscle gain, your target is {cal:.0f} calories with 195 grams of protein. Emphasize post-workout nutrient timing."
    elif "loss" in goal or "cut" in goal or "burn" in goal:
        cal = target_cal or 1850.0
        macros = {"protein_g": 170.0, "carbs_g": 130.0, "fat_g": 55.0, "fiber_g": 40.0}
        rationale = "Thermogenic moderate-deficit protocol: elevated protein intake to preserve lean mass while inducing adipose oxidation."
        meals = [
            {"meal": "Breakfast", "recommendation": "Greek yogurt (0%) with flaxseeds and organic blueberries"},
            {"meal": "Lunch", "recommendation": "Grilled chicken breast with large Mediterranean leafy green salad & olive oil mist"},
            {"meal": "Dinner", "recommendation": "Baked Atlantic cod fillet with broccoli florets & riced cauliflower"}
        ]
        voice = f"For fat loss, your daily target is {cal:.0f} calories with a high protein ceiling of 170 grams to protect lean tissue."
    elif "keto" in goal:
        cal = target_cal or 2000.0
        macros = {"protein_g": 130.0, "carbs_g": 25.0, "fat_g": 155.0, "fiber_g": 28.0}
        rationale = "Ketogenic mitochondrial protocol: under 30g net carbs to maintain nutritional ketosis with elevated MCT and healthy monounsaturated fats."
        meals = [
            {"meal": "Breakfast", "recommendation": "Avocado and pastured egg scramble with spinach & extra virgin olive oil"},
            {"meal": "Lunch", "recommendation": "Cobb salad with bacon, blue cheese, avocado, and grilled chicken"},
            {"meal": "Dinner", "recommendation": "Grass-fed ribeye steak with sauteed kale in grass-fed butter"}
        ]
        voice = f"For ketogenic adaptation, maintain net carbs strictly below 25 grams and prioritize healthy fats."
    else:
        cal = target_cal or 2200.0
        macros = {"protein_g": 160.0, "carbs_g": 220.0, "fat_g": 65.0, "fiber_g": 35.0}
        rationale = "Balanced Mediterranean protocol: dynamic macronutrient equilibrium for sustained metabolic vitality."
        meals = [
            {"meal": "Breakfast", "recommendation": "Overnight oats with chia, walnuts, and protein powder"},
            {"meal": "Lunch", "recommendation": "Grilled salmon with quinoa & half an avocado"},
            {"meal": "Dinner", "recommendation": "Herb-roasted turkey breast with quinoa pilaf and mixed greens"}
        ]
        voice = f"Your daily balanced target is {cal:.0f} calories with 160 grams of protein and 220 grams of carbohydrates."

    return NutritionRecommendationResponse(
        user_goal=input_data.user_goal,
        daily_caloric_target=cal,
        macro_distribution=macros,
        suggested_meals=meals,
        clinical_rationale=rationale,
        voice_response_summary=voice
    )


# --------------------------------------------------------------------------
# MCP Spec Endpoint: /mcp/tools/list
# --------------------------------------------------------------------------
@mcp_app.get("/tools/list")
async def list_mcp_tools():
    """
    Standard Model Context Protocol tool catalog discovery.
    Returns full tool definitions compatible with Bedrock Converse toolConfig.
    """
    tools_catalog = [
        {
            "name": "log_food_entry",
            "description": "Logs meal items with detailed macronutrient breakdown into user's health record.",
            "input_schema": CONVERSE_TOOLS_SPEC[0]["toolSpec"]["inputSchema"]["json"]
        },
        {
            "name": "get_daily_summary",
            "description": "Retrieves daily nutritional summary, consumed macros, and target delta.",
            "input_schema": CONVERSE_TOOLS_SPEC[1]["toolSpec"]["inputSchema"]["json"]
        },
        {
            "name": "get_nutrition_recommendation",
            "description": "Provides clinical nutritional recommendations, target macros, and meal suggestions.",
            "input_schema": CONVERSE_TOOLS_SPEC[2]["toolSpec"]["inputSchema"]["json"]
        },
        {
            "name": "get_personalized_recipe",
            "description": "Generates a personalized recipe using user's available pantry items.",
            "input_schema": CONVERSE_TOOLS_SPEC[3]["toolSpec"]["inputSchema"]["json"]
        },
        {
            "name": "log_health_metric",
            "description": "Logs health or wellness metrics such as blood sugar, water intake, or weight.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer"},
                    "metric_type": {"type": "string"},
                    "value": {"type": "number"},
                    "unit": {"type": "string"},
                    "notes": {"type": "string"}
                },
                "required": ["user_id", "metric_type", "value", "unit"]
            }
        },
        {
            "name": "check_medication_schedule",
            "description": "Retrieves active medication schedules and reminders for user.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer"}
                },
                "required": ["user_id"]
            }
        }
    ]
    return {"tools": tools_catalog}


# --------------------------------------------------------------------------
# MCP Spec Endpoint: /mcp/tools/call
# --------------------------------------------------------------------------
@mcp_app.post("/tools/call")
async def call_mcp_tool(payload: Dict[str, Any] = Body(...)):
    """
    Executes an MCP tool with strict Pydantic validation, performance timing,
    and structured monitoring logging.
    """
    start_time = time.perf_counter()
    tool_name = payload.get("tool")
    arguments = payload.get("arguments", {})

    record_monitor_log(tool_name=tool_name or "unknown", direction="INCOMING", payload=payload)

    db = SessionLocal()
    try:
        if tool_name == "log_food_entry":
            try:
                validated_input = LogFoodEntryInput(**arguments)
            except ValidationError as ve:
                raise HTTPException(status_code=422, detail=ve.errors())
            result_obj = await log_food_entry_core(validated_input, db)
            result = result_obj.model_dump()

        elif tool_name == "get_daily_summary":
            try:
                validated_input = DailySummaryInput(**arguments)
            except ValidationError as ve:
                raise HTTPException(status_code=422, detail=ve.errors())
            result_obj = await get_daily_summary_core(validated_input, db)
            result = result_obj.model_dump()

        elif tool_name == "get_nutrition_recommendation":
            try:
                validated_input = NutritionRecommendationInput(**arguments)
            except ValidationError as ve:
                raise HTTPException(status_code=422, detail=ve.errors())
            result_obj = await get_nutrition_recommendation_core(validated_input)
            result = result_obj.model_dump()

        elif tool_name == "get_personalized_recipe":
            user_id = arguments.get("user_id", 1)
            user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
            pantry = db.query(PantryItem).filter(PantryItem.user_id == user_id).all()
            pantry_list = [{"item_name": p.item_name, "quantity": p.quantity} for p in pantry]
            recipe = bedrock_service.generate_recipe(
                pantry_items=pantry_list,
                preferences=user.dietary_preferences if user else "balanced",
                allergies=user.allergies if user else ""
            )
            result = {"recipe": recipe}

        elif tool_name == "log_health_metric":
            log_entry = HealthLog(
                user_id=arguments.get("user_id", 1),
                metric_type=arguments.get("metric_type", "hydration"),
                value=float(arguments.get("value", 0.0)),
                unit=arguments.get("unit", "ml"),
                notes=arguments.get("notes", "")
            )
            db.add(log_entry)
            db.commit()
            result = f"Successfully logged {log_entry.metric_type}: {log_entry.value} {log_entry.unit} for user ID {log_entry.user_id}."

        elif tool_name == "check_medication_schedule":
            user_id = arguments.get("user_id", 1)
            meds = db.query(MedicationSchedule).filter(
                MedicationSchedule.user_id == user_id,
                MedicationSchedule.status == "active"
            ).all()
            if not meds:
                result = f"No active medications scheduled for user ID {user_id}."
            else:
                summary = [f"- {m.medication_name} ({m.dosage}) at {m.schedule_time}" for m in meds]
                result = "Active Medication Schedule:\n" + "\n".join(summary)

        else:
            raise HTTPException(status_code=404, detail=f"MCP Tool '{tool_name}' not found.")

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response_body = {
            "status": "success",
            "tool": tool_name,
            "latency_ms": latency_ms,
            "result": result
        }

        record_monitor_log(
            tool_name=tool_name,
            direction="OUTGOING",
            payload=response_body,
            latency_ms=latency_ms,
            status="success"
        )
        return response_body

    except HTTPException:
        raise
    except Exception as e:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(f"Error executing MCP tool '{tool_name}': {e}")
        record_monitor_log(
            tool_name=tool_name or "error",
            direction="ERROR",
            payload={"error": str(e)},
            latency_ms=latency_ms,
            status="error"
        )
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# --------------------------------------------------------------------------
# Agentic Pipeline: Voice Hero Orchestration Endpoint
# --------------------------------------------------------------------------
@mcp_app.post("/voice/converse")
async def voice_converse_pipeline(payload: Dict[str, Any] = Body(...)):
    """
    Full end-to-end conversational agent orchestration:
    Voice Prompt -> Bedrock Converse API -> MCP Tool Execution -> DB Commit -> Thought Breakdown.
    """
    prompt = payload.get("prompt", "Alexa, log a grilled salmon with quinoa and avocado")
    start_time = time.perf_counter()

    # Step 1: Call Bedrock Converse API
    bedrock_response = bedrock_service.converse_with_tools(prompt)

    thought_steps = [
        {
            "step": 1,
            "name": "Intent Recognition",
            "status": "completed",
            "detail": f"Recognized intent from voice stream: '{prompt}'",
            "timestamp": "0ms"
        }
    ]

    executed_tools = []
    tool_calls = bedrock_response.get("tool_calls", [])
    has_ambiguity = False
    clarification_prompt = None

    db = SessionLocal()
    try:
        if tool_calls:
            # Step 2: Extraction
            extracted_items_str = ", ".join([
                f"{item.get('name')} ({item.get('calories')} kcal)"
                for tc in tool_calls
                for item in tc.get("input", {}).get("items", [])
            ])
            thought_steps.append({
                "step": 2,
                "name": "Entity Extraction",
                "status": "completed",
                "detail": f"Extracted macro components: {extracted_items_str or 'Nutritional query parameters'}",
                "timestamp": f"{round(bedrock_response.get('latency_ms', 150)*0.4)}ms"
            })

            # Step 3: MCP Tool Call
            for tc in tool_calls:
                tc_name = tc.get("name")
                tc_input = tc.get("input", {})
                call_res = await call_mcp_tool({"tool": tc_name, "arguments": tc_input})
                executed_tools.append(call_res)

                # Check if ambiguity notice returned
                if tc_name == "log_food_entry":
                    res_val = call_res.get("result", {})
                    disambig = res_val.get("disambiguation")
                    if disambig and disambig.get("needs_clarification"):
                        has_ambiguity = True
                        clarification_prompt = disambig.get("alexa_prompt")

            thought_steps.append({
                "step": 3,
                "name": "MCP Tool Call",
                "status": "completed",
                "detail": f"Dispatched {len(tool_calls)} tool call(s) via MCP protocol to local server.",
                "timestamp": f"{round(bedrock_response.get('latency_ms', 250)*0.8)}ms"
            })

            # Step 4: Database Commit
            thought_steps.append({
                "step": 4,
                "name": "Database Commit",
                "status": "completed",
                "detail": "Committed nutrition entries and recalculated daily macro balance.",
                "timestamp": f"{round(bedrock_response.get('latency_ms', 300))}ms"
            })
        else:
            thought_steps.append({
                "step": 2,
                "name": "Direct Synthesis",
                "status": "completed",
                "detail": "Synthesized conversational response via Claude 3.5 Sonnet.",
                "timestamp": f"{round(bedrock_response.get('latency_ms', 200))}ms"
            })

        total_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "status": "success",
            "prompt": prompt,
            "bedrock_mode": bedrock_response.get("mode"),
            "model_id": bedrock_response.get("model_id"),
            "latency_ms": total_latency_ms,
            "tokens": bedrock_response.get("tokens", {}),
            "voice_response": clarification_prompt or bedrock_response.get("text"),
            "has_ambiguity": has_ambiguity,
            "disambiguation_prompt": clarification_prompt,
            "thought_pipeline": thought_steps,
            "executed_tools": executed_tools
        }
    finally:
        db.close()


# --------------------------------------------------------------------------
# Dashboard Support Endpoints: Meals CRUD & Target Rings
# --------------------------------------------------------------------------
@mcp_app.get("/meals")
def get_meals_stream(limit: int = 20):
    """Returns recent meal records for the Recent Meals Stream table."""
    db = SessionLocal()
    try:
        records = db.query(FoodEntryRecord).order_by(FoodEntryRecord.logged_at.desc()).limit(limit).all()
        result = []
        for r in records:
            try:
                items_parsed = json.loads(r.items_json)
            except Exception:
                items_parsed = []
            result.append({
                "id": r.id,
                "meal_type": r.meal_type,
                "meal_title": r.meal_title,
                "time": r.logged_at.strftime("%I:%M %p"),
                "date": r.logged_at.strftime("%Y-%m-%d"),
                "calories": r.total_calories,
                "protein_g": r.total_protein_g,
                "carbs_g": r.total_carbs_g,
                "fat_g": r.total_fat_g,
                "fiber_g": r.total_fiber_g,
                "source": r.source,
                "has_ambiguity": bool(r.has_ambiguity),
                "disambiguation_prompt": r.disambiguation_prompt,
                "items": items_parsed
            })
        return {"meals": result}
    finally:
        db.close()


@mcp_app.put("/meals/{meal_id}")
def update_meal(meal_id: int, payload: Dict[str, Any] = Body(...)):
    """Updates an existing meal entry and recalculates macro totals."""
    db = SessionLocal()
    try:
        record = db.query(FoodEntryRecord).filter(FoodEntryRecord.id == meal_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Meal not found")

        if "meal_type" in payload:
            record.meal_type = payload["meal_type"]
        if "meal_title" in payload:
            record.meal_title = payload["meal_title"]
        if "calories" in payload:
            record.total_calories = float(payload["calories"])
        if "protein_g" in payload:
            record.total_protein_g = float(payload["protein_g"])
        if "carbs_g" in payload:
            record.total_carbs_g = float(payload["carbs_g"])
        if "fat_g" in payload:
            record.total_fat_g = float(payload["fat_g"])
        if "fiber_g" in payload:
            record.total_fiber_g = float(payload["fiber_g"])

        db.commit()
        db.refresh(record)
        return {"status": "success", "message": "Meal updated successfully", "meal_id": record.id}
    finally:
        db.close()


@mcp_app.delete("/meals/{meal_id}")
def delete_meal(meal_id: int):
    """Deletes a meal entry."""
    db = SessionLocal()
    try:
        record = db.query(FoodEntryRecord).filter(FoodEntryRecord.id == meal_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Meal not found")
        db.delete(record)
        db.commit()
        return {"status": "success", "message": f"Meal #{meal_id} deleted."}
    finally:
        db.close()


@mcp_app.get("/targets/daily")
async def get_daily_targets(date: Optional[str] = Query(None)):
    """Returns radial target gauges data (Calories 2200 target / 1450 consumed, etc.)."""
    db = SessionLocal()
    try:
        summary_in = DailySummaryInput(user_id=1, date=date)
        summary = await get_daily_summary_core(summary_in, db)
        return summary
    finally:
        db.close()


@mcp_app.get("/monitor/logs")
def get_monitor_logs():
    """Returns recent MCP tool JSON payloads for the Bedrock MCP Tool Monitor panel."""
    return {"logs": RECENT_TOOL_MONITOR_LOGS}
