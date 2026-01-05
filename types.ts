// Fix: Defined the BirthEvent interface to resolve the 'not a module' error in RecentBirths.tsx
export interface BirthEvent {
  id: string;
  gender: 'boy' | 'girl';
  timestamp: number;
}
