import os
import json
import re
import ast
import random
import certifi
import httpx
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime

# FASTAPI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# EXTERNAL LIBS
from dotenv import load_dotenv
from argopy import DataFetcher
from openai import AsyncOpenAI
from geopy.geocoders import Nominatim

# --------------------------------------------------
# 1. CONFIGURATION & SETUP
# --------------------------------------------------
# SSL Fix for Windows
os.environ["SSL_CERT_FILE"] = certifi.where()

load_dotenv()

app = FastAPI(title="FloatChat Backend", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Async Client
openai_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FloatChat"
    }
)

# Initialize Free Geocoder (User agent is required by OSM policy)
geolocator = Nominatim(user_agent="floatchat_nav_system_v4")

# Models
MODEL_CHATBOT = "meta-llama/llama-3.3-70b-instruct:free"
MODEL_SENTINEL = MODEL_CHATBOT 
MODEL_ANALYST = "qwen/qwen3-coder:free"

# --------------------------------------------------
# 2. DATA MODELS & STATE
# --------------------------------------------------
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
    alternate_routes: List[dict]
    vessel_speed: int = 20

class StormPayload(BaseModel):
    name: str
    wind: int
    lat: float
    lng: float
    category: str
    lifecycle: str
    affected_ships: int

# Global Camera State (In-Memory)
camera_state = {
    "lat": 0.0,
    "lng": 0.0,
    "zoom": 2.2
}

# ✅ SHARED MISSION MEMORY
# Stores names and coordinates to prevent AI confusion
current_mission = {
    "active": False,
    "origin": {"lat": 0, "lng": 0, "name": "Unknown"},
    "destination": {"lat": 0, "lng": 0, "name": "Unknown"},
    "summary": ""
}

# --------------------------------------------------
# 3. HELPER FUNCTIONS
# --------------------------------------------------

def get_location_coordinates(query: str) -> Optional[Dict[str, float]]:
    """
    Uses OpenStreetMap (Free) to find exact coordinates.
    Fixes AI hallucination of lat/lng.
    """
    try:
        # Geocode the location name
        location = geolocator.geocode(query)
        if location:
            return {"lat": location.latitude, "lng": location.longitude}
    except Exception as e:
        print(f"⚠️ Geocoding Error: {e}")
    return None

async def get_live_marine_data(lat: float, lng: float) -> Dict[str, float]:
    """
    Fetches REAL wave height and wind speed from Open-Meteo (Free).
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
            
            # Extract current conditions
            if "current" in data:
                return {
                    "wave_height": data["current"].get("wave_height", 0.0),
                    "wind_wave": data["current"].get("wind_wave_height", 0.0)
                }
    except Exception as e:
        print(f"⚠️ Weather API Fail: {e}")
    
    # Fallback if API fails
    return {"wave_height": 0.5, "wind_wave": 0.2}

# --------------------------------------------------
# 4. CORE ENDPOINTS
# --------------------------------------------------

@app.get("/")
async def root():
    return {"status": "FloatChat Systems Online", "mission_active": current_mission["active"]}

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
        response = await openai_client.chat.completions.create(
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
        # Regex update: stops at the first closing bracket to prevent reading complex sentences
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
                    try:
                        command = json.loads(json_str)
                    except json.JSONDecodeError:
                        command = ast.literal_eval(json_str)

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

        response = await openai_client.chat.completions.create(
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

        response = await openai_client.chat.completions.create(
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

        response = await openai_client.chat.completions.create(
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

# --------------------------------------------------
# 5. DATA SIMULATION (FIXED)
# --------------------------------------------------

@app.get("/ocean-data")
async def get_real_data():  # <--- MUST BE ASYNC now
    floats = []
    
    # 1. Define specific sample points to get REAL weather for
    # (Tokyo, NYC, Sydney, London, Mumbai)
    sample_points = [
        {"lat": 35.6, "lng": 139.6}, 
        {"lat": 40.7, "lng": -74.0}, 
        {"lat": -33.8, "lng": 151.2}, 
        {"lat": 51.5, "lng": -0.1},  
        {"lat": 19.0, "lng": 72.8}   
    ]

    # 2. Get Real Data for specific points
    for point in sample_points:
        # ✅ CALLING THE NEW HELPER
        marine = await get_live_marine_data(point["lat"], point["lng"])
        
        floats.append({
            "LATITUDE": point["lat"],
            "LONGITUDE": point["lng"],
            "TEMP": round(20 + random.uniform(-5, 5), 1),
            "PSU": 35.0,
            "DOXY": 200.0,
            # ✅ INJECTING REAL LIVE DATA
            "WAVE_HEIGHT": marine["wave_height"],
            "WIND_WAVE": marine["wind_wave"]
        })

    # 3. Fill the rest with Simulation (background stars)
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

# --------------------------------------------------
# 6. SITREP AI ANALYSIS ENDPOINT
# --------------------------------------------------
@app.post("/analyze")
async def analyze_storm(data: StormPayload):
    """
    Generates a REAL AI-powered SITREP using the Analyst Model.
    Replaces the old hardcoded mock logic.
    """
    try:
        print(f"📡 Generating SITREP for Storm {data.name}...")

        # 1. Construct the Prompt
        # We give the AI the raw data and strict formatting rules.
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

        # 2. Call the AI Model (Qwen/Llama)
        response = await openai_client.chat.completions.create(
            model=MODEL_ANALYST, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate SITREP."}
            ],
            temperature=0.2 # Low temp for professional tone
        )
        
        # 3. Clean Output
        sitrep = response.choices[0].message.content.strip()
        
        # Remove Markdown code blocks if the AI adds them
        if "```markdown" in sitrep:
            sitrep = sitrep.split("```markdown")[1].split("```")[0].strip()
        elif "```" in sitrep:
            sitrep = sitrep.split("```")[1].split("```")[0].strip()

        # 4. Return to Frontend
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













































































































