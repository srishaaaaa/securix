"""
Additional Module 2 - Risk Signals: device fingerprinting + geo-velocity.

Device fingerprinting itself is just passive metadata the client already
sends (browser/OS/screen/timezone) - captured as-is in the router, no
processing needed here.

This module handles the geo-velocity half: look up the approximate
location of an IP address using a free, no-API-key geolocation service,
then check whether two consecutive verification attempts by the same user
imply an impossible travel speed (e.g. Chennai to Delhi in 10 minutes).

Caveats, stated plainly:
- ip-api.com's free tier is for non-commercial use and rate-limited
  (45 requests/minute per IP). Swap GEO_API_URL for a paid provider for
  production use.
- On `localhost` your IP is 127.0.0.1 / ::1, which can't be geolocated -
  geolocate() returns None and the travel check is skipped gracefully.
  This only becomes meaningful once deployed behind a real public IP.
"""
import math
from datetime import datetime
from typing import Optional

import requests

GEO_API_URL = "http://ip-api.com/json/{ip}"
GEO_TIMEOUT_SECONDS = 3

# Speeds faster than this (km/h) between two verification attempts are
# treated as physically impossible for any commercial flight + ground
# transit combination, and flagged as suspicious.
IMPOSSIBLE_TRAVEL_KMH = 900


def is_private_ip(ip: str) -> bool:
    if not ip:
        return True
    return (
        ip in ("127.0.0.1", "::1", "localhost")
        or ip.startswith("10.")
        or ip.startswith("192.168.")
        or ip.startswith("172.16.")
    )


def geolocate(ip: str) -> Optional[dict]:
    """Looks up an IP's approximate city/country/lat/lon. Returns None on
    any failure (private IP, network error, rate limit) rather than raising,
    so a lookup failure never blocks the KYC flow."""
    if is_private_ip(ip):
        return None
    try:
        resp = requests.get(GEO_API_URL.format(ip=ip), timeout=GEO_TIMEOUT_SECONDS)
        data = resp.json()
        if data.get("status") != "success":
            return None
        return {
            "city": data.get("city"),
            "country": data.get("country"),
            "lat": data.get("lat"),
            "lon": data.get("lon"),
        }
    except Exception:
        return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0  # Earth radius, km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def check_impossible_travel(
    prev_lat: float, prev_lon: float, prev_time: datetime,
    curr_lat: float, curr_lon: float, curr_time: datetime,
) -> dict:
    """Returns {"flag": bool, "detail": str, "distance_km": float, "speed_kmh": float}."""
    distance_km = haversine_km(prev_lat, prev_lon, curr_lat, curr_lon)
    hours = max((curr_time - prev_time).total_seconds() / 3600.0, 1e-6)
    speed_kmh = distance_km / hours

    if distance_km < 50:
        return {"flag": False, "detail": "", "distance_km": round(distance_km, 1), "speed_kmh": round(speed_kmh, 1)}

    flag = speed_kmh > IMPOSSIBLE_TRAVEL_KMH
    detail = (
        f"{round(distance_km)} km in {round(hours * 60)} min "
        f"(~{round(speed_kmh)} km/h) since the previous verification attempt"
        if flag else ""
    )
    return {"flag": flag, "detail": detail, "distance_km": round(distance_km, 1), "speed_kmh": round(speed_kmh, 1)}
