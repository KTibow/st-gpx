import type {
  ObaResponse,
  RouteEntry,
  VehicleEntry,
  TripScheduleEntry,
  StopEntry,
  RouteShapeEntry,
  VehiclesData,
} from './types'

const OBA_KEY = 'TEST'
const API = 'https://api.pugetsound.onebusaway.org/api/where'
const AGENCY = '40'


async function fetchOba<T>(path: string): Promise<T> {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}key=${OBA_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OBA ${res.status}: ${path}`)
  const data: ObaResponse<T> = await res.json()
  if (data.code !== 200) throw new Error(`OBA code ${data.code}: ${path}`)
  return data.data
}

// ── Routes ──
export async function fetchRoutes(): Promise<RouteEntry[]> {
  const data = await fetchOba<{ list: RouteEntry[] }>(`/routes-for-agency/${AGENCY}.json`)
  return data.list.filter(r => r.shortName)
    .sort((a, b) => a.shortName.localeCompare(b.shortName, undefined, { numeric: true }))
}

// ── Route shape (stops + polylines + stop details in references) ──
export async function fetchRouteShape(routeId: string): Promise<{ shape: RouteShapeEntry; stops: StopEntry[] } | null> {
  try {
    const url = `${API}/stops-for-route/${routeId}.json?key=${OBA_KEY}`
    const res = await fetch(url)
    const data: ObaResponse<{ entry: RouteShapeEntry }> & { data: { references?: { stops?: StopEntry[] } } } = await res.json()
    if (data.code !== 200) throw new Error(`OBA code ${data.code}`)
    const stops = data.data.references?.stops || []
    return { shape: data.data.entry, stops }
  } catch { return null }
}

// ── Trip IDs for a route (for matching vehicles) ──
export async function fetchTripIdsForRoute(routeId: string): Promise<Set<string>> {
  try {
    const data = await fetchOba<{ list: TripScheduleEntry[] }>(`/trips-for-route/${routeId}.json`)
    const ids = new Set<string>()
    for (const t of data.list) {
      if (t.tripId) ids.add(t.tripId)
    }
    return ids
  } catch { return new Set() }
}

// ── All vehicles for agency (includes route info in references) ──
export async function fetchAllVehicles(): Promise<VehiclesData> {
  const data = await fetchOba<VehiclesData>(`/vehicles-for-agency/${AGENCY}.json`)
  return data
}

// ── Trip details with stop times ──
export async function fetchTripDetails(tripId: string): Promise<{
  tripId: string
  serviceDate: number
  schedule: { stopTimes: Array<{ arrivalTime: number; departureTime: number; stopId: string; distanceAlongTrip: number }> }
} | null> {
  try {
    const data = await fetchOba<{ entry: { tripId: string; serviceDate: number; schedule: { stopTimes: Array<{ arrivalTime: number; departureTime: number; stopId: string; distanceAlongTrip: number }> } } }>(`/trip-details/${tripId}.json`)
    return data.entry
  } catch { return null }
}

// ── Decode Google polyline ──
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return []
  const pts: [number, number][] = []
  let i = 0, lat = 0, lng = 0
  while (i < encoded.length) {
    let b: number, s = 0, r = 0
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5 } while (b >= 0x20)
    lat += (r & 1) ? ~(r >> 1) : (r >> 1)
    s = 0; r = 0
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5 } while (b >= 0x20)
    lng += (r & 1) ? ~(r >> 1) : (r >> 1)
    pts.push([lat * 1e-5, lng * 1e-5])
  }
  return pts
}
