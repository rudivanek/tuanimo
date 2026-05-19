export type MoodKey =
  | 'joy'
  | 'calm'
  | 'sadness'
  | 'anxiety'
  | 'anger'
  | 'stress'
  | 'loneliness'
  | 'overwhelm'
  | 'uncertainty'
  | 'neutral';

export type MoodState = {
  mood: MoodKey;
  valence: number;
  arousal: number;
  confidence: number;
  reasons: string[];
  updatedAt: string;
};
