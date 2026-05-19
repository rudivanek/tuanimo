export type LeakType =
  | 'RECOMMENDATION'
  | 'INSTRUCTIONS'
  | 'PLANNING'
  | 'COMPARISON'
  | 'REFERENCE_FACTS'
  | 'ROLE_OVERRIDE_COMPLIANCE'
  | 'EDUCATIONAL_EXPLANATION';

export type LeakResult = {
  leaked: boolean;
  leakTypes: LeakType[];
  reasons: string[];
};

export type RedirectionQuality = {
  hasQuestion: boolean;
  hasEmotionalLanguage: boolean;
  hasActionableSupport: boolean;
  qualityPass: boolean;
};

const RECOMMENDATION_PHRASES = [
  'i recommend', 'i would recommend', 'you should', 'you could try',
  'best ', 'top ', 'must-see', 'must see', 'worth visiting', 'worth seeing',
  'worth it', 'worth trying', 'go with', 'choose ', 'opt for',
  'i suggest', 'my suggestion', 'my recommendation', 'the best option',
  'here are some', 'here is a list', 'here are a few',
  'consider ', 'try this', 'check out',
];

const INSTRUCTION_PATTERNS = [
  /\bstep\s+\d+\b/i,
  /\bstep one\b/i,
  /\bstep two\b/i,
  /\bfirst[,.]?\s+(you|we|start|begin|make|add|take)\b/i,
  /\bthen\b.{5,}\bthen\b/i,
  /\bafter that\b/i,
  /\bnext[,.]?\s+(you|we|add|take|apply)\b/i,
  /\bfinally[,.]?\s+(you|we|add)\b/i,
  /(^|\n)\s*\d+[.)]\s+/m,
  /(^|\n)\s*[-*•]\s+/m,
  /\bhow to\b.{0,60}:/i,
  /here'?s? (how|what (to|you)|the (way|steps|process))/i,
];

const PLANNING_PHRASES = [
  'day 1', 'day 2', 'day 3', 'day one', 'day two', 'day three',
  'week 1', 'week 2', 'month 1',
  'morning:', 'afternoon:', 'evening:', 'night:',
  'monday:', 'tuesday:', 'wednesday:', 'thursday:', 'friday:',
  'checklist', 'schedule', 'plan:', 'itinerary',
  'stop 1', 'stop 2', 'first stop', 'second stop',
  'phase 1', 'phase 2', 'stage 1', 'stage 2',
  '30-day', '30 day', '7-day', '7 day',
];

const COMPARISON_PATTERNS = [
  /\bpros\s+(and|&)\s+cons\b/i,
  /\badvantages\s+(and|&)\s+disadvantages\b/i,
  /\b\w+\s+vs\.?\s+\w+\b/i,
  /\bbetter than\b/i,
  /\bcompared to\b/i,
  /\bthe (main )?difference between\b/i,
  /\bon (the )?one hand.{5,}on (the )?other\b/i,
  /\bwhile \w+ (has|is|offers)\b/i,
];

const FACTUAL_TONE_PATTERNS = [
  /\bis defined as\b/i,
  /\bit means\b/i,
  /\baccording to\b/i,
  /\bin \d{4}\b/,
  /\b(was|were) (born|founded|established|created|invented|discovered)\b/i,
  /\b(is|are) (a|an|the) (type|form|kind|branch|field|science|process|system|method)\b/i,
  /\b(refers to|is known as|also called)\b/i,
  /\bthe (capital|population|currency|president|prime minister|GDP|area|language)\b/i,
  /\b\d+\s*(mg|ml|kg|lbs|km|miles|calories|percent|%)\b/i,
  /\$\d+/,
  /\b\d{4}\b.*\b(war|revolution|founded|born|died|president|election)\b/i,
  /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+(tiene|ofrece|cuenta con|se destaca|es famoso|es conocid|es reconocid)\b/,
];

// Phrases characteristic of educational/explanatory mode
const EDUCATIONAL_TONE_PHRASES = [
  'es una ', 'es un ', 'es el ', 'es la ',
  'se define como', 'se caracteriza por', 'consiste en',
  'la historia de', 'history of',
  'en general,', 'en general ',
  'fue fundad', 'fue creado', 'fue desarrollado',
  'tiene su origen', 'tiene sus raíces',
  'es conocido como', 'también conocido como',
  'se refiere a', 'hace referencia a',
  'es una rama', 'es una forma', 'es un tipo',
  'is a form of', 'is a type of', 'is a branch of',
  'refers to', 'is defined as', 'is known as',
  'originated in', 'was founded in', 'has its roots in',
  'in general,', 'generally speaking',
  'oferta gastronómica', 'rica y variada', 'cocina típica', 'gastronomía local',
  'platos típicos', 'platos tradicionales', 'especialidad local', 'especialidades locales',
  'cuisine is', 'local cuisine', 'traditional dishes', 'known for its food',
  'rich culinary', 'culinary scene', 'culinary tradition',
];

// Heuristic: 3+ sentences with no reflective question mark = likely educational lecture
function hasFactualLectureStructure(text: string): boolean {
  const sentences = text.split(/[.!]+/).filter(s => s.trim().length > 20);
  const hasQuestion = text.includes('?');
  return sentences.length >= 3 && !hasQuestion;
}

const ROLE_OVERRIDE_SIGNALS = [
  /\bas (chatgpt|an? (ai|assistant|language model|llm))[,\s]/i,
  /\bi'?m (chatgpt|gpt|openai|an? (general|unrestricted))/i,
  /\bin (unrestricted|normal|standard|default) mode\b/i,
  /\bsure[,!]\s+(here|i can|let me)/i,
  /\bof course[,!]\s+(here|i can|let me)/i,
  /\bno problem[,!]\s+(here|i can|let me)/i,
  /\bhere('?s| is) (the|a) (answer|information|list|recommendation|step)/i,
];

const EMOTIONAL_REDIRECT_WORDS = [
  'feel', 'feeling', 'emotion', 'emotional', 'heart', 'mind',
  "what's going on", 'what is going on', 'matters to you', 'how is this',
  'how are you', 'tell me more', 'share', 'experience', 'meaning',
  'siento', 'emociones', 'lo que está pasando', 'qué importa',
  'cuéntame', 'cómo te', 'lo que sientes', 'afecta', 'importante para ti',
];

export function detectUrlLeakage(text: string): LeakResult {
  const leakTypes = new Set<LeakType>();
  const reasons: string[] = [];
  const raw = text || '';

  if (/https?:\/\/[^\s]+/i.test(raw)) {
    leakTypes.add('REFERENCE_FACTS');
    reasons.push('External URL present in response');
  }
  if (/youtube\.com|youtu\.be/i.test(raw)) {
    leakTypes.add('REFERENCE_FACTS');
    reasons.push('YouTube reference present in response');
  }

  return { leaked: leakTypes.size > 0, leakTypes: [...leakTypes], reasons };
}

export function detectFactualLeakage(text: string, options: { allowInstructions?: boolean } = {}): LeakResult {
  const leakTypes = new Set<LeakType>();
  const reasons: string[] = [];
  const t = (text || '').toLowerCase();
  const raw = text || '';

  const hitRec = RECOMMENDATION_PHRASES.find(w => t.includes(w));
  if (hitRec) {
    leakTypes.add('RECOMMENDATION');
    reasons.push(`Recommendation language: "${hitRec}"`);
  }

  if (!options.allowInstructions) {
    for (const pattern of INSTRUCTION_PATTERNS) {
      if (pattern.test(raw)) {
        leakTypes.add('INSTRUCTIONS');
        reasons.push(`Instructional structure: ${pattern.source}`);
        break;
      }
    }
  }

  const hitPlan = PLANNING_PHRASES.find(w => t.includes(w));
  if (hitPlan) {
    leakTypes.add('PLANNING');
    reasons.push(`Planning structure: "${hitPlan}"`);
  }

  for (const pattern of COMPARISON_PATTERNS) {
    if (pattern.test(raw)) {
      leakTypes.add('COMPARISON');
      reasons.push(`Comparison structure: ${pattern.source}`);
      break;
    }
  }

  for (const pattern of FACTUAL_TONE_PATTERNS) {
    if (pattern.test(raw)) {
      leakTypes.add('REFERENCE_FACTS');
      reasons.push(`Factual/reference tone: ${pattern.source}`);
      break;
    }
  }

  for (const pattern of ROLE_OVERRIDE_SIGNALS) {
    if (pattern.test(raw)) {
      leakTypes.add('ROLE_OVERRIDE_COMPLIANCE');
      reasons.push(`Role override compliance: ${pattern.source}`);
      break;
    }
  }

  const hitEdu = EDUCATIONAL_TONE_PHRASES.find(w => t.includes(w));
  if (hitEdu) {
    leakTypes.add('EDUCATIONAL_EXPLANATION');
    reasons.push(`Educational tone phrase: "${hitEdu}"`);
  } else if (hasFactualLectureStructure(raw)) {
    leakTypes.add('EDUCATIONAL_EXPLANATION');
    reasons.push('Factual lecture structure: 3+ sentences without a reflective question');
  }

  return {
    leaked: leakTypes.size > 0,
    leakTypes: [...leakTypes],
    reasons,
  };
}

const COPING_EXERCISE_SIGNALS = [
  /\b(inhala|exhala|respira)\b/i,
  /inhala?\s*\d+|exhala?\s*\d+|\d+\s*(segundos|counts?|tiempos?|cuentas?)/i,
  /\b(retén|retén el aire|retén por)\b/i,
  /\b(5[- ]?4[- ]?3[- ]?2[- ]?1|cinco.*cuatro.*tres)\b/i,
  /\b(nombra|observa|mira)\s+\d+\s+(cosas?|sonidos?|objetos?)/i,
  /\b(aprieta|suelta|baja)\s+(los?\s+)?(puños?|hombros?|mandíbula)\b/i,
  /\b(repite|di en voz|di:)\b/i,
  /\b(mantra|frase guía|frase corta)\b/i,
  /paso\s*\d+|\d+\.\s+\w/i,
];

export function checkRedirectionQuality(text: string): RedirectionQuality {
  const t = (text || '').toLowerCase();
  const raw = text || '';
  const hasQuestion = text.includes('?');
  const hasEmotionalLanguage = EMOTIONAL_REDIRECT_WORDS.some(w => t.includes(w));
  const hasActionableSupport = COPING_EXERCISE_SIGNALS.some(p => p.test(raw));
  return {
    hasQuestion,
    hasEmotionalLanguage,
    hasActionableSupport,
    qualityPass: (hasQuestion || hasActionableSupport) && hasEmotionalLanguage,
  };
}
