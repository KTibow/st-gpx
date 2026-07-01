export interface ObaResponse<T> {
  code: number
  currentTime: number
  data: T
}

export interface RouteEntry {
  id: string
  shortName: string
  longName: string
  description: string
  agencyId: string
  color?: string
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

export interface TripScheduleEntry {
  tripId: string
  serviceDate: number
  status: string
  schedule: {
    nextTripId: string
    previousTripId: string
    stopTimes: Array<{
      arrivalTime: number
      departureTime: number
      stopId: string
      stopHeadsign: string
      distanceAlongTrip: number
    }>
    timeZone: string
  }
}

export interface StopEntry {
  id: string
  name: string
  lat: number
  lon: number
  code: string
  direction: string
  routeIds: string[]
}

export interface RouteShapeEntry {
  stopIds: string[]
  polylines: Array<{ points: string }>
  stopGroupings: Array<{
    type: string
    stopGroups: Array<{
      name: { name: string; names: string[]; type: string }
      stopIds: string[]
    }>
  }>
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
