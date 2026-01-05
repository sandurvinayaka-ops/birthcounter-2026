
import { CountryData } from './types';

// Approximate global birth data based on UN/World Bank estimates
export const COUNTRIES: CountryData[] = [
  { id: 'IND', name: 'India', birthRate: 17.0, population: 1428000000, weight: 24.2 },
  { id: 'CHN', name: 'China', birthRate: 6.7, population: 1412000000, weight: 9.4 },
  { id: 'NGA', name: 'Nigeria', birthRate: 36.5, population: 218500000, weight: 8.0 },
  { id: 'PAK', name: 'Pakistan', birthRate: 27.2, population: 235800000, weight: 6.4 },
  { id: 'IDN', name: 'Indonesia', birthRate: 16.4, population: 275500000, weight: 4.5 },
  { id: 'USA', name: 'United States', birthRate: 11.0, population: 333300000, weight: 3.6 },
  { id: 'ETH', name: 'Ethiopia', birthRate: 32.0, population: 123400000, weight: 3.9 },
  { id: 'BRA', name: 'Brazil', birthRate: 12.5, population: 214300000, weight: 2.7 },
  { id: 'BGD', name: 'Bangladesh', birthRate: 17.8, population: 171200000, weight: 3.0 },
  { id: 'COD', name: 'DR Congo', birthRate: 41.5, population: 99000000, weight: 4.1 },
  { id: 'RUS', name: 'Russia', birthRate: 9.6, population: 143400000, weight: 1.4 },
  { id: 'JPN', name: 'Japan', birthRate: 6.6, population: 125100000, weight: 0.8 },
  { id: 'MEX', name: 'Mexico', birthRate: 15.5, population: 126700000, weight: 2.0 },
  { id: 'PHL', name: 'Philippines', birthRate: 17.5, population: 115600000, weight: 2.0 },
  { id: 'EGY', name: 'Egypt', birthRate: 23.5, population: 111000000, weight: 2.6 },
  { id: 'VNM', name: 'Vietnam', birthRate: 15.0, population: 98100000, weight: 1.5 },
  { id: 'TUR', name: 'Turkey', birthRate: 14.2, population: 85300000, weight: 1.2 },
  { id: 'IRN', name: 'Iran', birthRate: 13.5, population: 88500000, weight: 1.2 },
  { id: 'DEU', name: 'Germany', birthRate: 9.4, population: 83200000, weight: 0.8 },
  { id: 'THA', name: 'Thailand', birthRate: 9.0, population: 71600000, weight: 0.6 },
  { id: 'GBR', name: 'UK', birthRate: 10.1, population: 67300000, weight: 0.7 },
  { id: 'FRA', name: 'France', birthRate: 10.5, population: 67800000, weight: 0.7 },
  { id: 'ITA', name: 'Italy', birthRate: 6.8, population: 58900000, weight: 0.4 },
  { id: 'ZAF', name: 'South South Africa', birthRate: 19.4, population: 59900000, weight: 1.2 },
  { id: 'CAN', name: 'Canada', birthRate: 9.9, population: 38200000, weight: 0.4 },
  { id: 'AUS', name: 'Australia', birthRate: 12.1, population: 25700000, weight: 0.3 },
  // Default fallback weight for other countries
  { id: 'OTHER', name: 'Rest of World', birthRate: 18.0, population: 1500000000, weight: 12.0 }
];

export const GLOBAL_BIRTHS_PER_SECOND = 4.3; // Approx 370,000 births per day
