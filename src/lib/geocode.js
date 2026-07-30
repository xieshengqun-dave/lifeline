import { Platform } from "react-native";
import * as Location from "expo-location";

// Geocoding with expo-location's shapes, working on every platform:
// - native: expo-location (the OS geocoder — unchanged behavior)
// - web + Google key: Google Geocoding API (same EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
//   as the web map; enable "Geocoding API" alongside "Maps JavaScript API")
// - web without key: OpenStreetMap Nominatim (free, rate-limited — fine for
//   pilot traffic, not for production volume)
//
// Shapes kept identical to expo-location so the screens don't care:
//   geocodeAsync(q)        -> [{ latitude, longitude }]
//   reverseGeocodeAsync(c) -> [{ name, street, district, city }]

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const isWeb = Platform.OS === "web";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`geocode http ${res.status}`);
  return res.json();
}

function fromGoogleComponents(result) {
  const get = (type) =>
    result.address_components?.find((c) => c.types.includes(type))?.long_name || null;
  return {
    name: result.formatted_address?.split(",")[0] || null,
    street: get("route"),
    district: get("sublocality") || get("sublocality_level_1") || get("locality"),
    city: get("locality") || get("administrative_area_level_2"),
  };
}

export async function geocodeAsync(query) {
  if (!isWeb) return Location.geocodeAsync(query);

  if (KEY) {
    const data = await fetchJson(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=my&key=${encodeURIComponent(KEY)}`
    );
    return (data.results || []).map((r) => ({
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
    }));
  }

  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=my&q=${encodeURIComponent(query)}`
  );
  return (data || []).map((r) => ({ latitude: Number(r.lat), longitude: Number(r.lon) }));
}

export async function reverseGeocodeAsync({ latitude, longitude }) {
  if (!isWeb) return Location.reverseGeocodeAsync({ latitude, longitude });

  try {
    if (KEY) {
      const data = await fetchJson(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(KEY)}`
      );
      const first = data.results?.[0];
      return first ? [fromGoogleComponents(first)] : [];
    }

    const r = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    if (!r?.address) return [];
    const a = r.address;
    return [{
      name: a.amenity || a.building || a.road || null,
      street: a.road || null,
      district: a.suburb || a.city_district || null,
      city: a.city || a.town || a.state || null,
    }];
  } catch {
    return []; // reverse labels are cosmetic — never fail the flow over them
  }
}
