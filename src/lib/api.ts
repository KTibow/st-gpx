import type {
  ObaResponse,
  VehicleEntry,
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

// ── All vehicles for agency (includes route info in references) ──
export async function fetchAllVehicles(): Promise<VehiclesData> {
  const data = await fetchOba<VehiclesData>(`/vehicles-for-agency/${AGENCY}.json`)
  return data
}
