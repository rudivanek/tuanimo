import { NYC_PLACE_NAMES } from '../config/entityLists';

export type TopicKey = 'travel' | 'food' | 'art' | 'work' | 'relationships' | 'health' | 'other';

export interface TopicState {
  topicKey: TopicKey;
  entities: string[];
  confidence: number;
  updatedAt: string;
}

function extractNycEntities(text: string): string[] {
  const found: string[] = [];
  for (const ent of NYC_PLACE_NAMES) {
    if (text.toLowerCase().includes(ent.toLowerCase())) found.push(ent);
  }
  return found;
}

interface TopicPattern {
  key: TopicKey;
  patterns: RegExp[];
  entityExtractor?: (text: string) => string[];
  subFlavor?: string;
}

const TOPIC_PATTERNS: TopicPattern[] = [
  {
    key: 'travel',
    patterns: [
      /\b(nueva york|nyc|new york|manhattan|brooklyn|queens|bronx|midtown|downtown|soho|tribeca|harlem|central park|times square)\b/i,
      /\b(itinerario|viaje|visitar|turismo|ciudad|aeropuerto|hotel|alojamiento|vuelo)\b/i,
      /\b(barrios?|vecindarios?|caminata|recorrer|explorar la ciudad|tour|guía de viaje|excursión|ruta|paseo)\b/i,
      /\b(metro|transporte|taxi|uber)\b/i,
    ],
    entityExtractor: extractNycEntities,
  },
  {
    key: 'art',
    subFlavor: 'art',
    patterns: [
      /\b(museo|museos|galería|galerías|moma|guggenheim|\bmet\b|whitney|arte\b|exposición|exhibición|pintura|escultura)\b/i,
    ],
  },
  {
    key: 'food',
    subFlavor: 'food',
    patterns: [
      /\b(restaurante|restaurantes|comida|pizza|deli|sushi|brunch|café|cafés|bares?|bistró|gastronomía)\b/i,
    ],
  },
  {
    key: 'work',
    patterns: [
      /\b(trabajo|empleo|jefe|empresa|proyecto|reunión|presentación|clientes?|oficina|carrera|negocio|renunciar)\b/i,
    ],
  },
  {
    key: 'relationships',
    patterns: [
      /\b(pareja|amigos?|familia|mamá|papá|hermano|hermana|relación|amistad|discutí con|pelea con)\b/i,
    ],
  },
  {
    key: 'health',
    patterns: [
      /\b(salud|médico|enfermedad|síntomas?|tratamiento|ejercicio|dormir|dieta|nutrición|terapia)\b/i,
    ],
  },
];

export function detectTopic(
  lastUserMessage: string,
  recentMessages = '',
): TopicState {
  const allText = lastUserMessage + ' ' + recentMessages;

  const scores = new Map<TopicKey, number>();
  const subFlavors = new Set<string>();
  const allEntities: string[] = [];

  for (const tp of TOPIC_PATTERNS) {
    let score = 0;
    for (const pat of tp.patterns) {
      if (pat.test(allText)) score++;
    }
    if (score > 0) {
      scores.set(tp.key, (scores.get(tp.key) ?? 0) + score);
      if (tp.entityExtractor) {
        for (const e of tp.entityExtractor(allText)) {
          if (!allEntities.includes(e)) allEntities.push(e);
        }
      }
      if (tp.subFlavor) subFlavors.add(tp.subFlavor);
    }
  }

  if (scores.size === 0) {
    return { topicKey: 'other', entities: [], confidence: 0.3, updatedAt: new Date().toISOString() };
  }

  const travelScore = scores.get('travel') ?? 0;
  const artScore = scores.get('art') ?? 0;
  const foodScore = scores.get('food') ?? 0;

  let topicKey: TopicKey;
  let confidence: number;

  if (travelScore > 0) {
    topicKey = 'travel';
    confidence = Math.min(0.5 + travelScore * 0.15 + artScore * 0.05 + foodScore * 0.05, 0.95);
    if (artScore > 0 && !allEntities.includes('art')) allEntities.push('art');
    if (foodScore > 0 && !allEntities.includes('food')) allEntities.push('food');
  } else {
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    topicKey = sorted[0][0];
    confidence = Math.min(0.5 + sorted[0][1] * 0.15, 0.95);
  }

  return {
    topicKey,
    entities: allEntities,
    confidence,
    updatedAt: new Date().toISOString(),
  };
}
