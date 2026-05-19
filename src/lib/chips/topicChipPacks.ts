import type { TopicState } from '../topicDetect/topicDetect';
import { NYC_PLACE_NAMES } from '../config/entityLists';

export interface TopicChip {
  id: string;
  label: string;
  intentKey: string;
  insertText: string;
  priority: number;
}

const NYC_CHIPS: TopicChip[] = [
  {
    id: 'nyc_museums',
    label: 'Museos imperdibles',
    intentKey: 'topic_travel_museums',
    insertText: 'Quiero una lista de museos imperdibles en Nueva York y por qué valen la pena.',
    priority: 10,
  },
  {
    id: 'nyc_neighborhoods',
    label: 'Barrios para caminar',
    intentKey: 'topic_travel_neighborhoods',
    insertText: 'Quiero sugerencias de barrios para caminar en Nueva York y qué ver en cada uno.',
    priority: 9,
  },
  {
    id: 'nyc_itinerary',
    label: 'Itinerario 3 días',
    intentKey: 'topic_travel_itinerary',
    insertText: 'Quiero un itinerario de 3 días bien organizado para recorrer Nueva York.',
    priority: 8,
  },
  {
    id: 'nyc_restaurants',
    label: 'Restaurantes por presupuesto',
    intentKey: 'topic_travel_restaurants',
    insertText: 'Busco restaurantes en Nueva York según presupuesto: económico, medio y alto.',
    priority: 7,
  },
  {
    id: 'nyc_rain',
    label: 'Plan para días de lluvia',
    intentKey: 'topic_travel_rain',
    insertText: 'Quiero un plan de actividades para días de lluvia en Nueva York.',
    priority: 6,
  },
  {
    id: 'nyc_metro',
    label: 'Tips de metro',
    intentKey: 'topic_travel_metro',
    insertText: 'Quiero consejos para moverme en metro en Nueva York y evitar errores comunes.',
    priority: 5,
  },
  {
    id: 'nyc_local',
    label: 'Experiencias locales',
    intentKey: 'topic_travel_local',
    insertText: 'Me gustaría experiencias locales menos turísticas en Nueva York.',
    priority: 4,
  },
  {
    id: 'nyc_budget',
    label: 'Nueva York con presupuesto',
    intentKey: 'topic_travel_budget',
    insertText: 'Quiero ideas para aprovechar Nueva York al máximo sin gastar demasiado.',
    priority: 3,
  },
];

const NYC_ART_CHIPS: TopicChip[] = [
  {
    id: 'nyc_museums',
    label: 'Museos imperdibles',
    intentKey: 'topic_travel_museums',
    insertText: 'Quiero una lista de museos imperdibles en Nueva York y por qué valen la pena.',
    priority: 10,
  },
  {
    id: 'nyc_galleries',
    label: 'Galerías en Chelsea',
    intentKey: 'topic_travel_galleries',
    insertText: 'Me gustaría recomendaciones de galerías en Chelsea y cómo recorrerlas.',
    priority: 9,
  },
  {
    id: 'nyc_art_itinerary',
    label: 'Itinerario arte 2 días',
    intentKey: 'topic_travel_art_itinerary',
    insertText: 'Quiero un itinerario de 2 días enfocado en arte y museos en Nueva York.',
    priority: 8,
  },
  {
    id: 'nyc_neighborhoods',
    label: 'Barrios para caminar',
    intentKey: 'topic_travel_neighborhoods',
    insertText: 'Quiero sugerencias de barrios para caminar en Nueva York y qué ver en cada uno.',
    priority: 7,
  },
  {
    id: 'nyc_local',
    label: 'Experiencias locales',
    intentKey: 'topic_travel_local',
    insertText: 'Me gustaría experiencias locales menos turísticas en Nueva York.',
    priority: 6,
  },
  {
    id: 'nyc_restaurants',
    label: 'Restaurantes por presupuesto',
    intentKey: 'topic_travel_restaurants',
    insertText: 'Busco restaurantes en Nueva York según presupuesto: económico, medio y alto.',
    priority: 5,
  },
];

const TRAVEL_GENERIC_CHIPS: TopicChip[] = [
  {
    id: 'travel_itinerary',
    label: 'Armar un itinerario',
    intentKey: 'topic_travel_itinerary',
    insertText: 'Quiero ayuda para armar un itinerario bien organizado para mi viaje.',
    priority: 10,
  },
  {
    id: 'travel_places',
    label: 'Lugares imperdibles',
    intentKey: 'topic_travel_places',
    insertText: 'Quiero una lista de lugares imperdibles que no me puedo perder en mi destino.',
    priority: 9,
  },
  {
    id: 'travel_food',
    label: 'Dónde comer',
    intentKey: 'topic_travel_food',
    insertText: 'Quiero recomendaciones de dónde comer bien según diferentes presupuestos.',
    priority: 8,
  },
  {
    id: 'travel_tips',
    label: 'Tips de viaje',
    intentKey: 'topic_travel_tips',
    insertText: 'Quiero consejos prácticos para aprovechar mi viaje al máximo.',
    priority: 7,
  },
  {
    id: 'travel_budget',
    label: 'Viaje con presupuesto',
    intentKey: 'topic_travel_budget',
    insertText: 'Quiero ideas para hacer un viaje memorable sin gastar demasiado.',
    priority: 6,
  },
  {
    id: 'travel_local',
    label: 'Experiencias locales',
    intentKey: 'topic_travel_local',
    insertText: 'Me gustaría descubrir experiencias locales auténticas, menos turísticas.',
    priority: 5,
  },
];

const NYC_ENTITIES = new Set(NYC_PLACE_NAMES);

function isNYC(entities: string[]): boolean {
  return entities.some(e => NYC_ENTITIES.has(e));
}

export function getTopicChipPack(topicState: TopicState, count = 6): TopicChip[] {
  if (topicState.topicKey === 'travel') {
    if (isNYC(topicState.entities)) {
      const hasArtFlavor = topicState.entities.includes('art');
      const pack = hasArtFlavor ? NYC_ART_CHIPS : NYC_CHIPS;
      return pack.sort((a, b) => b.priority - a.priority).slice(0, count);
    }
    return TRAVEL_GENERIC_CHIPS.slice(0, count);
  }
  return [];
}
