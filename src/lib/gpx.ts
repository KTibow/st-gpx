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

