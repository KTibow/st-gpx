export interface ObaResponse<T> {
  code: number
  currentTime: number
  data: T
}

export interface VehicleEntry {
  vehicleId: string
  tripId: string
  status: string
  phase: string
  lastUpdateTime: number
  lastLocationUpdateTime: number
  location?: { lat: number; lon: number }
  tripStatus?: {
    activeTripId: string
    position?: { lat: number; lon: number }
    phase: string
    status: string
    scheduleDeviation: number
    nextStop: string
    nextStopTimeOffset: number
    closestStop: string
    closestStopTimeOffset: number
    distanceAlongTrip: number
    totalDistanceAlongTrip: number
    lastUpdateTime: number
    predicted: boolean
    serviceDate: number
  }
}

interface StopEntry {
  id: string
  name: string
  lat: number
  lon: number
  code: string
  direction: string
  routeIds: string[]
}

interface TripRefEntry {
  id: string
  routeId: string
  blockId?: string
  tripHeadsign?: string
  directionId?: string
  serviceId?: string
  shapeId?: string
}

interface RouteRefEntry {
  id: string
  shortName: string
  longName: string
  description?: string
  agencyId?: string
  color?: string
  textColor?: string
  type?: number
}

export interface VehicleReferences {
  trips: TripRefEntry[]
  routes: RouteRefEntry[]
  stops?: StopEntry[]
  agencies?: Array<{ id: string; name: string }>
}

export interface VehiclesData {
  list: VehicleEntry[]
  references: VehicleReferences
}

export interface TrackPoint {
  lat: number
  lon: number
  time: number // OBA lastUpdateTime (ms epoch)
  observedAt: number // when we polled (ms epoch)
  phase: string
  vehicleId: string
  tripId: string
  distanceAlongTrip: number
  scheduleDeviation: number
}
