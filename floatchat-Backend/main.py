import os
import json
import re
import asyncio
import random
import certifi
import httpx
from contextlib import asynccontextmanager
from datetime import datetime
from functools import lru_cache
from typing import Dict, Any, List, Tuple, Optional

# FASTAPI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pydantic import BaseModel, Field, field_validator

# EXTERNAL LIBS
from dotenv import load_dotenv
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from openai import AsyncOpenAI

os.environ["SSL_CERT_FILE"] = certifi.where()
load_dotenv()


# Lifecycle Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Marine Knowledge Engine API starting up...")
    print(f"📊 Model: {MODEL_ANALYST}")
    print(f"🔧 Version: 5.0.0 (Full Suite Enabled)")
    yield
    print("🛑 Shutting down...")

app = FastAPI(
    title="Marine Knowledge Engine API",
    version="5.0.0",
    description="Unified API for Marine Biology, Climate Simulation, and Naval Intelligence.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Async Client
client = AsyncOpenAI(
    base_url=os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1"),
    api_key=os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "MarineKnowledgeEngine"
    }
)

# Initialize Free Geocoder (Rate: 1 req/sec max)


geolocator = Nominatim(user_agent="marine_knowledge_engine_v5")
geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)

# Models
MODEL_CHATBOT = "meta-llama/llama-3.3-70b-instruct:free"
MODEL_SENTINEL = MODEL_CHATBOT 
MODEL_ANALYST = MODEL_CHATBOT

# --------------------------------------------------
# 2. DATA MODELS
# --------------------------------------------------

# --- EXISTING MODELS ---
class ChatRequest(BaseModel):
    message: str

class SentinelRequest(BaseModel):
    context: str

class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float

class RouteComparisonRequest(BaseModel):
    chosen_route: dict
    alternate_routes: list[dict]
    vessel_speed: int = 20

class StormPayload(BaseModel):
    name: str
    wind: int
    lat: float
    lng: float
    category: str
    lifecycle: str
    affected_ships: int

class GeoPoint(BaseModel):
    lat: float
    lng: float

class Entity(BaseModel):
    id: str
    type: str
    name: str
    position: GeoPoint
    radiusNm: float
    severity: str
    attributes: Dict[str, Any] = {}

class Interaction(BaseModel):
    entityA: str
    entityB: str
    type: str
    severityScore: int
    description: str

class SituationSnapshot(BaseModel):
    entities: List[Entity]
    active_interactions: List[Interaction]
    global_risk_score: int

# --- IMPROVED MODELS ---
class SpeciesQuery(BaseModel):
    query: str = Field(..., min_length=1, description="Species name or query")
    
    @field_validator('query')
    @classmethod
    def validate_query_length(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Query must be at least 2 characters')
        return v.strip()


class SpeciesMapResponse(BaseModel):
    scientific_name: str
    count: int
    points: List[Dict[str, Any]]  # Changed to List for proper typing
    error: Optional[str] = None
class SuitabilityQuery(BaseModel):
    species_temp_str: str = Field(..., description="Temperature range string")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")
    # ✅ PHASE 7 NEW INPUTS
    year: str = "Current"
    temp_offset: float = 0.0
    ph_offset: float = 0.0      # Ocean Acidification (e.g. -0.1)
    oxygen_offset: float = 0.0  # Deoxygenation (e.g. -5%)
    fishing_pressure: float = 0.0 # 0.0 to 1.0
    pollution_level: float = 0.0  # 0.0 to 1.0
    
    @field_validator('species_temp_str')
    @classmethod
    def validate_temp_str(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Temperature string must be provided')
        return v.strip()
        

class SpeciesInfoResponse(BaseModel):
    scientific_name: str
    common_name: str
    habitat_type: str
    depth_range: str
    temperature_preference: str
    educational_brief: str
    detailed_explanation: str
    error: Optional[str] = None
# First, update the SuitabilityResponse model to include missing fields
class SuitabilityResponse(BaseModel):
    status: str
    score: str

    env: Dict[str, Any]
    prediction: Dict[str, Any]

    # ROOT FIELDS USED BY FRONTEND
    reason: Optional[str] = None
    climate_impacts: Optional[List[str]] = None

    live_waves: Optional[float] = None
    live_wind: Optional[float] = None
    season: Optional[str] = None
    bio_range: Optional[str] = None

    error: Optional[str] = None


# Global Camera State (In-Memory)
camera_state = {
    "lat": 0.0,
    "lng": 0.0,
    "zoom": 2.2
}

# ✅ SHARED MISSION MEMORY
current_mission = {
    "active": False,
    "origin": {"lat": 0, "lng": 0, "name": "Unknown"},
    "destination": {"lat": 0, "lng": 0, "name": "Unknown"},
    "summary": ""
}

# --------------------------------------------------
# 3. IMPROVED HELPER FUNCTIONS
# --------------------------------------------------
@lru_cache(maxsize=128)
def parse_temp_range(temp_str: str) -> Tuple[float, float, str]:
    try:
        clean_str = re.sub(r'[^0-9\.\-\s]', '', temp_str)
        numbers = re.findall(r"[-+]?\d*\.\d+|[-+]?\d+", clean_str)
        nums = [float(n) for n in numbers]
        
        if len(nums) >= 2:
            min_temp, max_temp = min(nums), max(nums)
            formatted = f"{min_temp}°C - {max_temp}°C"
        elif len(nums) == 1:
            min_temp, max_temp = nums[0] - 5, nums[0] + 5
            formatted = f"{min_temp:.1f}°C - {max_temp:.1f}°C"
        else:
            min_temp, max_temp = 10.0, 25.0
            formatted = "10°C - 25°C"
        
        return min_temp, max_temp, formatted
    except Exception as e:
        print(f"⚠️ Temp Parse Error: {e}")
        return 10.0, 25.0, "10°C - 25°C"

def extract_clean_json(raw_text: str) -> Optional[Dict[str, Any]]:
    try:
        text = raw_text.strip()
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()

        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            clean_text = text[start : end + 1]
            return json.loads(clean_text)
        return None
    except json.JSONDecodeError as e:
        print(f"⚠️ JSON Parse Error: {e}")
        return None
    except Exception as e:
        print(f"⚠️ JSON Cleanup Failed: {e}")
        return None

def get_location_coordinates(query: str) -> Optional[Dict[str, float]]:
    """
    Uses OpenStreetMap (Free) to find exact coordinates.
    """
    try:
        location = geolocator.geocode(query)
        if location:
            return {"lat": location.latitude, "lng": location.longitude}
    except Exception as e:
        print(f"⚠️ Geocoding Error: {e}")
    return None
async def get_live_marine_data(lat: float, lng: float) -> Dict[str, float]:
    """
    Fetches REAL marine data. 
    Robustness: If the exact point is on land, it performs a 'Spiral Search' 
    of nearby coordinates (approx 10km offsets) to find the nearest water data.
    """
    # Spiral search offsets: Original -> N/S/E/W -> Diagonals
    # 0.1 degrees is roughly 11km
    offsets = [
        (0, 0), # 1. Exact Location
        (0.1, 0), (-0.1, 0), (0, 0.1), (0, -0.1), # 2. Cardinals
        (0.1, 0.1), (0.1, -0.1), (-0.1, 0.1), (-0.1, -0.1) # 3. Diagonals
    ]

    async with httpx.AsyncClient(timeout=3.0) as http_client:
        for i, (lat_off, lng_off) in enumerate(offsets):
            try:
                check_lat = lat + lat_off
                check_lng = lng + lng_off
                
                # Validation to ensure we don't go out of bounds
                if not (-90 <= check_lat <= 90) or not (-180 <= check_lng <= 180):
                    continue

                url = "https://marine-api.open-meteo.com/v1/marine"
                params = {
                    "latitude": check_lat,
                    "longitude": check_lng,
                    "current": "temperature_2m,wave_height,wind_wave_height,wind_speed_10m",
                    "timezone": "auto"
                }
                
                resp = await http_client.get(url, params=params)
                
                # Check for API-level errors (like 400 Bad Request)
                if resp.status_code != 200:
                    continue

                data = resp.json()
                
                if "current" in data:
                    temp = data["current"].get("temperature_2m")
                    
                    # ✅ SUCCESS: Found valid water data
                    if temp is not None:
                        # Log if we had to move from the original point
                        if i > 0: 
                            print(f"💧 Land detected at origin. Found water nearby at offset {i} ({check_lat:.2f}, {check_lng:.2f})")
                        
                        return {
                            "temp": float(temp),
                            "wave_height": float(data["current"].get("wave_height") or 0.0),
                            "wind_wave": float(data["current"].get("wind_wave_height") or 0.0),
                            "wind_speed": float(data["current"].get("wind_speed_10m") or 0.0)
                        }
            except Exception:
                # Silently fail for this point and try the next one
                continue

    # ⚠️ FALLBACK: If all 9 points failed (Deep Inland)
    print(f"⚠️ Could not find water near {lat}, {lng} (Deep Inland). Using simulation.")
    
    # Fallback calculation based on latitude
    base_temp = 20 - (abs(lat) / 3) if lat > 0 else 15 - (abs(lat) / 4)
    return {
        "temp": round(base_temp + random.uniform(-2, 2), 1),
        "wave_height": 0.5,
        "wind_wave": 0.2,
        "wind_speed": 5.0
    }
async def get_live_wave_data(lat: float, lng: float) -> Dict[str, float]:
    """
    Fetches REAL wave height and wind speed from Open-Meteo.
    """
    try:
        url = "https://marine-api.open-meteo.com/v1/marine"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "wave_height,wind_wave_height,swell_wave_height",
            "timezone": "auto"
        }
        
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(url, params=params, timeout=2.0)
            data = resp.json()
            
            if "current" in data:
                return {
                    "wave_height": data["current"].get("wave_height", 0.0),
                    "wind_wave": data["current"].get("wind_wave_height", 0.0)
                }
    except Exception as e:
        print(f"⚠️ Weather API Fail: {e}")
    
    return {"wave_height": 0.5, "wind_wave": 0.2}

# --------------------------------------------------
# 5. MARINE BIOLOGY ENDPOINTS (PHASE 4/5)
# --------------------------------------------------

@app.get("/")
async def root():
    return {"status": "Marine Knowledge Engine Online", "version": "4.2.0"}

@app.post("/chat")
async def chat_bot(data: ChatRequest):
    """
    Hybrid Chat: 
    1. Checks Mission Memory first.
    2. Handles "Plan Route" requests by guiding user to UI.
    3. Uses Nominatim for simple "Zoom to X" commands.
    """
    try:
        user_text = data.message.lower()
        
        # --- A. CONTEXT BUILDER ---
        mission_context = "STATUS: IDLE. No active route."
        
        if current_mission["active"]:
            dest = current_mission["destination"]
            orig = current_mission["origin"]
            
            mission_context = f"""
            ACTIVE ROUTE DATA:
            ------------------
            FROM (Origin): {orig['name']}
                 - Coordinates: {orig['lat']}, {orig['lng']}
            
            TO (Destination): {dest['name']}
                 - Coordinates: {dest['lat']}, {dest['lng']}
            ------------------
            Mission Summary: {current_mission['summary']}
            """

        # --- B. SYSTEM PROMPT (UPDATED) ---
        system_prompt = f"""
        You are FloatChat, an Ocean Mission Controller.
        
        {mission_context}

        INSTRUCTIONS:
        1. If user asks about the current mission (destination/origin), use the data above.
        2. If user asks to PLAN A ROUTE (e.g. "Route from A to B"), reply EXACTLY: "To plan a route, please click 'Enable Route Planner' (top right) and select two points on the globe."
        3. If user wants to Zoom/Go to a SINGLE SPECIFIC PLACE (e.g. "Zoom to Paris"), return ONLY: [LOOKUP: Place Name]
        4. Keep normal replies under 2 sentences.
        5. If a location is mentioned from the active route, append: [COMMAND: {{"lat": X, "lng": Y, "zoom": Z}}]
        """

        # --- C. AI CALL ---
        response = await client.chat.completions.create(
            model=MODEL_CHATBOT,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": data.message}
            ],
            temperature=0.1
        )

        raw_reply = response.choices[0].message.content.strip()
        command = None
        clean_reply = raw_reply

        # --- D. LOGIC: TOOL vs MEMORY ---

        # 1. Check for AI requesting a Tool Lookup (Nominatim)
        match_lookup = re.search(r'\[LOOKUP:\s*([^\]]+)\]', raw_reply)
        
        if match_lookup:
            place_name = match_lookup.group(1).strip()
            print(f"🌍 AI requested lookup for: {place_name}")
            
            # Call Nominatim (Free)
            coords = get_location_coordinates(place_name)
            
            if coords:
                command = {"type": "fly_to", "lat": coords['lat'], "lng": coords['lng'], "zoom": 0.6}
                clean_reply = f"Coordinates locked for {place_name}. Engaging engines."
                
                # Update Camera State
                camera_state.update(command)
            else:
                clean_reply = f"I could not locate '{place_name}' on the navigation charts."

        # 2. Check for Direct Commands (from Mission Context)
        elif "COMMAND:" in raw_reply:
             match_cmd = re.search(r'\[COMMAND:\s*(\{.*?\})\]', raw_reply, re.DOTALL)
             if match_cmd:
                json_str = match_cmd.group(1)
                try:
                    command = json.loads(json_str)
                    if command:
                        command["type"] = "fly_to"
                        clean_reply = raw_reply.replace(match_cmd.group(0), "").strip()
                        
                        # Update Memory
                        camera_state["lat"] = command.get("lat", camera_state["lat"])
                        camera_state["lng"] = command.get("lng", camera_state["lng"])
                        camera_state["zoom"] = command.get("zoom", camera_state["zoom"])
                except Exception as e:
                    print(f"❌ Command Parse Error: {e}")

        # 3. Relative Zoom Logic
        elif "zoom in" in user_text:
            new_zoom = max(camera_state["zoom"] * 0.6, 0.15)
            camera_state["zoom"] = new_zoom
            return {"reply": "Zooming in, Captain.", "command": {"type": "fly_to", "lat": camera_state["lat"], "lng": camera_state["lng"], "zoom": new_zoom}}

        elif "zoom out" in user_text:
            new_zoom = min(camera_state["zoom"] * 1.4, 2.5)
            camera_state["zoom"] = new_zoom
            return {"reply": "Pulling back to high orbit.", "command": {"type": "fly_to", "lat": camera_state["lat"], "lng": camera_state["lng"], "zoom": new_zoom}}

        return {"reply": clean_reply, "command": command}

    except Exception as e:
        print(f"CHAT ERROR: {e}")
        return {"reply": "⚠️ Uplink unstable. AI offline.", "command": None}

@app.post("/sentinel")
async def check_anomaly(data: SentinelRequest):
    """
    Analyzes specific float data points for hazards.
    """
    try:
        system_prompt = """
        You are Sentinel AI. Analyze Ocean Data (Temp, Salinity, Oxygen).
        THRESHOLDS:
        - Temp > 29°C: CYCLONE RISK.
        - Oxygen < 60: DEAD ZONE.
        - Salinity < 31 or > 38: DENSITY ANOMALY.
        
        Return a short verdict: NORMAL, WARNING, or CRITICAL, with 1 sentence explanation.
        """

        response = await client.chat.completions.create(
            model=MODEL_SENTINEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"DATA: {data.context}"}
            ],
            temperature=0.1
        )
        return {"alert": response.choices[0].message.content.strip()}

    except Exception as e:
        print(f"SENTINEL ERROR: {e}")
        return {"alert": "⚠️ Sentinel Analysis Unavailable."}

@app.post("/plan-route")
async def plan_route(data: RouteRequest):
    """
    Advanced Naval Route Planner.
    Updates the global mission memory so Chatbot knows the context.
    """
    try:
        system_prompt = f"""
        You are an advanced Naval Route Planning and Decision Support AI.
        
        INPUT DATA:
        Start: {data.start_lat}, {data.start_lng}
        End: {data.end_lat}, {data.end_lng}
        Speed: 20 knots

        TASK: Analyze route and return COMPLETE JSON report.
        
        OUTPUT JSON STRUCTURE:
        {{
          "basic_info": {{
            "origin": {{ "name": "Name", "coordinates": "{data.start_lat}, {data.start_lng}" }},
            "destination": {{ "name": "Name", "coordinates": "{data.end_lat}, {data.end_lng}" }},
            "primary_route_name": "Route Name",
            "distance_nm": 0,
            "estimated_time_days": 0,
            "speed_knots": 20,
            "risk_level": "SAFE | CAUTION | DANGER"
          }},
          "risk_breakdown": [ {{ "type": "Weather", "severity": "LOW", "description": "..." }} ],
          "weather_summary": {{ "avg_wave_height_m": "0-0", "avg_wind_speed_knots": "0-0", "weather_notes": "..." }},
          "good_to_have": {{ "fuel_estimation": {{ "estimated_fuel_tons": 0 }} }},
          "alternate_routes": [ {{ "route_name": "Alt 1", "rejection_reason": "Too slow" }} ],
          "captain_summary": "..."
        }}
        """

        response = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": "Generate Report."}],
            temperature=0.1
        )
        
        raw = response.choices[0].message.content.strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        
        if match:
            route_data = json.loads(match.group(0))

            # --- MATH FIX ---
            dist = route_data.get("basic_info", {}).get("distance_nm", 0)
            if dist > 0:
                hours = dist / 20
                days = round(hours / 24, 1)
                route_data["basic_info"]["estimated_time_days"] = days

            # ✅ UPDATE MISSION MEMORY (Now with Names!)
            basic = route_data.get("basic_info", {})
            current_mission["active"] = True
            
            # Save Names if AI identified them, otherwise default
            current_mission["origin"] = {
                "lat": data.start_lat, 
                "lng": data.start_lng, 
                "name": basic.get("origin", {}).get("name", "Origin Point")
            }
            current_mission["destination"] = {
                "lat": data.end_lat, 
                "lng": data.end_lng, 
                "name": basic.get("destination", {}).get("name", "Destination Point")
            }
            current_mission["summary"] = route_data.get("captain_summary", "")

            return route_data
        else:
            raise ValueError("No JSON found")

    except Exception as e:
        print(f"ROUTE ERROR: {e}")
        return {
            "basic_info": { "risk_level": "CAUTION", "primary_route_name": "Error" },
            "captain_summary": "Route calculation failed."
        }

@app.post("/explain-decision")
async def explain_route_decision(data: RouteComparisonRequest):
    """
    Generates a comparative analysis explaining WHY the primary route was chosen.
    """
    try:
        system_prompt = f"""
        You are a Senior Maritime Navigation Officer.
        
        TASK: Compare chosen route vs alternatives.
        
        INPUT DATA:
        1. CHOSEN: {json.dumps(data.chosen_route)}
        2. REJECTED: {json.dumps(data.alternate_routes)}
        
        OUTPUT JSON:
        {{
          "explain_route_decision": {{
            "chosen_route_reason": "Primary advantage...",
            "rejected_routes": [ {{ "route_name": "Name", "rejection_reason": "Reason" }} ],
            "trade_off_summary": "What was sacrificed? (e.g. Cost vs Safety)"
          }}
        }}
        """

        response = await client.chat.completions.create(
            model=MODEL_CHATBOT,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Explain decision."}
            ],
            temperature=0.2
        )
        
        raw_text = response.choices[0].message.content.strip()
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        
        if match:
            return json.loads(match.group(0))
        else:
            raise ValueError("No JSON found")

    except Exception as e:
        print(f"DECISION ERROR: {e}")
        return {
            "explain_route_decision": {
                "chosen_route_reason": "Analysis unavailable.",
                "rejected_routes": [],
                "trade_off_summary": "Manual review required."
            }
        }

@app.get("/ocean-data")
async def get_real_data():
    """
    Get ocean data with real marine conditions.
    """
    floats = []
    
    # 1. Define specific sample points to get REAL weather for
    sample_points = [
        {"lat": 35.6, "lng": 139.6},  # Tokyo
        {"lat": 40.7, "lng": -74.0},  # NYC
        {"lat": -33.8, "lng": 151.2}, # Sydney
        {"lat": 51.5, "lng": -0.1},   # London
        {"lat": 19.0, "lng": 72.8}    # Mumbai
    ]

    # 2. Get Real Data for specific points
    for point in sample_points:
        marine = await get_live_wave_data(point["lat"], point["lng"])
        
        floats.append({
            "LATITUDE": point["lat"],
            "LONGITUDE": point["lng"],
            "TEMP": round(20 + random.uniform(-5, 5), 1),
            "PSU": 35.0,
            "DOXY": 200.0,
            "WAVE_HEIGHT": marine["wave_height"],
            "WIND_WAVE": marine["wind_wave"]
        })

    # 3. Fill the rest with Simulation
    for _ in range(200): 
        lat = random.uniform(-75, 75)
        floats.append({
            "LATITUDE": lat,
            "LONGITUDE": random.uniform(-180, 180),
            "TEMP": round(30 - (abs(lat) / 3) + random.uniform(-2, 2), 1),
            "PSU": round(random.uniform(33.0, 37.0), 1),
            "DOXY": round(150 + (abs(lat) * 2) + random.uniform(-20, 20), 0),
            "WAVE_HEIGHT": 0.5, # Default for background
            "WIND_WAVE": 0.2
        })

    return floats

@app.post("/analyze")
async def analyze_storm(data: StormPayload):
    """
    Generates a REAL AI-powered SITREP using the Analyst Model.
    """
    try:
        print(f"📡 Generating SITREP for Storm {data.name}...")

        system_prompt = f"""
        You are a Senior Naval Intelligence Officer. Write a TACTICAL SITREP.
        
        DATA:
        - Storm: {data.name} (Category: {data.category})
        - Wind: {data.wind} knots ({data.lifecycle})
        - Position: {data.lat:.2f}°N, {data.lng:.2f}°W
        - Vessels Risk: {data.affected_ships} commercial units
        
        INSTRUCTIONS:
        - Write a professional, military-style Situation Report.
        - Analyze the specific combination of wind vs. ship count.
        - If wind is low but ship count is high, warn about "Traffic Congestion" and "Collision Risk".
        - If wind is high, warn about "Hull Stress" and "Capsize Risk".
        - Format strictly in Markdown.
        """

        response = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate SITREP."}
            ],
            temperature=0.2
        )
        
        sitrep = response.choices[0].message.content.strip()

        if "```markdown" in sitrep:
            sitrep = sitrep.split("```markdown")[1].split("```")[0].strip()
        elif "```" in sitrep:
            sitrep = sitrep.split("```")[1].split("```")[0].strip()

        return {
            "status": "analysis_complete",
            "sitrep": sitrep,
            "metadata": {
                "storm_name": data.name,
                "analysis_timestamp": datetime.now().isoformat(),
                "threat_level": "AI_ASSESSED",
                "recommended_response": "See AI Report Details"
            }
        }
        
    except Exception as e:
        print(f"SITREP ANALYSIS ERROR: {e}")
        return {
            "status": "error",
            "sitrep": "⚠️ AI Intelligence Offline. Manual Assessment Required.",
            "error": str(e)
        }

@app.post("/analyze-situation")
async def analyze_situation(data: SituationSnapshot):
    """
    NEXUS Situation Room Analysis.
    Generates a Strategic SITREP based on map entities and interactions.
    """
    try:
        # 1. Analyze the map content (Context Awareness)
        pirate_count = len([e for e in data.entities if e.type == 'PIRACY'])
        storm_count = len([e for e in data.entities if e.type == 'STORM'])
        ship_count = len([e for e in data.entities if e.type == 'SHIP'])
        pol_count = len([e for e in data.entities if e.type == 'POLITICAL'])

        print(f"🧠 NEXUS Analyzing: {len(data.entities)} entities (Risk: {data.global_risk_score})")

        # 2. Enhanced System Prompt
        system_prompt = f"""
        You are 'NEXUS', a strategic naval intelligence AI.
        
        CONTEXT:
        - The Commander sees a live map with: {ship_count} Ships, {pirate_count} Pirate Zones, {storm_count} Storms, {pol_count} Political Zones.
        - GLOBAL RISK SCORE: {data.global_risk_score}/400.
        
        INSTRUCTIONS:
        1. IF RISK IS 0 BUT THREATS EXIST (Pirates/Storms/Zones):
           - DO NOT say "State of calm" or "No threats".
           - Instead, say "POTENTIAL THREATS DETECTED" or "VIGILANCE REQUIRED".
           - Report that while no direct collisions have occurred yet, hostile assets are present in the AO (Area of Operations).
           
        2. IF RISK > 0:
           - Focus on the active collisions and immediate dangers.

        OUTPUT FORMAT (Markdown):
        ## 🚨 NEXUS SITREP
        **GLOBAL RISK SCORE:** {data.global_risk_score}/400
        
        ### 1. TACTICAL OVERVIEW
        (Summarize the presence of ships vs threats. Be specific about what is on the map.)
        
        ### 2. CRITICAL INTERSECTIONS
        (If interactions exist, list them. If not, mention the distance/proximity of threats.)
        
        ### 3. THREAT PRIORITIZATION
        (Rank the visible threats even if they haven't hit yet.)
        
        ### 4. STRATEGIC RECOMMENDATIONS
        (Actionable advice: Reroute? Increase speed? Alert crew?)
        
        ### 5. PREDICTIVE OUTLOOK
        """
        
        # 3. Pass full entity details so AI knows WHAT is on the map
        user_content = f"""
        SNAPSHOT DATA:
        - Active Interactions: {len(data.active_interactions)}
        - Total Entities: {len(data.entities)}
        
        ENTITY LIST (Visible on Map):
        {json.dumps([{'type': e.type, 'name': e.name} for e in data.entities])}
        
        INTERACTION LOG (Active Collisions):
        {json.dumps([{'desc': i.description, 'severity': i.severityScore} for i in data.active_interactions])}
        """
        
        # 4. Call AI
        response = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2,
            max_tokens=800
        )
        
        # 5. Clean Response
        analysis = response.choices[0].message.content.strip()
        if "```markdown" in analysis:
            analysis = analysis.split("```markdown")[1].split("```")[0].strip()
        elif "```" in analysis:
            analysis = analysis.split("```")[1].split("```")[0].strip()
            
        return {"analysis": analysis}
        
    except Exception as e:
        print(f"NEXUS ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------------------------------
# 5. MARINE KNOWLEDGE ENGINE ENDPOINTS (IMPROVED)
# --------------------------------------------------

@app.post("/species-info", response_model=SpeciesInfoResponse)
async def get_species_info(data: SpeciesQuery):
    try:
        system_prompt = """You are a Marine Biologist. 
        Return strictly valid JSON with fields: scientific_name, common_name, habitat_type, depth_range, temperature_preference, educational_brief, detailed_explanation."""

        response = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Info for: {data.query}"}
            ],
            temperature=0.3
        )
        
        clean_json = extract_clean_json(response.choices[0].message.content)
        if not clean_json: raise ValueError("Failed to parse JSON")
        
        # Ensure defaults
        for k in ["scientific_name", "common_name", "habitat_type"]:
            if k not in clean_json: clean_json[k] = "Unknown"
            
        return SpeciesInfoResponse(**clean_json)

    except Exception as e:
        return SpeciesInfoResponse(
            scientific_name="Error", common_name="Error", habitat_type="N/A", depth_range="N/A",
            temperature_preference="N/A", educational_brief="Error", detailed_explanation=str(e), error=str(e)
        )
@app.post("/species-map", response_model=SpeciesMapResponse)
async def get_species_map(data: SpeciesQuery):
    """
    Fetch species occurrence data from OBIS and return formatted map points.
    """
    try:
        print(f"🔍 Searching for species: {data.query}")
        
        # 1. First, get scientific name from AI
        name_prompt = f"""Extract the specific scientific name for '{data.query}'. 
        
Rules:
- If it's already a scientific name (e.g., "Aurelia aurita"), return it as-is
- If it's a common name (e.g., "Great White Shark"), return the scientific name
- If too generic or unknown, return exactly: UNKNOWN
- Return ONLY the scientific name, nothing else


Examples:
- "jellyfish" -> UNKNOWN (too generic)
- "moon jellyfish" -> Aurelia aurita
- "Aurelia aurita" -> Aurelia aurita
- "great white shark" -> Carcharodon carcharias
"""
        
        name_res = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[{"role": "user", "content": name_prompt}],
            temperature=0.1,
            max_tokens=50
        )
        
        scientific_name = name_res.choices[0].message.content.strip()
        print(f"📋 AI identified scientific name: {scientific_name}")
        
        # Check if species is too generic
        if "UNKNOWN" in scientific_name.upper() or len(scientific_name) < 3:
            return SpeciesMapResponse(
                scientific_name="Unknown",
                count=0,
                points=[],
                error="Species name too generic. Please use a specific scientific name (e.g., 'Aurelia aurita')."
            )


        # 2. Query OBIS API
        obis_url = "https://api.obis.org/v3/occurrence"
        params = {
            "scientificname": scientific_name,
            "size": 500,  # Increased limit
            "offset": 0,
            "fields": "decimalLatitude,decimalLongitude,eventDate,institutionCode,datasetName"
        }
        
        print(f"📡 Querying OBIS with params: {params}")
        
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            headers = {
                "User-Agent": "MarineKnowledgeEngine/5.0 (Educational; contact@example.com)",
                "Accept": "application/json"
            }
            
            resp = await http_client.get(obis_url, params=params, headers=headers)
            
            print(f"📥 OBIS Response Status: {resp.status_code}")
            
            if resp.status_code == 404:
                return SpeciesMapResponse(
                    scientific_name=scientific_name,
                    count=0,
                    points=[],
                    error=f"No OBIS records found for '{scientific_name}'. This species may not be in the database."
                )
            
            if resp.status_code != 200:
                print(f"❌ OBIS API Error: {resp.status_code} - {resp.text}")
                return SpeciesMapResponse(
                    scientific_name=scientific_name,
                    count=0,
                    points=[],
                    error=f"OBIS API returned status {resp.status_code}. Please try again later."
                )
            
            data_json = resp.json()
            results = data_json.get("results", [])
            total_count = data_json.get("total", len(results))
            
            print(f"✅ OBIS returned {len(results)} results (total: {total_count})")


        # 3. Process and validate points
        points = []
        skipped = 0
        
        for idx, record in enumerate(results):
            try:
                lat = record.get("decimalLatitude")
                lng = record.get("decimalLongitude")
                
                # Strict validation
                if lat is None or lng is None:
                    skipped += 1
                    continue
                
                lat = float(lat)
                lng = float(lng)
                
                # Validate coordinates
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    skipped += 1
                    continue
                
                if lat == 0 and lng == 0:  # Skip null island
                    skipped += 1
                    continue
                
                # Color based on date
                event_date = record.get("eventDate", "")
                year = None
                if event_date:
                    try:
                        year = int(event_date[:4])
                    except:
                        pass
                
                current_year = datetime.now().year
                if year and year >= current_year - 5:
                    color = "#00ffcc"  # Recent (cyan)
                elif year and year >= current_year - 20:
                    color = "#3b82f6"  # Medium (blue)
                else:
                    color = "#ff9900"  # Old (orange)
                
                points.append({
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "color": color,
                    "label": f"{scientific_name}",
                    "type": "observation",
                    "details": {
                        "date": event_date or "Unknown",
                        "dataset": record.get("datasetName", "OBIS"),
                        "institution": record.get("institutionCode", "Unknown"),
                        "year": year
                    }
                })
                
            except Exception as e:
                print(f"⚠️ Error processing record {idx}: {e}")
                skipped += 1
                continue
        
        print(f"✅ Processed {len(points)} valid points (skipped {skipped} invalid)")
        
        if len(points) == 0:
            return SpeciesMapResponse(
                scientific_name=scientific_name,
                count=0,
                points=[],
                error=f"Found {total_count} OBIS records but all had invalid coordinates. Try a different species."
            )
        
        return SpeciesMapResponse(
            scientific_name=scientific_name,
            count=total_count,
            points=points,
            error=None
        )


    except httpx.TimeoutException:
        print("⏱️ OBIS API Timeout")
        return SpeciesMapResponse(
            scientific_name=data.query,
            count=0,
            points=[],
            error="OBIS API timeout. The database might be slow. Please try again."
        )
    
    except Exception as e:
        print(f"❌ Unexpected error in /species-map: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return SpeciesMapResponse(
            scientific_name=data.query,
            count=0,
            points=[],
            error=f"System error: {str(e)}"
        )
@app.post("/analyze-suitability", response_model=SuitabilityResponse)
async def analyze_suitability(data: SuitabilityQuery):
    try:
        print(f"🔮 Predicting {data.year} scenario at {data.lat:.2f}, {data.lng:.2f}...")

        # --------------------------------------------------
        # 1. Biological Limits
        # --------------------------------------------------
        min_temp, max_temp, bio_range = parse_temp_range(data.species_temp_str)

        # --------------------------------------------------
        # 2. Live Conditions
        # --------------------------------------------------
        marine_data = await get_live_marine_data(data.lat, data.lng)

        # --------------------------------------------------
        # 3. Time Machine Logic (IPCC Presets)
        # --------------------------------------------------
        sim_temp = marine_data["temp"] + data.temp_offset
        sim_ph = 8.1 + data.ph_offset
        sim_oxy = 100 + data.oxygen_offset
        sim_fish = data.fishing_pressure
        sim_poll = data.pollution_level

        if data.year == "2030":
            sim_temp += 0.5
            sim_ph -= 0.05
            sim_fish = max(sim_fish, 0.3)

        elif data.year == "2050":
            sim_temp += 1.5
            sim_ph -= 0.15
            sim_oxy -= 2.0
            sim_fish = max(sim_fish, 0.5)

        elif data.year == "2100":
            sim_temp += 3.0
            sim_ph -= 0.3
            sim_oxy -= 5.0
            sim_poll = max(sim_poll, 0.6)

        # --------------------------------------------------
        # 4. Thermal Score
        # --------------------------------------------------
        score = "LOW"

        if min_temp <= sim_temp <= max_temp:
            score = "HIGH"
        elif abs(sim_temp - min_temp) < 4 or abs(sim_temp - max_temp) < 4:
            score = "MEDIUM"

        # --------------------------------------------------
        # 5. AI Prediction (STRICT JSON)
        # --------------------------------------------------
        fish_text = ["Low", "Moderate", "High", "Critical"][min(int(sim_fish * 3), 3)]
        poll_text = ["Clean", "Low", "Moderate", "Severe"][min(int(sim_poll * 3), 3)]

        system_prompt = f"""
You are a Marine Scientist.

Return ONLY raw JSON.
NO markdown.
NO commentary.
NO backticks.
NO explanation outside JSON.

Schema:
{{
  "survival_chance": "High | Moderate | Low | Critical",
  "population_trend": "Increasing | Stable | Declining | Collapsing",
  "key_risk": "Thermal Stress | Acidification | Overfishing | Habitat Loss | Deoxygenation",
  "explanation": "One short sentence describing the main threat."
}}

SCENARIO ({data.year}):
Temperature: {sim_temp:.1f}°C (Base {marine_data['temp']:.1f})
pH: {sim_ph:.2f}
Oxygen: {sim_oxy:.0f}%
Fishing: {fish_text}
Pollution: {poll_text}
"""

        ai_res = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Return JSON now."}
            ],
            temperature=0.0,
            max_tokens=200
        )

        raw_ai = ai_res.choices[0].message.content.strip()

        print("🤖 RAW AI RESPONSE:")
        print(raw_ai)

        # --------------------------------------------------
        # 6. Parse AI JSON
        # --------------------------------------------------
        pred_data = extract_clean_json(raw_ai)

        if not pred_data or not isinstance(pred_data, dict):
            print("❌ AI JSON PARSE FAILED — USING FALLBACK")

            pred_data = {
                "survival_chance": "Low",
                "population_trend": "Declining",
                "key_risk": "Thermal Stress",
                "explanation": "Environmental conditions fall outside the species' preferred tolerance range."
            }

        pred_data.setdefault("survival_chance", "Unknown")
        pred_data.setdefault("population_trend", "Unknown")
        pred_data.setdefault("key_risk", "Unknown")
        pred_data.setdefault("explanation", "No explanation provided")

        # --------------------------------------------------
        # 7. Climate Impacts
        # --------------------------------------------------
        climate_impacts: list[str] = []

        if data.year != "Current":

            if sim_temp > max_temp:
                climate_impacts.append(
                    f"Temperature exceeds optimal range by {sim_temp - max_temp:.1f}°C"
                )

            elif sim_temp < min_temp:
                climate_impacts.append(
                    f"Temperature below optimal range by {min_temp - sim_temp:.1f}°C"
                )

            if sim_ph < 7.9:
                climate_impacts.append(
                    f"Ocean acidification reducing pH to {sim_ph:.2f}"
                )

            if sim_oxy < 95:
                climate_impacts.append(
                    f"Oxygen depletion at {sim_oxy:.0f}% of baseline"
                )

            if sim_fish > 0.5:
                climate_impacts.append(
                    f"High fishing pressure ({fish_text}) threatening population"
                )

            if sim_poll > 0.5:
                climate_impacts.append(
                    f"Elevated pollution levels ({poll_text}) degrading habitat"
                )

        # --------------------------------------------------
        # 8. Reason Summary
        # --------------------------------------------------
        reason = f"Species adapted to {bio_range}. Current temperature {marine_data['temp']:.1f}°C"

        if sim_temp != marine_data["temp"]:
            reason += f", projected {sim_temp:.1f}°C"

        if pred_data.get("key_risk"):
            reason += f". Primary risk: {pred_data['key_risk']}"

        # --------------------------------------------------
        # 9. Season Logic
        # --------------------------------------------------
        current_month = datetime.now().month

        if data.lat >= 0:
            season = (
                "Winter" if current_month in [12, 1, 2]
                else "Spring" if current_month in [3, 4, 5]
                else "Summer" if current_month in [6, 7, 8]
                else "Fall"
            )
        else:
            season = (
                "Summer" if current_month in [12, 1, 2]
                else "Fall" if current_month in [3, 4, 5]
                else "Winter" if current_month in [6, 7, 8]
                else "Spring"
            )

        # --------------------------------------------------
        # 10. Waves & Wind
        # --------------------------------------------------
        live_waves = round(marine_data.get("wave_height", 0.0), 1)
        live_wind = round(marine_data.get("wind_speed", 0.0), 1)

        # --------------------------------------------------
        # 11. Final Response
        # --------------------------------------------------
        return SuitabilityResponse(
            status="success",
            score=score.upper(),
            env={
                "live_temp": round(marine_data["temp"], 1),
                "sim_temp": round(sim_temp, 1),
                "sim_ph": round(sim_ph, 2),
                "sim_oxy": round(sim_oxy, 1),
                "sim_fish": fish_text,
                "sim_poll": poll_text,
                "year": data.year,
                "bio_range": bio_range,
                "season": season,
                "live_waves": live_waves,
                "live_wind": live_wind
            },
            prediction=pred_data,
            reason=reason,
            climate_impacts=climate_impacts or None,
            live_waves=live_waves,
            live_wind=live_wind,
            season=season,
            bio_range=bio_range
        )

    except Exception as e:
        print(f"❌ Error in analyze_suitability: {e}")
        import traceback
        traceback.print_exc()

        return SuitabilityResponse(
            status="error",
            score="LOW",
            env={
                "live_temp": 0.0,
                "sim_temp": 0.0,
                "sim_ph": 8.1,
                "sim_oxy": 100.0,
                "sim_fish": "Unknown",
                "sim_poll": "Unknown",
                "year": data.year,
                "bio_range": "",
                "season": ""
            },
            prediction={
                "survival_chance": "Unknown",
                "population_trend": "Unknown",
                "key_risk": "Analysis Error",
                "explanation": str(e)
            },
            reason=f"Error: {str(e)}",
            climate_impacts=None,
            live_waves=0.0,
            live_wind=0.0,
            season="Unknown",
            bio_range="Unknown",
            error=str(e)
        )

# --------------------------------------------------
# 6. HEALTH CHECK & MONITORING
# --------------------------------------------------

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": "Marine Knowledge Engine API",
        "version": "4.1.0",
        "timestamp": datetime.now().isoformat(),
        "endpoints": [
            "/species-info",
            "/species-map", 
            "/analyze-suitability",
            "/chat",
            "/plan-route",
            "/ocean-data"
        ]
    }
@app.get("/api-status")
async def api_status():
    """Check status of external APIs."""
    status = {
        "openrouter": "unknown", 
        "obis": "unknown", 
        "marine_api": "unknown",
        "geocoder": "unknown"
    }
    
    try:
        # Test OpenRouter
        await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1
        )
        status["openrouter"] = "healthy"
    except Exception as e:
        print(f"⚠️ OpenRouter health check failed: {e}")
        status["openrouter"] = "unhealthy"
    
    try:
        # Test OBIS
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            resp = await http_client.get("https://api.obis.org/v3")
            status["obis"] = "healthy" if resp.status_code == 200 else "unhealthy"
    except Exception as e:
        print(f"⚠️ OBIS health check failed: {e}")
        status["obis"] = "unhealthy"
    
    try:
        # Test Marine API
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            resp = await http_client.get("https://marine-api.open-meteo.com/v1/marine?latitude=0&longitude=0&current=temperature_2m")
            status["marine_api"] = "healthy" if resp.status_code == 200 else "unhealthy"
    except Exception as e:
        print(f"⚠️ Marine API health check failed: {e}")
        status["marine_api"] = "unhealthy"
    
    try:
        # Test Geocoder
        location = geocode("London")
        status["geocoder"] = "healthy" if location else "unhealthy"
    except Exception as e:
        print(f"⚠️ Geocoder health check failed: {e}")
        status["geocoder"] = "unhealthy"
    
    return status
@app.get("/system-stats")
async def system_stats():
    """Get system statistics."""
    return {
        "camera_state": camera_state,
        "mission_active": current_mission["active"],
        "uptime": "N/A",  # Would need psutil for real uptime
        "memory_usage": "N/A",
        "api_calls_today": 0  # Would need tracking
    }

# --------------------------------------------------
# 7. UTILITY ENDPOINTS
# --------------------------------------------------

@app.get("/parse-temperature/{temp_str}")
async def parse_temperature_endpoint(temp_str: str):
    """Utility endpoint to test temperature parsing."""
    min_temp, max_temp, formatted = parse_temp_range(temp_str)
    return {
        "input": temp_str,
        "min_temp": min_temp,
        "max_temp": max_temp,
        "formatted_range": formatted
    }

@app.get("/test-species/{species_name}")
async def test_species_endpoint(species_name: str):
    """Test endpoint for species data flow."""
    try:
        # Get species info
        info_data = SpeciesQuery(query=species_name)
        info_result = await get_species_info(info_data)
        
        # Get map data
        map_data = SpeciesQuery(query=species_name)
        map_result = await get_species_map(map_data)
        
        return {
            "species_info": info_result.dict(),
            "species_map": map_result.dict(),
            "test_passed": True
        }
    except Exception as e:
        return {
            "species_info": None,
            "species_map": None,
            "test_passed": False,
            "error": str(e)
        }

# --------------------------------------------------
# 6. EXCEPTION HANDLING
# --------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"❌ Global Error: {exc}")
    return JSONResponse(status_code=500, content={"error": str(exc)})
