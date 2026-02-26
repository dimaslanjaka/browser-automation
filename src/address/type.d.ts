import { AxiosRequestConfig } from 'axios';

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

export interface AxiosConfigBuilderOptions extends AxiosRequestConfig {
  [key: string]: any;
  /**
   * Optional proxy URL to route requests through.
   * Example:
   *   - socks5://host:port
   *   - socks4://host:port
   *   - http://host:port
   *   - https://host:port
   */
  proxy?: string;
}

export interface GeocodeOptions {
  /**
   * If true, do not read cached results.
   */
  noCache?: boolean;
  /**
   * If true, log cache operations.
   */
  verbose?: boolean;
  /**
   * Optional proxy URL to route requests through.
   * Example:
   *   - socks5://host:port
   *   - socks4://host:port
   *   - http://host:port
   *   - https://host:port
   */
  proxy?: string;
}

export interface StreetAddressInfo {
  keyword: string | null;
  provider: 'nominatim' | 'geoapify';
  fullAddress: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  country: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  raw: GeocodeResult | null;
}
