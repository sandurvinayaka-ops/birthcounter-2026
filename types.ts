
export interface CountryData {
  id: string;
  name: string;
  birthRate: number; // Births per 1000 people per year
  population: number;
  weight: number; // Relative probability of a birth occurring here
}

export interface BirthEvent {
  id: string;
  countryId: string;
  countryName: string;
  timestamp: number;
  gender: 'boy' | 'girl';
}

export interface Stats {
  totalBirthsToday: number;
  sessionBirths: number;
  birthsPerMinute: number;
}
