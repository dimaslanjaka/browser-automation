export interface GeocodeResult {
  [key: string]: any;
  keyword: string;
  fullAddress: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
  address: {
    [key: string]: any;
    road?: string;
    neighbourhood?: string;
    village?: string;
    city_district?: string;
    city?: string;
    state?: string;
    region?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    'ISO3166-2-lvl4'?: string;
    'ISO3166-2-lvl3'?: string;
  };
}
