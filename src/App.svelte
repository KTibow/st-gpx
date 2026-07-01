<script lang="ts">
  import { onMount } from 'svelte'
  import { now } from './lib/now.svelte'
  import { fetchAllVehicles } from './lib/api'
  import { generateGpx } from './lib/gpx'
  import type { VehicleEntry, TrackPoint, VehicleReferences } from './lib/types'

  // ── State ──
  let vehicles = $state<VehicleEntry[]>([])
  let refs = $state<VehicleReferences>({ trips: [], routes: [] })
  let selectedVehicleId = $state('')
  let trackPoints = $state<TrackPoint[]>([])
  let isTracking = $state(false)
  let pollingTimer: ReturnType<typeof setInterval> | null = null
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let lastRefresh = $state(0)

  onMount(async () => {
    await refreshVehicles()
    refreshTimer = setInterval(refreshVehicles, 15000)
  })

  async function refreshVehicles() {
    try {
      const data = await fetchAllVehicles()
      vehicles = data.list
      refs = data.references
      lastRefresh = Date.now()
    } catch (e) { console.error(e) }
  }

  // ── Lookups from references ──
  let tripRouteMap = $derived.by(() => {
    const m = new Map<string, string>()
    for (const t of refs.trips) {
      if (t.id && t.routeId) m.set(t.id, t.routeId)
    }
    return m
  })
  let routeInfoMap = $derived.by(() => {
    const m = new Map<string, { shortName: string; longName: string; color?: string; textColor?: string }>()
    for (const r of refs.routes) {
      if (r.id) m.set(r.id, { shortName: r.shortName, longName: r.longName, color: r.color, textColor: r.textColor })
    }
    return m
  })
  let tripHeadsignMap = $derived.by(() => {
    const m = new Map<string, string>()
    for (const t of refs.trips) {
      if (t.id && t.tripHeadsign) m.set(t.id, t.tripHeadsign)
    }
    return m
  })

  function vehicleRouteName(v: VehicleEntry): string {
    if (!v.tripId) return ''
    const routeId = tripRouteMap.get(v.tripId)
    if (!routeId) return ''
    const info = routeInfoMap.get(routeId)
    return info?.shortName || info?.longName || routeId
  }

  function vehicleRouteStyle(v: VehicleEntry): string {
    if (!v.tripId) return ''
    const routeId = tripRouteMap.get(v.tripId)
    if (!routeId) return ''
    const info = routeInfoMap.get(routeId)
    if (!info?.color) return ''
    const bg = `#${info.color}`
    const fg = info.textColor ? `#${info.textColor}` : '#ffffff'
    return `background:${bg};color:${fg}`
  }
  function vehicleHeadsign(v: VehicleEntry): string {
    if (!v.tripId) return ''
    return tripHeadsignMap.get(v.tripId) || ''
  }
  function vehicleProgress(v: VehicleEntry): number | null {
    const ts = v.tripStatus
    if (!ts || !ts.totalDistanceAlongTrip) return null
    return Math.round((ts.distanceAlongTrip / ts.totalDistanceAlongTrip) * 100)
  }

  // ── Derived ──
  let activeVehicles = $derived(
    vehicles.filter(v => {
      if (!v.tripId) return false
      const age = (v.tripStatus?.lastUpdateTime || v.lastUpdateTime || 0)
      if (!age) return false
      // Only show vehicles updated in the last 10 minutes
      return (Date.now() - age) < 600000
    }).sort((a, b) => a.vehicleId.localeCompare(b.vehicleId, undefined, { numeric: true }))
  )

  let selectedVehicle = $derived(vehicles.find(v => v.vehicleId === selectedVehicleId) || null)

  let trackCount = $derived(trackPoints.length)
  let canDownload = $derived(trackPoints.length >= 2)

  // ── Tracking ──
  function startTracking() {
    if (!selectedVehicleId) return
    if (isTracking) return
    isTracking = true
    pollOnce()
    pollingTimer = setInterval(pollOnce, 5000)
  }

  function stopTracking() {
    isTracking = false
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
  }

  async function pollOnce() {
    try {
      const data = await fetchAllVehicles()
      const v = data.list.find(x => x.vehicleId === selectedVehicleId)
      if (!v) return

      const pos = v.location || v.tripStatus?.position
      if (!pos || !pos.lat || !pos.lon) return

      const ts = v.tripStatus?.lastUpdateTime || v.lastUpdateTime || v.lastLocationUpdateTime
      if (!ts) return

      // Dedup by exact OBA timestamp
      if (trackPoints.some(p => p.time === ts)) return

      trackPoints = [...trackPoints, {
        lat: pos.lat,
        lon: pos.lon,
        time: ts,
        observedAt: Date.now(),
        phase: v.tripStatus?.phase || v.status || '',
        vehicleId: v.vehicleId,
        tripId: v.tripId || '',
        distanceAlongTrip: v.tripStatus?.distanceAlongTrip || 0,
        scheduleDeviation: v.tripStatus?.scheduleDeviation || 0,
      }]
    } catch (e) { console.error('poll:', e) }
  }

  function downloadGpx() {
    if (trackPoints.length < 2) return
    const gpx = generateGpx(trackPoints, {
      routeName: selectedVehicle?.tripId || selectedVehicleId,
      vehicleId: selectedVehicleId,
      tripId: trackPoints[0]?.tripId || '',
    })
    const blob = new Blob([gpx], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `st-${selectedVehicleId}-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.gpx`
    a.click()
    URL.revokeObjectURL(url)
  }

  function clearTrack() { trackPoints = [] }

  // Track SVG bounds
  let trackSvgBounds = $derived.by(() => {
    if (trackPoints.length < 2) return null
    const lats = trackPoints.map(p => p.lat)
    const lons = trackPoints.map(p => p.lon)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const pad = 0.002
    return { minLat, maxLat, minLon, maxLon, pad }
  })
  function tsx(lon: number): number {
    if (!trackSvgBounds) return 200
    const { minLon, maxLon, pad } = trackSvgBounds
    return ((lon - minLon + pad) / (maxLon - minLon + 2 * pad)) * 400
  }
  function tsy(lat: number): number {
    if (!trackSvgBounds) return 300
    const { minLat, maxLat, pad } = trackSvgBounds
    return (1 - (lat - minLat + pad) / (maxLat - minLat + 2 * pad)) * 600
  }

  // ── Helpers ──
  function ageStr(ts: number): string {
    const sec = Math.round((now.getTime() - ts) / 1000)
    if (sec < 3) return 'now'
    if (sec < 120) return `${sec}s ago`
    return `${Math.floor(sec / 60)}m ${sec % 60}s ago`
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString()
  }
</script>

<!-- Left panel -->
<div id="panel">
    <div class="panel-header">
      <span class="panel-title">ST GPX</span>
      <span class="panel-count label-sm">{activeVehicles.length} active</span>
      <button class="btn-icon" onclick={refreshVehicles} title="Refresh">⟳</button>
    </div>

    {#if isTracking}
      <!-- Tracking view -->
      <div class="tracking-view">
        <div class="track-head">
          <span class="track-badge">● {selectedVehicleId}</span>
          <span class="track-stats">
            <span class="mono">{trackCount}</span> pts ·
            <span class="mono">{trackCount > 1 ? ((trackPoints[trackPoints.length-1].time - trackPoints[0].time)/60000).toFixed(1) : '—'}</span> min
          </span>
          <div class="track-actions">
            <button class="btn-sm" onclick={clearTrack}>Clear</button>
            <button class="btn-danger" onclick={stopTracking}>■ Stop</button>
          </div>
        </div>

        {#if trackPoints.length > 0}
          <div class="track-log">
            {#each [...trackPoints].reverse() as pt, i}
              <div class="log-row">
                <span class="log-idx mono">{trackPoints.length - i}</span>
                <span class="log-coord mono">{pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}</span>
                <span class="log-time mono">{formatTime(pt.time)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-row">awaiting first position…</div>
        {/if}

        <div class="track-foot">
          <button class="btn-primary" disabled={!canDownload} onclick={downloadGpx}>
            ⬇ Download GPX
          </button>
        </div>
      </div>
    {:else}
      <!-- Vehicle list -->
      <div class="vehicle-list">
        {#each activeVehicles as v (v.vehicleId)}
          {@const pos = v.location || v.tripStatus?.position}
          {@const ts = v.tripStatus?.lastUpdateTime || v.lastUpdateTime}
          {@const dev = v.tripStatus?.scheduleDeviation}
          {@const hs = vehicleHeadsign(v)}
          {@const prog = vehicleProgress(v)}
          <button
            class="v-card"
            onclick={() => { selectedVehicleId = v.vehicleId; startTracking(); }}
          >
            <div class="v-head">
              <span class="v-id mono">{v.vehicleId}</span>
              {#if vehicleRouteName(v)}
                <span class="v-route" style={vehicleRouteStyle(v)}>{vehicleRouteName(v)}</span>
              {/if}
              {#if hs}
                <span class="v-dest">→ {hs}</span>
              {/if}
              <span class="v-age mono">{ageStr(ts)}</span>
            </div>
            <div class="v-sub">
              {#if pos}
                <span class="v-pos mono">{pos.lat.toFixed(4)}, {pos.lon.toFixed(4)}</span>
              {/if}
              {#if prog != null}
                <span class="v-prog">{prog}%</span>
              {/if}
              {#if dev != null}
                <span class="v-dev mono" class:late={dev > 30} class:early={dev < -30}>
                  {dev > 0 ? '+' : ''}{Math.round(dev / 60)}m
                </span>
              {/if}
            </div>
          </button>
        {:else}
          <div class="empty-row">no active vehicles</div>
        {/each}
      </div>


    {/if}
  </div>

<!-- Map preview -->
<div id="map">
    {#if trackPoints.length > 1}
      <svg class="route-svg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet">
        <polyline
          points={trackPoints.map(p => `${tsx(p.lon)},${tsy(p.lat)}`).join(' ')}
          fill="none"
          stroke="#d32f2f"
          stroke-width="3"
          stroke-opacity="0.8"
          stroke-linejoin="round"
        />
        {#each trackPoints as p}
          <circle cx={tsx(p.lon)} cy={tsy(p.lat)} r="2.5" fill="#d32f2f" opacity="0.5"/>
        {/each}
        <circle
          cx={tsx(trackPoints[trackPoints.length-1].lon)}
          cy={tsy(trackPoints[trackPoints.length-1].lat)}
          r="6" fill="#d32f2f" stroke="#fff" stroke-width="2"
        />
      </svg>
    {:else}
      <div class="map-placeholder">
        <div class="empty-icon">🚍</div>
        <p class="label-sm">{vehicles.length} vehicles · {refs.routes.length} routes · tap one to track</p>
      </div>
    {/if}
  </div>

<style>
  :global(body) {
    display: grid;
    grid-template-columns: 380px 1fr;
    height: 100dvh;
    margin: 0;
  }

  #panel {
    display: flex;
    flex-direction: column;
    background: var(--m3c-surface-container-low);
    border-right: 1px solid var(--m3c-outline-variant);
    overflow: hidden;
  }
  #map {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--m3c-surface);
    overflow: hidden;
  }

  @media (max-width: 768px) {
    :global(body) {
      grid-template-columns: 1fr;
    }
    #map {
      display: none;
    }
  }

  /* Panel header */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--m3c-outline-variant);
  }
  .panel-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--m3c-on-surface);
  }
  .panel-count {
    margin-left: auto;
  }
  .btn-icon {
    background: none;
    border: 1px solid var(--m3c-outline-variant);
    border-radius: 6px;
    color: var(--m3c-on-surface-variant);
    font-size: 14px;
    line-height: 1;
    padding: 2px 6px;
    cursor: pointer;
  }
  .btn-icon:hover { background: var(--m3c-surface-container-high); border-color: var(--m3c-primary); color: var(--m3c-primary); }

  /* Vehicle list */
  .vehicle-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .v-card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px 10px;
    border-radius: 8px;
    background: var(--m3c-surface-container);
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    transition: all 0.1s;
  }
  .v-card:hover { background: var(--m3c-surface-container-high); }
  .v-head { display: flex; align-items: center; gap: 6px; }
  .v-id { font-size: 13px; font-weight: 600; }
  .v-route { font-size: 11px; font-weight: 600; padding: 0 5px; border-radius: 3px; background: color-mix(in srgb, currentColor 12%, transparent); }
  .v-dest { font-size: 10px; color: var(--m3c-secondary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
  .v-age { font-size: 10px; color: var(--m3c-on-surface-variant); opacity: 0.7; margin-left: auto; }
  .v-sub { display: flex; gap: 8px; align-items: center; font-size: 10px; }
  .v-pos { color: var(--m3c-on-surface-variant); }
  .v-prog { font-size: 10px; font-weight: 700; color: var(--m3c-primary); }
  .v-dev { font-weight: 600; }
  .v-dev.late { color: var(--m3c-error); }
  .v-dev.early { color: var(--m3c-tertiary); }

  .empty-row {
    padding: 24px 16px;
    text-align: center;
    color: var(--m3c-on-surface-variant);
    font-size: 12px;
    opacity: 0.6;
  }

  /* Buttons */
  .btn-primary {
    width: 100%;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: var(--m3c-primary);
    color: var(--m3c-on-primary);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.15); }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }

  .btn-sm {
    padding: 4px 10px;
    border: 1px solid var(--m3c-outline);
    border-radius: 6px;
    background: transparent;
    color: var(--m3c-on-surface-variant);
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-sm:hover { border-color: var(--m3c-primary); color: var(--m3c-primary); }

  .btn-danger {
    padding: 4px 10px;
    border: none;
    border-radius: 6px;
    background: var(--m3c-error);
    color: var(--m3c-on-error);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Tracking view */
  .tracking-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 6px;
  }
  .track-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--m3c-surface-container);
    border-radius: 8px;
    border: 1px solid var(--m3c-primary-container-subtle);
  }
  .track-badge {
    font-size: 12px;
    font-weight: 700;
    color: var(--m3c-error);
  }
  .track-stats {
    font-size: 11px;
    color: var(--m3c-on-surface-variant);
  }
  .track-actions {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }

  .track-log {
    flex: 1;
    overflow-y: auto;
    background: var(--m3c-surface-container-high);
    border-radius: 8px;
    padding: 4px;
  }
  .log-row {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    padding: 2px 4px;
  }
  .log-idx { color: var(--m3c-on-surface-variant); opacity: 0.4; width: 22px; text-align: right; }
  .log-coord { flex: 1; color: var(--m3c-on-surface); }
  .log-time { color: var(--m3c-on-surface-variant); }

  .track-foot {
    padding: 2px 0;
  }

  .route-svg { width: 100%; height: 100%; }
  .map-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--m3c-on-surface-variant);
    opacity: 0.5;
  }
  .empty-icon { font-size: 32px; }


</style>
