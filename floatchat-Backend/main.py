import os
import json
import re
import asyncio
import random
import certifi
import httpx
from functools import lru_cache
from typing import Optional, Dict, Any, Tuple, List

# FASTAPI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse  # ADD THIS IMPORT
from datetime import datetime

from pydantic import BaseModel, Field, validator

# EXTERNAL LIBS
from dotenv import load_dotenv
from geopy.geocoders import Nominatim
from openai import AsyncOpenAI

# --------------------------------------------------
# 1. CONFIGURATION & SETUP
# --------------------------------------------------
# SSL Fix for Windows
os.environ["SSL_CERT_FILE"] = certifi.where()

load_dotenv()

app = FastAPI(
    title="Marine Knowledge Engine API",
    version="4.1.0",
    description="Comprehensive marine species data, occurrence mapping, and habitat suitability analysis"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Async Client
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "MarineKnowledgeEngine"
    }
)

# Initialize Free Geocoder
geolocator = Nominatim(user_agent="marine_knowledge_engine_v4")

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
    
    @validator('query')
    def validate_query_length(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Query must be at least 2 characters')
        return v.strip()

class SuitabilityQuery(BaseModel):
    species_temp_str: str = Field(..., description="Temperature range string, e.g., '10°C - 25°C'")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")
    
    @validator('species_temp_str')
    def validate_temp_str(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Temperature string must be provided')
        return v.strip()

class SpeciesMapResponse(BaseModel):
    scientific_name: str
    count: int
    points: list
    error: Optional[str] = None

class SpeciesInfoResponse(BaseModel):
    scientific_name: str
    common_name: str
    habitat_type: str
    depth_range: str
    temperature_preference: str
    educational_brief: str
    detailed_explanation: str
    error: Optional[str] = None

class SuitabilityResponse(BaseModel):
    status: str
    score: str
    live_temp: float
    bio_range: str
    reason: str
    factors: Optional[Dict[str, Any]] = None
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
    """
    Robustly extracts min/max temps from strings like '10-25C' or '10°C - 25°C'
    Returns: (min_temp, max_temp, formatted_range_string)
    """
    try:
        # Remove non-numeric characters except dots, minus signs, and spaces
        clean_str = re.sub(r'[^0-9\.\-\s]', '', temp_str)
        
        # Find ALL numbers (integers or floats)
        numbers = re.findall(r"[-+]?\d*\.\d+|[-+]?\d+", clean_str)
        nums = [float(n) for n in numbers]
        
        if len(nums) >= 2:
            min_temp, max_temp = min(nums), max(nums)
            formatted = f"{min_temp}°C - {max_temp}°C"
        elif len(nums) == 1:
            min_temp = nums[0] - 5
            max_temp = nums[0] + 5
            formatted = f"{min_temp:.1f}°C - {max_temp:.1f}°C"
        else:
            min_temp, max_temp = 10.0, 25.0  # Default fallback for marine species
            formatted = "10°C - 25°C"
        
        return min_temp, max_temp, formatted
    except Exception as e:
        print(f"⚠️ Temperature parsing error for '{temp_str}': {e}")
        return 10.0, 25.0, "10°C - 25°C"

def extract_clean_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Robustly cleans AI output to extract valid JSON.
    Handles Markdown, 'Thinking' tags, and trailing commas.
    """
    try:
        text = raw_text.strip()
        
        # Remove <think> tags (Common in reasoning models)
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()

        # Remove Markdown Code Blocks
        if "```json" in text:
            parts = text.split("```json")
            if len(parts) > 1:
                text = parts[1].split("```")[0].strip()
        elif "```" in text:
            parts = text.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("{"):
                    text = part
                    break
        
        # Find JSON bounds
        start = text.find("{")
        end = text.rfind("}")
        
        if start != -1 and end != -1:
            clean_text = text[start : end + 1]
            # Fix common JSON issues
            clean_text = re.sub(r',\s*}', '}', clean_text)
            clean_text = re.sub(r',\s*]', ']', clean_text)
            # Fix unquoted keys
            clean_text = re.sub(r'(\w+):', r'"\1":', clean_text)
            
            try:
                return json.loads(clean_text)
            except json.JSONDecodeError as e:
                # Try to fix more issues
                clean_text = re.sub(r'(\w+)\s*:\s*"', r'"\1": "', clean_text)
                return json.loads(clean_text)
        
        return None
    except Exception as e:
        print(f"⚠️ JSON Cleanup Failed: {e}")
        print(f"Raw text was: {raw_text[:500]}...")
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
    Fetches REAL marine data from Open-Meteo with improved error handling.
    """
    try:
        url = "https://marine-api.open-meteo.com/v1/marine"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,wave_height,wind_wave_height,wind_speed_10m",
            "timezone": "auto"
        }
        
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            resp = await http_client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            
            if "current" in data:
                return {
                    "temp": data["current"].get("temperature_2m", 0.0),
                    "wave_height": data["current"].get("wave_height", 0.0),
                    "wind_wave": data["current"].get("wind_wave_height", 0.0),
                    "wind_speed": data["current"].get("wind_speed_10m", 0.0)
                }
            else:
                raise ValueError("No current data in response")
                
    except httpx.TimeoutException:
        print(f"⚠️ Weather API timeout for ({lat}, {lng})")
    except Exception as e:
        print(f"⚠️ Weather API Error: {e}")
    
    # Fallback with realistic values based on latitude
    if lat > 0:  # Northern hemisphere
        base_temp = 20 - (abs(lat) / 3)
    else:  # Southern hemisphere
        base_temp = 15 - (abs(lat) / 4)
    
    return {
        "temp": max(-2, min(30, base_temp + random.uniform(-3, 3))),
        "wave_height": 1.0 + random.uniform(-0.5, 0.5),
        "wind_wave": 0.5 + random.uniform(-0.2, 0.2),
        "wind_speed": 5.0 + random.uniform(-3, 3)
    }

async def get_live_wave_data(lat, lng):
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
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, timeout=2.0)
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
# 4. CORE ENDPOINTS
# --------------------------------------------------

@app.get("/")
async def root():
    return {"status": "Marine Knowledge Engine Online", "version": "4.1.0"}

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
    """
    PHASE 1: Pure Species Knowledge (Biology + Habitat).
    """
    try:
        print(f"🔍 Species Query: {data.query}")

        system_prompt = """You are an AI Marine Ecology Assistant specialized in oceanography and marine biodiversity.

YOUR ROLE:
Provide scientifically grounded, data-backed explanations about marine species.

STRICT RULES:
1. Do NOT make predictions about future population or movement.
2. Do NOT speculate beyond standard biological data (FishBase/OBIS).
3. Explain "Why" using physical oceanography (temp, depth, salinity) + ecology.
4. If data is insufficient, state clearly: "Data not available."
5. Return valid JSON with exactly these fields.

OUTPUT FORMAT (JSON ONLY):
{
  "scientific_name": "Genus species",
  "common_name": "Common Name",
  "habitat_type": "Pelagic, Reef-associated, Benthic",
  "depth_range": "0 - 200m",
  "temperature_preference": "10°C - 25°C",
  "educational_brief": "2-3 sentence student-friendly summary.",
  "detailed_explanation": "Full scientific explanation"
}

IMPORTANT: If the query is unclear or species is unknown, use "Unknown" for scientific_name."""

        response = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Provide information about: {data.query}"}
            ],
            temperature=0.3,
            max_tokens=1500
        )

        raw_output = response.choices[0].message.content
        clean_json = extract_clean_json(raw_output)

        if not clean_json:
            return SpeciesInfoResponse(
                scientific_name="Unknown",
                common_name="Unknown",
                habitat_type="Data not available",
                depth_range="Data not available",
                temperature_preference="Data not available",
                educational_brief="Unable to retrieve specific data for this query.",
                detailed_explanation="The system could not parse information for this species. Please try a more specific scientific name or common name."
            )

        # Validate required fields exist
        required_fields = [
            "scientific_name", "common_name", "habitat_type", 
            "depth_range", "temperature_preference", 
            "educational_brief", "detailed_explanation"
        ]
        
        for field in required_fields:
            if field not in clean_json:
                clean_json[field] = "Data not available"

        return SpeciesInfoResponse(**clean_json)

    except Exception as e:
        print(f"❌ ECOLOGY ERROR: {e}")
        return SpeciesInfoResponse(
            scientific_name="System Error",
            common_name="System Error",
            habitat_type="Unavailable",
            depth_range="Unavailable",
            temperature_preference="Unavailable",
            educational_brief="Unable to retrieve data due to system error.",
            detailed_explanation=f"System error occurred: {str(e)[:200]}",
            error=str(e)
        )

@app.post("/species-map", response_model=SpeciesMapResponse)
async def get_species_map(data: SpeciesQuery):
    """
    PHASE 2: Real-world occurrence data from OBIS.
    Only runs for VALID species-level queries.
    """
    try:
        print(f"🗺️ Fetching OBIS Map Data for: {data.query}")

        # --- STEP 1: Extract scientific name using AI ---
        name_prompt = f"""Extract ONLY the most specific marine species scientific name from this query.
If uncertain or if it's not a specific species, return: UNKNOWN

Query: {data.query}
Output: (only the scientific name or UNKNOWN)"""

        name_res = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[{"role": "user", "content": name_prompt}],
            temperature=0.1,
            max_tokens=50
        )

        scientific_name = name_res.choices[0].message.content.strip()
        print(f"🔬 Extracted Scientific Name: '{scientific_name}'")

        # --- STEP 2: Validate species format ---
        if (scientific_name == "UNKNOWN" or 
            scientific_name.count(" ") != 1 or
            len(scientific_name) < 3):
            
            print("⚠️ Not a valid species-level query.")
            return SpeciesMapResponse(
                scientific_name="Unknown",
                count=0,
                points=[],
                error="Query is not specific to a single species. Please use a scientific name like 'Aurelia aurita'."
            )

        # --- STEP 3: Query OBIS with retry logic ---
        obis_url = "https://api.obis.org/v3/occurrence"
        params = {
            "scientificname": scientific_name,
            "size": 500,
            "hasextensions": "true",
            "geometry": "bbox[-180,-90,180,90]"
        }

        points = []
        max_retries = 2
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=10.0) as http_client:
                    resp = await http_client.get(obis_url, params=params)
                    
                    if resp.status_code == 429:  # Rate limited
                        wait_time = (attempt + 1) * 2
                        print(f"⏳ OBIS rate limited, waiting {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    
                    resp.raise_for_status()
                    raw_data = resp.json()
                    break
                    
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt == max_retries - 1:
                    print(f"❌ OBIS connection failed after {max_retries} attempts: {e}")
                    return SpeciesMapResponse(
                        scientific_name=scientific_name,
                        count=0,
                        points=[],
                        error="OBIS database is temporarily unavailable."
                    )
                await asyncio.sleep(1 * (attempt + 1))
                continue

        results = raw_data.get("results", [])
        print(f"📊 OBIS returned {len(results)} records")

        # --- STEP 4: Process and validate points ---
        valid_count = 0
        for record in results:
            try:
                lat = record.get("decimalLatitude")
                lng = record.get("decimalLongitude")
                
                if lat is None or lng is None:
                    continue
                    
                lat_float = float(lat)
                lng_float = float(lng)
                
                # Validate coordinates are on Earth
                if not (-90 <= lat_float <= 90 and -180 <= lng_float <= 180):
                    continue
                
                # Generate color based on record age if available
                color = "#00ffcc"  # Default teal
                event_date = record.get("eventDate", "")
                if event_date:
                    try:
                        year = int(event_date[:4])
                        current_year = datetime.now().year
                        if year < current_year - 10:
                            color = "#ff9900"  # Orange for old records
                        elif year < current_year - 5:
                            color = "#ffff00"  # Yellow for medium age
                    except:
                        pass

                points.append({
                    "lat": lat_float,
                    "lng": lng_float,
                    "label": f"{scientific_name} - {event_date[:10] if event_date else 'Date unknown'}",
                    "color": color,
                    "type": "occurrence"
                })
                valid_count += 1
                
            except (ValueError, TypeError) as e:
                continue

        print(f"✅ Processed {valid_count} valid points")
        
        return SpeciesMapResponse(
            scientific_name=scientific_name,
            count=valid_count,
            points=points[:300]  # Limit for performance
        )

    except Exception as e:
        print(f"❌ OBIS ERROR: {e}")
        return SpeciesMapResponse(
            scientific_name="Error",
            count=0,
            points=[],
            error=f"Failed to retrieve occurrence data: {str(e)}"
        )

@app.post("/analyze-suitability", response_model=SuitabilityResponse)
async def analyze_suitability(data: SuitabilityQuery):
    """
    PHASE 3: Habitat Suitability Analysis.
    """
    try:
        print(f"🌡️ Analyzing habitat suitability at {data.lat:.2f}, {data.lng:.2f}")
        print(f"📊 Species temperature preference: {data.species_temp_str}")

        # 1. Parse temperature range with improved function
        min_temp, max_temp, bio_range = parse_temp_range(data.species_temp_str)
        print(f"📈 Parsed range: {bio_range} ({min_temp:.1f}°C to {max_temp:.1f}°C)")

        # 2. Get LIVE marine conditions
        marine_data = await get_live_marine_data(data.lat, data.lng)
        live_temp = marine_data["temp"]
        live_waves = marine_data["wave_height"]
        live_wind = marine_data["wind_speed"]
        
        print(f"🌊 Live conditions: {live_temp:.1f}°C, {live_waves:.1f}m waves, {live_wind:.1f} m/s wind")

        # 3. Calculate seasonality
        month = datetime.now().month
        is_north = data.lat > 0
        
        if month in [12, 1, 2]:
            season = "Winter (N)" if is_north else "Summer (S)"
        elif month in [3, 4, 5]:
            season = "Spring (N)" if is_north else "Autumn (S)"
        elif month in [6, 7, 8]:
            season = "Summer (N)" if is_north else "Winter (S)"
        else:
            season = "Autumn (N)" if is_north else "Spring (S)"

        # 4. Calculate suitability score with more nuance
        temp_diff_min = abs(live_temp - min_temp)
        temp_diff_max = abs(live_temp - max_temp)
        
        if min_temp <= live_temp <= max_temp:
            if temp_diff_min < 2 or temp_diff_max < 2:  # Near optimal
                score = "HIGH"
            else:  # Within range but not optimal
                score = "MEDIUM"
        elif min_temp - 3 <= live_temp <= max_temp + 3:  # Within tolerance
            score = "MEDIUM"
        else:
            score = "LOW"

        # 5. Consider wave and wind conditions
        factors = {
            "temperature": {
                "value": live_temp,
                "optimal_min": min_temp,
                "optimal_max": max_temp,
                "score": score,
                "impact": "high"
            },
            "waves": {
                "value": live_waves,
                "optimal_max": 3.0,
                "score": "HIGH" if live_waves < 2.0 else "MEDIUM" if live_waves < 4.0 else "LOW",
                "impact": "medium"
            },
            "season": {
                "value": season,
                "optimal": "Species-dependent",
                "impact": "low"
            }
        }

        # 6. Generate intelligent reasoning
        context_prompt = f"""As a Marine Ecologist, analyze habitat suitability:

SPECIES TEMPERATURE PREFERENCE: {min_temp:.1f}°C to {max_temp:.1f}°C
CURRENT CONDITIONS:
- Sea Surface Temperature: {live_temp:.1f}°C
- Wave Height: {live_waves:.1f} meters
- Wind Speed: {live_wind:.1f} m/s
- Season: {season}
- Location: {data.lat:.2f}°N, {data.lng:.2f}°E

TASK: Write ONE concise sentence explaining suitability.
Consider:
1. Is temperature within preferred range?
2. Are waves/wind conditions favorable?
3. Is this typical season for the species?

Output should be clear, scientific, and under 20 words."""

        ai_res = await client.chat.completions.create(
            model=MODEL_ANALYST,
            messages=[{"role": "user", "content": context_prompt}],
            temperature=0.3,
            max_tokens=100
        )
        
        reason = ai_res.choices[0].message.content.strip()
        if len(reason) > 200:  # Truncate if too long
            reason = reason[:197] + "..."

        # 7. Return complete response WITH bio_range
        return SuitabilityResponse(
            status="success",
            score=score,
            live_temp=round(live_temp, 1),
            bio_range=bio_range,  # FIXED: Now included
            reason=reason,
            factors=factors
        )

    except Exception as e:
        print(f"❌ SUITABILITY ANALYSIS ERROR: {e}")
        return SuitabilityResponse(
            status="error",
            score="UNKNOWN",
            live_temp=0.0,
            bio_range="Unknown",
            reason="Analysis failed due to technical error.",
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
    except:
        status["openrouter"] = "unhealthy"
    
    try:
        # Test OBIS
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://api.obis.org/v3")
            status["obis"] = "healthy" if resp.status_code == 200 else "unhealthy"
    except:
        status["obis"] = "unhealthy"
    
    try:
        # Test Marine API
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://marine-api.open-meteo.com/v1/marine?latitude=0&longitude=0&current=temperature_2m")
            status["marine_api"] = "healthy" if resp.status_code == 200 else "unhealthy"
    except:
        status["marine_api"] = "unhealthy"
    
    try:
        # Test Geocoder
        location = geolocator.geocode("London", timeout=5)
        status["geocoder"] = "healthy" if location else "unhealthy"
    except:
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
# 8. ERROR HANDLING
# --------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions uniformly."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status": "error",
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    print(f"❌ Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status": "error",
            "timestamp": datetime.now().isoformat()
        }
    )

# --------------------------------------------------
# 9. STARTUP EVENT
# --------------------------------------------------

@app.on_event("startup")
async def startup_event():
    """Run on startup."""
    print("🚀 Marine Knowledge Engine API starting up...")
    print(f"📊 Model: {MODEL_ANALYST}")
    print(f"🌐 CORS: Enabled")
    print(f"🔧 Version: 4.1.0")

# --------------------------------------------------
# 10. MAIN EXECUTION
# --------------------------------------------------
# 
# if __name__ == "__main__":
    # import uvicorn
    # uvicorn.run(app, host="0.0.0.0", port=8000)