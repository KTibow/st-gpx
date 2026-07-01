import type { TrackPoint } from './types'

/**
 * Generate a GPX string from an array of track points.
 * Each point gets its OBA timestamp as the <time> element.
 */
export function generateGpx(
  trackPoints: TrackPoint[],
  meta: { routeName: string; vehicleId: string; tripId: string }
): string {
  if (trackPoints.length === 0) return ''

  const sorted = [...trackPoints].sort((a, b) => a.time - b.time)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const fmt = (ts: number) => new Date(ts).toISOString()

  let trkpts = ''
  for (const p of sorted) {
    trkpts += `      <trkpt lat="${p.lat}" lon="${p.lon}">
        <time>${fmt(p.time)}</time>
        <cmt>phase:${p.phase} dev:${p.scheduleDeviation}s dist:${Math.round(p.distanceAlongTrip)}m</cmt>
      </trkpt>\n`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="st-gpx"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${xmlEsc(meta.routeName)} — ${xmlEsc(meta.vehicleId)}</name>
    <desc>Track captured via OneBusAway polling. Trip ${xmlEsc(meta.tripId)}. ${sorted.length} points from ${fmt(first.time)} to ${fmt(last.time)}.</desc>
    <author>
      <name>st-gpx</name>
    </author>
  </metadata>
  <trk>
    <name>${xmlEsc(meta.routeName)} — ${xmlEsc(meta.vehicleId)}</name>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`
}

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * Given a polyline and a distance along it, find the interpolated position.
 * polyline: array of [lat, lon] points
 * distances: array of cumulative distances for each point in polyline
 * targetDist: distance along the polyline to find
 */
export function interpolatePosition(
  polyline: [number, number][],
  cumulativeDists: number[],
  targetDist: number
): { lat: number; lon: number } {
  if (polyline.length === 0) return { lat: 0, lon: 0 }
  if (targetDist <= 0) return { lat: polyline[0][0], lon: polyline[0][1] }
  const last = polyline.length - 1
  if (targetDist >= cumulativeDists[last]) return { lat: polyline[last][0], lon: polyline[last][1] }

  // Binary search for the segment
  let lo = 0, hi = last
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (cumulativeDists[mid] <= targetDist) lo = mid
    else hi = mid
  }

  const segStart = cumulativeDists[lo]
  const segEnd = cumulativeDists[lo + 1]
  const segLen = segEnd - segStart
  const frac = segLen > 0 ? (targetDist - segStart) / segLen : 0

  return {
    lat: polyline[lo][0] + (polyline[lo + 1][0] - polyline[lo][0]) * frac,
    lon: polyline[lo][1] + (polyline[lo + 1][1] - polyline[lo][1]) * frac,
  }
}

/**
 * Calculate cumulative distances along a polyline (Haversine).
 */
export function cumulativeDistances(polyline: [number, number][]): number[] {
  const dists: number[] = [0]
  for (let i = 1; i < polyline.length; i++) {
    dists.push(dists[i - 1] + haversine(polyline[i - 1], polyline[i]))
  }
  return dists
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * sinDLon * sinDLon
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
