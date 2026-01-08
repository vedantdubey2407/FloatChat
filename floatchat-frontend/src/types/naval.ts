export interface OceanPoint {
  lat: number;
  lng: number;
  temp: number;
  psu: number;
  doxy: number;
  wave_height: number;
}

export type LayerType = 'TEMP' | 'PSU' | 'DOXY' | 'WAVES';

export interface RouteData {
  basic_info: {
    origin: { name: string; coordinates: string };
    destination: { name: string; coordinates: string };
    primary_route_name: string;
    distance_nm: number;
    estimated_time_days: number;
    speed_knots: number;
    risk_level: 'SAFE' | 'CAUTION' | 'DANGER';
  };
  risk_breakdown?: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }>;
  weather_summary?: {
    avg_wave_height_m: string;
    avg_wind_speed_knots: string;
    weather_notes: string;
  };
  good_to_have?: {
    fuel_estimation: { estimated_fuel_tons: number; estimated_fuel_cost_usd: number };
    traffic_zones: string[];
  };
  alternate_routes?: Array<{ route_name: string; rejection_reason: string }>;
  captain_summary: string;
  decision_analysis?: {
    explain_route_decision: {
        chosen_route_reason: string;
        rejected_routes: Array<{ route_name: string; rejection_reason: string }>;
        trade_off_summary: string;
    }
  };
}