/**
 * Exercise Catalog with official workout playlist and category SVGs
 * Every exercise is mapped to its specific instructional video within the official NASM playlist.
 */

export const PLAYLIST_ID = 'PLeVb1RGNTvddYk2ixJqdmstqY3DuTsTSd';
export const PLAYLIST_DEFAULT_VIDEO_ID = '_7sVQlruVZc';
export const PLAYLIST_VIDEO_ID = '_7sVQlruVZc'; // Backwards compatibility default
export const PLAYLIST_URL = `https://www.youtube.com/watch?v=${PLAYLIST_DEFAULT_VIDEO_ID}&list=${PLAYLIST_ID}`;
export const PLAYLIST_COLLECTION_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

export interface CatalogExercise {
  id: string;
  name: string;
  target_muscle: 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Abs' | 'Legs' | 'Full Body' | 'Forearms';
  category: 'Strength' | 'Calisthenics' | 'Cardio' | 'Core';
  equipment: string;
  default_sets: number;
  default_reps: string;
  youtube_id: string;
  thumbnail_url: string;
  description: string;
  keywords: string[];
}

export function makeSvgThumbnail(bgColor: string, accentColor: string, iconType: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <rect width="96" height="96" rx="22" fill="${bgColor}"/>
    <circle cx="48" cy="42" r="24" fill="${accentColor}" fill-opacity="0.16"/>
    <g transform="translate(24, 18)" stroke="${accentColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
      ${getSvgIconPath(iconType)}
    </g>
    <text x="48" y="80" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9" font-weight="700" letter-spacing="0.5">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getSvgIconPath(type: string): string {
  switch (type) {
    case 'pushup':
      return `<path d="M4 32 L16 32 L24 22 L36 22 L44 32"/><circle cx="24" cy="12" r="5"/><path d="M12 32 L12 40"/><path d="M36 32 L36 40"/>`;
    case 'dumbbell':
      return `<path d="M8 16 L8 32"/><path d="M40 16 L40 32"/><rect x="4" y="20" width="8" height="8" rx="2"/><rect x="36" y="20" width="8" height="8" rx="2"/><path d="M12 24 L36 24"/>`;
    case 'core':
      return `<path d="M16 8 C20 18, 28 18, 32 8"/><path d="M14 20 C20 28, 28 28, 34 20"/><path d="M16 32 C20 38, 28 38, 32 32"/><circle cx="24" cy="24" r="16"/>`;
    case 'plank':
      return `<path d="M4 28 L40 20"/><circle cx="38" cy="14" r="5"/><path d="M34 22 L30 38"/><path d="M12 26 L12 38"/>`;
    case 'legs':
      return `<path d="M16 10 L24 22 L32 10"/><path d="M20 22 L16 38"/><path d="M28 22 L32 38"/><circle cx="24" cy="6" r="4"/>`;
    case 'pullup':
      return `<path d="M4 10 L44 10"/><path d="M16 10 L20 24 L28 24 L32 10"/><circle cx="24" cy="18" r="5"/><path d="M24 24 L24 38"/>`;
    default:
      return `<circle cx="24" cy="24" r="14"/><path d="M24 16 L24 32 M16 24 L32 24"/>`;
  }
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // User's core routine movements mapped to specific playlist tutorials:
  {
    id: 'pushup-chest',
    name: 'Push-ups (Blue/Chest position)',
    target_muscle: 'Chest',
    category: 'Calisthenics',
    equipment: 'Push-up Board / Floor',
    default_sets: 4,
    default_reps: '10-12',
    youtube_id: 'WDIpL0pjun0', // How to do a Push-Up
    thumbnail_url: makeSvgThumbnail('#0F172A', '#38BDF8', 'pushup', 'CHEST'),
    description: 'Targeted chest push-up with wide hands position on board or floor.',
    keywords: ['push-ups (blue/chest position)', 'push-ups', 'pushups', 'chest', 'blue', 'push up', 'standard push-up'],
  },
  {
    id: 'pushup-back',
    name: 'Push-ups (Yellow/Back position)',
    target_muscle: 'Back',
    category: 'Calisthenics',
    equipment: 'Push-up Board / Floor',
    default_sets: 4,
    default_reps: '10-12',
    youtube_id: 'k0cTJCfxa0Y', // Seated Machine Row: Close Grip (Back tutorial in playlist)
    thumbnail_url: makeSvgThumbnail('#1E1B4B', '#FBBF24', 'pushup', 'BACK'),
    description: 'Push-ups targeted for lat activation using yellow angle grips.',
    keywords: ['push-ups (yellow/back position)', 'yellow', 'lats', 'back pushup', 'seated machine row'],
  },
  {
    id: 'pushup-shoulders',
    name: 'Push-ups (Red/Shoulder position)',
    target_muscle: 'Shoulders',
    category: 'Calisthenics',
    equipment: 'Push-up Board / Floor',
    default_sets: 3,
    default_reps: '10-12',
    youtube_id: '2b5t0Cu2nQI', // How to do a Pike Push-Up (Shoulder push-up in playlist)
    thumbnail_url: makeSvgThumbnail('#2A1215', '#F87171', 'pushup', 'SHOULDERS'),
    description: 'Pike-angled push-ups emphasizing anterior deltoids and clavicular head.',
    keywords: ['push-ups (red/shoulder position)', 'red', 'pike push up', 'pike push-up', 'shoulder pushup'],
  },
  {
    id: 'pushup-triceps',
    name: 'Push-ups (Green/Triceps position)',
    target_muscle: 'Triceps',
    category: 'Calisthenics',
    equipment: 'Push-up Board / Floor',
    default_sets: 3,
    default_reps: '12',
    youtube_id: 'LJeqLAmJLfs', // How to do a Close Grip Bench Press (Triceps emphasis in playlist)
    thumbnail_url: makeSvgThumbnail('#052E16', '#34D399', 'pushup', 'TRICEPS'),
    description: 'Narrow grip push-ups emphasizing triceps brachii long and lateral heads.',
    keywords: ['push-ups (green/triceps position)', 'green', 'tricep', 'close grip', 'close grip pushup'],
  },
  {
    id: 'db-shoulder-press',
    name: 'Dumbbell shoulder press',
    target_muscle: 'Shoulders',
    category: 'Strength',
    equipment: 'Dumbbells',
    default_sets: 3,
    default_reps: '10-12',
    youtube_id: '2b5t0Cu2nQI', // How to do a Pike Push-Up / Shoulder Press tutorial
    thumbnail_url: makeSvgThumbnail('#2A1215', '#F87171', 'dumbbell', 'SHOULDERS'),
    description: 'Overhead pressing movement targeting deltoids and upper pectorals.',
    keywords: ['dumbbell shoulder press', 'shoulder press', 'overhead press', 'dumbbell press shoulders'],
  },
  {
    id: 'db-bicep-curls',
    name: 'Dumbbell bicep curls',
    target_muscle: 'Biceps',
    category: 'Strength',
    equipment: 'Dumbbells',
    default_sets: 3,
    default_reps: '12',
    youtube_id: 'CFBZ4jN1CMI', // How to do a Dumbbell Hammer Curl
    thumbnail_url: makeSvgThumbnail('#1E1B4B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: 'Free-weight curls building biceps peak and forearm brachioradialis.',
    keywords: ['dumbbell bicep curls', 'bicep curls', 'hammer curl', 'dumbbell curl'],
  },
  {
    id: 'db-lateral-raises',
    name: 'Dumbbell lateral raises',
    target_muscle: 'Shoulders',
    category: 'Strength',
    equipment: 'Dumbbells',
    default_sets: 3,
    default_reps: '15',
    youtube_id: 'uBEXsoMclPY', // How to do an Iron Cross / Lateral Raises
    thumbnail_url: makeSvgThumbnail('#2A1215', '#F87171', 'dumbbell', 'SHOULDERS'),
    description: 'Lateral shoulder raises isolating the lateral head of deltoids.',
    keywords: ['dumbbell lateral raises', 'lateral raises', 'lateral raise', 'iron cross', 'side raises'],
  },
  {
    id: 'abs-knee-raises',
    name: 'Hanging knee raises or lying leg raises',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Pull-up Bar / Mat',
    default_sets: 4,
    default_reps: '12-15',
    youtube_id: 'wtKWBzDwfIM', // Reverse Crunch to Knee-Up with Rotation
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'core', 'ABS'),
    description: 'Lower abdominal focus pulling pelvis up to activate lower rectus abdominis.',
    keywords: ['hanging knee raises or lying leg raises', 'knee raises', 'lying leg raises', 'leg raises', 'hanging knee raises'],
  },
  {
    id: 'abs-weighted-crunches',
    name: 'Weighted crunches (hold dumbbell)',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Dumbbell / Mat',
    default_sets: 4,
    default_reps: '15',
    youtube_id: 'wtKWBzDwfIM', // Reverse Crunch to Knee-Up with Rotation
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'core', 'ABS'),
    description: 'Resistance crunch curling thoracic spine to compress upper abdominals.',
    keywords: ['weighted crunches (hold dumbbell)', 'weighted crunches', 'crunches', 'dumbbell crunches'],
  },
  {
    id: 'abs-russian-twists',
    name: 'Russian twists (with dumbbell)',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Dumbbell / Mat',
    default_sets: 4,
    default_reps: '15 per side',
    youtube_id: 's0kT80JLCfA', // How to do a Russian Twist
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'core', 'OBLIQUES'),
    description: 'Rotational core movement with torso angled at 45 degrees.',
    keywords: ['russian twists (with dumbbell)', 'russian twist', 'russian twists', 'with dumbbell'],
  },
  {
    id: 'abs-bicycle-crunches',
    name: 'Bicycle crunches',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Mat',
    default_sets: 3,
    default_reps: '20',
    youtube_id: 'bxn9FBrt4-A', // How to do a Dead Bug / Alternating Core
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'core', 'ABS'),
    description: 'Alternating contralateral elbow-to-knee rotational crunch.',
    keywords: ['bicycle crunches', 'bicycle crunch', 'dead bug', 'deadbug'],
  },
  {
    id: 'abs-plank',
    name: 'Plank',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Mat',
    default_sets: 3,
    default_reps: '40-60 sec',
    youtube_id: 'mwlp75MS6Rg', // How to do a Plank
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'plank', 'CORE'),
    description: 'Isometric prone core hold maintaining neutral lumbar spine and glute brace.',
    keywords: ['plank', 'planks', 'forearm plank', 'isometric plank'],
  },
  {
    id: 'abs-side-plank',
    name: 'Side plank',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Mat',
    default_sets: 3,
    default_reps: '25-35 sec per side',
    youtube_id: '44ND4bOB-T0', // How to do a Side Plank
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'plank', 'OBLIQUES'),
    description: 'Lateral pillar hold targeting quadratus lumborum and lateral obliques.',
    keywords: ['side plank', 'side planks', 'lateral plank'],
  },
  {
    id: 'abs-mountain-climbers',
    name: 'Mountain climbers',
    target_muscle: 'Abs',
    category: 'Core',
    equipment: 'Floor / Mat',
    default_sets: 3,
    default_reps: '20 per side',
    youtube_id: '6Tv4xTRPtUc', // How to do a Plank Walkup (dynamic plank / climbers)
    thumbnail_url: makeSvgThumbnail('#0F2A1D', '#2DD4BF', 'core', 'CARDIO'),
    description: 'Dynamic plank drive alternating knees toward chest with cadence.',
    keywords: ['mountain climbers', 'mountain climber', 'plank walkup', 'climbers'],
  },

  // Full NASM Playlist Video Library (77 exercises)
  {
    id: 'nasm-_7sVQlruVZc',
    name: "Lying Leg Curl: Two-Leg Concentric, Single-Leg Eccentric",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '_7sVQlruVZc',
    thumbnail_url: makeSvgThumbnail('#18181B', '#E11D48', 'legs', 'LEGS'),
    description: "Official NASM guide: Lying Leg Curl: Two-Leg Concentric, Single-Leg Eccentric",
    keywords: ["lying leg curl: two-leg concentric, single-leg eccentric","lying leg curl: two-leg concentric, single-leg eccentric"],
  },
  {
    id: 'nasm-BPGOyQKy9R0',
    name: "Kettlebell Crush Curl with Squat",
    target_muscle: "Biceps",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'BPGOyQKy9R0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: "Official NASM guide: Kettlebell Crush Curl with Squat",
    keywords: ["kettlebell crush curl with squat","kettlebell crush curl with squat"],
  },
  {
    id: 'nasm-kEH6jatSVSw',
    name: "Static Latissimus Dorsi Ball Stretch",
    target_muscle: "Back",
    category: "Calisthenics",
    equipment: "Mat",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'kEH6jatSVSw',
    thumbnail_url: makeSvgThumbnail('#18181B', '#A855F7', 'pullup', 'BACK'),
    description: "Official NASM guide: Static Latissimus Dorsi Ball Stretch",
    keywords: ["static latissimus dorsi ball stretch","static latissimus dorsi ball stretch"],
  },
  {
    id: 'nasm-Daq-wJMUnes',
    name: "Good Mornings",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'Daq-wJMUnes',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Good Mornings",
    keywords: ["good mornings","good mornings"],
  },
  {
    id: 'nasm-3DnMQpbWS1k',
    name: "Peripheral Heart Action (PHA) Stabilization Endurance Emphasis: Sequence 1",
    target_muscle: "Full Body",
    category: "Strength",
    equipment: "Gym Equipment",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '3DnMQpbWS1k',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'FULL BOD'),
    description: "Official NASM guide: Peripheral Heart Action (PHA) Stabilization Endurance Emphasis: Sequence 1",
    keywords: ["peripheral heart action (pha) stabilization endurance emphasis: sequence 1","peripheral heart action (pha) stabilization endurance emphasis: sequence 1"],
  },
  {
    id: 'nasm-QciWGMjD-nM',
    name: "Barbell Biceps Curl",
    target_muscle: "Biceps",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'QciWGMjD-nM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: "Official NASM guide: Barbell Biceps Curl",
    keywords: ["barbell biceps curl","barbell biceps curl"],
  },
  {
    id: 'nasm-CFBZ4jN1CMI',
    name: "Dumbbell Hammer Curl",
    target_muscle: "Biceps",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'CFBZ4jN1CMI',
    thumbnail_url: makeSvgThumbnail('#18181B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: "Official NASM guide: Dumbbell Hammer Curl",
    keywords: ["dumbbell hammer curl","dumbbell hammer curl"],
  },
  {
    id: 'nasm-J_d9LCMuyBU',
    name: "Bench Dumbbell Triceps Extension",
    target_muscle: "Triceps",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'J_d9LCMuyBU',
    thumbnail_url: makeSvgThumbnail('#18181B', '#34D399', 'pushup', 'TRICEPS'),
    description: "Official NASM guide: Bench Dumbbell Triceps Extension",
    keywords: ["bench dumbbell triceps extension","bench dumbbell triceps extension"],
  },
  {
    id: 'nasm-5RPVxmxnLRA',
    name: "Cable Triceps Extension with Shoulder Flexed",
    target_muscle: "Triceps",
    category: "Strength",
    equipment: "Cable",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '5RPVxmxnLRA',
    thumbnail_url: makeSvgThumbnail('#18181B', '#34D399', 'pushup', 'TRICEPS'),
    description: "Official NASM guide: Cable Triceps Extension with Shoulder Flexed",
    keywords: ["cable triceps extension with shoulder flexed","cable triceps extension with shoulder flexed"],
  },
  {
    id: 'nasm-nrQIgBFc4P8',
    name: "Wrist Flexion",
    target_muscle: "Forearms",
    category: "Strength",
    equipment: "Dumbbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'nrQIgBFc4P8',
    thumbnail_url: makeSvgThumbnail('#18181B', '#94A3B8', 'dumbbell', 'FOREARMS'),
    description: "Official NASM guide: Wrist Flexion",
    keywords: ["wrist flexion","wrist flexion"],
  },
  {
    id: 'nasm--06PlhD_aXE',
    name: "Wrist Extension",
    target_muscle: "Forearms",
    category: "Strength",
    equipment: "Dumbbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '-06PlhD_aXE',
    thumbnail_url: makeSvgThumbnail('#18181B', '#94A3B8', 'dumbbell', 'FOREARMS'),
    description: "Official NASM guide: Wrist Extension",
    keywords: ["wrist extension","wrist extension"],
  },
  {
    id: 'nasm-Du-eeiuW11I',
    name: "Wrist Supination/Pronation",
    target_muscle: "Forearms",
    category: "Strength",
    equipment: "Dumbbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'Du-eeiuW11I',
    thumbnail_url: makeSvgThumbnail('#18181B', '#94A3B8', 'dumbbell', 'FOREARMS'),
    description: "Official NASM guide: Wrist Supination/Pronation",
    keywords: ["wrist supination/pronation","wrist supination/pronation"],
  },
  {
    id: 'nasm-vaphPzdnXIg',
    name: "Cable Triceps Extension",
    target_muscle: "Triceps",
    category: "Strength",
    equipment: "Cable",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'vaphPzdnXIg',
    thumbnail_url: makeSvgThumbnail('#18181B', '#34D399', 'pushup', 'TRICEPS'),
    description: "Official NASM guide: Cable Triceps Extension",
    keywords: ["cable triceps extension","cable triceps extension"],
  },
  {
    id: 'nasm-NuEXzpxehRk',
    name: "Cable Biceps Curls with Shoulder Flexed",
    target_muscle: "Biceps",
    category: "Strength",
    equipment: "Cable",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'NuEXzpxehRk',
    thumbnail_url: makeSvgThumbnail('#18181B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: "Official NASM guide: Cable Biceps Curls with Shoulder Flexed",
    keywords: ["cable biceps curls with shoulder flexed","cable biceps curls with shoulder flexed"],
  },
  {
    id: 'nasm-_2Kd0d-JEUM',
    name: "Seated Leg Curl  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '_2Kd0d-JEUM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#E11D48', 'legs', 'LEGS'),
    description: "Official NASM guide: Seated Leg Curl  | Proper Form \\u0026 Technique",
    keywords: ["seated leg curl  | proper form \\u0026 technique","seated leg curl  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-pQfJR-sSIvA',
    name: "Barbell Bicep Curl | Proper Form \\u0026 Technique",
    target_muscle: "Biceps",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'pQfJR-sSIvA',
    thumbnail_url: makeSvgThumbnail('#18181B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: "Official NASM guide: Barbell Bicep Curl | Proper Form \\u0026 Technique",
    keywords: ["barbell bicep curl | proper form \\u0026 technique","barbell bicep curl | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-44ND4bOB-T0',
    name: "Side Plank  | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: '44ND4bOB-T0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'plank', 'ABS'),
    description: "Official NASM guide: Side Plank  | Proper Form \\u0026 Technique",
    keywords: ["side plank  | proper form \\u0026 technique","side plank  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-mwlp75MS6Rg',
    name: "Plank | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 'mwlp75MS6Rg',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'plank', 'ABS'),
    description: "Official NASM guide: Plank | Proper Form \\u0026 Technique",
    keywords: ["plank | proper form \\u0026 technique","plank | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-6Tv4xTRPtUc',
    name: "Plank Walkup  | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: '6Tv4xTRPtUc',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'plank', 'ABS'),
    description: "Official NASM guide: Plank Walkup  | Proper Form \\u0026 Technique",
    keywords: ["plank walkup  | proper form \\u0026 technique","plank walkup  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-MDxfAuBbHHA',
    name: "Straight-Arm Plank  | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 'MDxfAuBbHHA',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'plank', 'ABS'),
    description: "Official NASM guide: Straight-Arm Plank  | Proper Form \\u0026 Technique",
    keywords: ["straight-arm plank  | proper form \\u0026 technique","straight-arm plank  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-UYbsgiiZgao',
    name: "Prisoner Squat  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'UYbsgiiZgao',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Prisoner Squat  | Proper Form \\u0026 Technique",
    keywords: ["prisoner squat  | proper form \\u0026 technique","prisoner squat  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-hbw7hdyOpq0',
    name: "Bulgarian Split Squat  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'hbw7hdyOpq0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Bulgarian Split Squat  | Proper Form \\u0026 Technique",
    keywords: ["bulgarian split squat  | proper form \\u0026 technique","bulgarian split squat  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-nfX7IFK9UNI',
    name: "Goblet Squat  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'nfX7IFK9UNI',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Goblet Squat  | Proper Form \\u0026 Technique",
    keywords: ["goblet squat  | proper form \\u0026 technique","goblet squat  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-hZI8Yy5elZs',
    name: "Dumbbell Front Squat | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'hZI8Yy5elZs',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Dumbbell Front Squat | Proper Form \\u0026 Technique",
    keywords: ["dumbbell front squat | proper form \\u0026 technique","dumbbell front squat | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-OO7-dWIy0W8',
    name: "Squat Thrust (Burpees) | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'OO7-dWIy0W8',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Squat Thrust (Burpees) | Proper Form \\u0026 Technique",
    keywords: ["squat thrust (burpees) | proper form \\u0026 technique","squat thrust (burpees) | proper form \\u0026 technique"],
  },
  {
    id: 'nasm--TeEMXoHQPM',
    name: "Kettlebell Front Squat  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Kettlebell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '-TeEMXoHQPM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Kettlebell Front Squat  | Proper Form \\u0026 Technique",
    keywords: ["kettlebell front squat  | proper form \\u0026 technique","kettlebell front squat  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-ZdAHe9_HeEw',
    name: "Bird Dog | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 'ZdAHe9_HeEw',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'core', 'ABS'),
    description: "Official NASM guide: Bird Dog | Proper Form \\u0026 Technique",
    keywords: ["bird dog | proper form \\u0026 technique","bird dog | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-xgusDooVfKU',
    name: "Romanian Deadlift (Barbell) | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'xgusDooVfKU',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Romanian Deadlift (Barbell) | Proper Form \\u0026 Technique",
    keywords: ["romanian deadlift (barbell) | proper form \\u0026 technique","romanian deadlift (barbell) | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-aa57T45iFSE',
    name: "Dumbbell Romanian Deadlift | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'aa57T45iFSE',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Dumbbell Romanian Deadlift | Proper Form \\u0026 Technique",
    keywords: ["dumbbell romanian deadlift | proper form \\u0026 technique","dumbbell romanian deadlift | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-s0kT80JLCfA',
    name: "Russian Twist  | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 's0kT80JLCfA',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'core', 'ABS'),
    description: "Official NASM guide: Russian Twist  | Proper Form \\u0026 Technique",
    keywords: ["russian twist  | proper form \\u0026 technique","russian twist  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-wtKWBzDwfIM',
    name: "Reverse Crunch to Knee-Up with Rotation | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 'wtKWBzDwfIM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'core', 'ABS'),
    description: "Official NASM guide: Reverse Crunch to Knee-Up with Rotation | Proper Form \\u0026 Technique",
    keywords: ["reverse crunch to knee-up with rotation | proper form \\u0026 technique","reverse crunch to knee-up with rotation | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-WDIpL0pjun0',
    name: "Push-Up | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'WDIpL0pjun0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'pushup', 'CHEST'),
    description: "Official NASM guide: Push-Up | Proper Form \\u0026 Technique",
    keywords: ["push-up | proper form \\u0026 technique","push-up | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-MH4gcTKQiEc',
    name: "Plyometric Push-Up | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'MH4gcTKQiEc',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'pushup', 'CHEST'),
    description: "Official NASM guide: Plyometric Push-Up | Proper Form \\u0026 Technique",
    keywords: ["plyometric push-up | proper form \\u0026 technique","plyometric push-up | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-2b5t0Cu2nQI',
    name: "Pike Push-Up  | Proper Form \\u0026 Technique",
    target_muscle: "Shoulders",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '2b5t0Cu2nQI',
    thumbnail_url: makeSvgThumbnail('#18181B', '#F87171', 'pushup', 'SHOULDER'),
    description: "Official NASM guide: Pike Push-Up  | Proper Form \\u0026 Technique",
    keywords: ["pike push-up  | proper form \\u0026 technique","pike push-up  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-h45WmYKSJG0',
    name: "Inverted Push-Up | Proper Form \\u0026 Technique",
    target_muscle: "Shoulders",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'h45WmYKSJG0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#F87171', 'pushup', 'SHOULDER'),
    description: "Official NASM guide: Inverted Push-Up | Proper Form \\u0026 Technique",
    keywords: ["inverted push-up | proper form \\u0026 technique","inverted push-up | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-DBz85WuXqMk',
    name: "Decline Push-Up  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'DBz85WuXqMk',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'pushup', 'CHEST'),
    description: "Official NASM guide: Decline Push-Up  | Proper Form \\u0026 Technique",
    keywords: ["decline push-up  | proper form \\u0026 technique","decline push-up  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-0JUrOH--Kdk',
    name: "Incline Push-Up | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '0JUrOH--Kdk',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'pushup', 'CHEST'),
    description: "Official NASM guide: Incline Push-Up | Proper Form \\u0026 Technique",
    keywords: ["incline push-up | proper form \\u0026 technique","incline push-up | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-8AoKggMjPkc',
    name: "Archer Push-Up  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '8AoKggMjPkc',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'pushup', 'CHEST'),
    description: "Official NASM guide: Archer Push-Up  | Proper Form \\u0026 Technique",
    keywords: ["archer push-up  | proper form \\u0026 technique","archer push-up  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-PDr5B2jLUOw',
    name: "Modified Push-Up | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Calisthenics",
    equipment: "Floor / Push-up Board",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'PDr5B2jLUOw',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'pushup', 'CHEST'),
    description: "Official NASM guide: Modified Push-Up | Proper Form \\u0026 Technique",
    keywords: ["modified push-up | proper form \\u0026 technique","modified push-up | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-8k435cj30gc',
    name: "Leg Press Calf Raise | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '8k435cj30gc',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Leg Press Calf Raise | Proper Form \\u0026 Technique",
    keywords: ["leg press calf raise | proper form \\u0026 technique","leg press calf raise | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-uLVt6u15L98',
    name: "Jumping Jack  | Proper Form \\u0026 Technique",
    target_muscle: "Full Body",
    category: "Cardio",
    equipment: "Bodyweight",
    default_sets: 3,
    default_reps: "45 sec",
    youtube_id: 'uLVt6u15L98',
    thumbnail_url: makeSvgThumbnail('#18181B', '#EC4899', 'legs', 'FULL BOD'),
    description: "Official NASM guide: Jumping Jack  | Proper Form \\u0026 Technique",
    keywords: ["jumping jack  | proper form \\u0026 technique","jumping jack  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-cDGOn-yfKJA',
    name: "Leg Press  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'cDGOn-yfKJA',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Leg Press  | Proper Form \\u0026 Technique",
    keywords: ["leg press  | proper form \\u0026 technique","leg press  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-3aYsOsBA7ZE',
    name: "Single Leg Press  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '3aYsOsBA7ZE',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Single Leg Press  | Proper Form \\u0026 Technique",
    keywords: ["single leg press  | proper form \\u0026 technique","single leg press  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-DXu-8TAJwi4',
    name: "Box Jumps | Proper Form \\u0026 Technique",
    target_muscle: "Full Body",
    category: "Cardio",
    equipment: "Bodyweight",
    default_sets: 3,
    default_reps: "45 sec",
    youtube_id: 'DXu-8TAJwi4',
    thumbnail_url: makeSvgThumbnail('#18181B', '#EC4899', 'legs', 'FULL BOD'),
    description: "Official NASM guide: Box Jumps | Proper Form \\u0026 Technique",
    keywords: ["box jumps | proper form \\u0026 technique","box jumps | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-uBEXsoMclPY',
    name: "Iron Cross | Proper Form \\u0026 Technique",
    target_muscle: "Shoulders",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'uBEXsoMclPY',
    thumbnail_url: makeSvgThumbnail('#18181B', '#F87171', 'dumbbell', 'SHOULDER'),
    description: "Official NASM guide: Iron Cross | Proper Form \\u0026 Technique",
    keywords: ["iron cross | proper form \\u0026 technique","iron cross | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-eTCBSFlCJ_s',
    name: "Face Pull | Proper Form \\u0026 Technique",
    target_muscle: "Shoulders",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'eTCBSFlCJ_s',
    thumbnail_url: makeSvgThumbnail('#18181B', '#F87171', 'dumbbell', 'SHOULDER'),
    description: "Official NASM guide: Face Pull | Proper Form \\u0026 Technique",
    keywords: ["face pull | proper form \\u0026 technique","face pull | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-U9tijfMcfP8',
    name: "Levator Scapulae Stretch | Proper Form \\u0026 Technique",
    target_muscle: "Back",
    category: "Calisthenics",
    equipment: "Mat",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'U9tijfMcfP8',
    thumbnail_url: makeSvgThumbnail('#18181B', '#A855F7', 'pullup', 'BACK'),
    description: "Official NASM guide: Levator Scapulae Stretch | Proper Form \\u0026 Technique",
    keywords: ["levator scapulae stretch | proper form \\u0026 technique","levator scapulae stretch | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-XY6JrX1wyxk',
    name: "Cable Crossover  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Cable",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'XY6JrX1wyxk',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Cable Crossover  | Proper Form \\u0026 Technique",
    keywords: ["cable crossover  | proper form \\u0026 technique","cable crossover  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-LJeqLAmJLfs',
    name: "Close Grip Bench Press  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'LJeqLAmJLfs',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Close Grip Bench Press  | Proper Form \\u0026 Technique",
    keywords: ["close grip bench press  | proper form \\u0026 technique","close grip bench press  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-bxn9FBrt4-A',
    name: "Dead Bug | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 'bxn9FBrt4-A',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'core', 'ABS'),
    description: "Official NASM guide: Dead Bug | Proper Form \\u0026 Technique",
    keywords: ["dead bug | proper form \\u0026 technique","dead bug | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-_5kDxC0flg0',
    name: "Lunge Jump  | Proper Form \\u0026 Technique",
    target_muscle: "Full Body",
    category: "Cardio",
    equipment: "Bodyweight",
    default_sets: 3,
    default_reps: "45 sec",
    youtube_id: '_5kDxC0flg0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#EC4899', 'legs', 'FULL BOD'),
    description: "Official NASM guide: Lunge Jump  | Proper Form \\u0026 Technique",
    keywords: ["lunge jump  | proper form \\u0026 technique","lunge jump  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-k0cTJCfxa0Y',
    name: "Seated Machine Row: Close Grip",
    target_muscle: "Back",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'k0cTJCfxa0Y',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FBBF24', 'pullup', 'BACK'),
    description: "Official NASM guide: Seated Machine Row: Close Grip",
    keywords: ["seated machine row: close grip","seated machine row: close grip"],
  },
  {
    id: 'nasm-_ZX_zTOBgp8',
    name: "Child's Pose Stretch | Proper Form \\u0026 Technique",
    target_muscle: "Back",
    category: "Calisthenics",
    equipment: "Mat",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '_ZX_zTOBgp8',
    thumbnail_url: makeSvgThumbnail('#18181B', '#A855F7', 'pullup', 'BACK'),
    description: "Official NASM guide: Child's Pose Stretch | Proper Form \\u0026 Technique",
    keywords: ["child's pose stretch | proper form \\u0026 technique","child's pose stretch | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-vmPx6mEim8E',
    name: "Stir the Pot  | Proper Form \\u0026 Technique",
    target_muscle: "Abs",
    category: "Core",
    equipment: "Bodyweight / Mat",
    default_sets: 3,
    default_reps: "15-20",
    youtube_id: 'vmPx6mEim8E',
    thumbnail_url: makeSvgThumbnail('#18181B', '#2DD4BF', 'core', 'ABS'),
    description: "Official NASM guide: Stir the Pot  | Proper Form \\u0026 Technique",
    keywords: ["stir the pot  | proper form \\u0026 technique","stir the pot  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm--bnJGikRGsM',
    name: "Tuck Jump | Proper Form \\u0026 Technique",
    target_muscle: "Full Body",
    category: "Cardio",
    equipment: "Bodyweight",
    default_sets: 3,
    default_reps: "45 sec",
    youtube_id: '-bnJGikRGsM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#EC4899', 'legs', 'FULL BOD'),
    description: "Official NASM guide: Tuck Jump | Proper Form \\u0026 Technique",
    keywords: ["tuck jump | proper form \\u0026 technique","tuck jump | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-XNf6TBErGys',
    name: "Two-Arm Standing Cable Fly | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Cable",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'XNf6TBErGys',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Two-Arm Standing Cable Fly | Proper Form \\u0026 Technique",
    keywords: ["two-arm standing cable fly | proper form \\u0026 technique","two-arm standing cable fly | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-QFbZevA7dps',
    name: "Dumbbell Romanian Deadlift | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'QFbZevA7dps',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Dumbbell Romanian Deadlift | Proper Form \\u0026 Technique",
    keywords: ["dumbbell romanian deadlift | proper form \\u0026 technique","dumbbell romanian deadlift | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-WVeZDBhZwLA',
    name: "Bench Dip  | Proper Form \\u0026 Technique",
    target_muscle: "Triceps",
    category: "Strength",
    equipment: "Bench",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'WVeZDBhZwLA',
    thumbnail_url: makeSvgThumbnail('#18181B', '#34D399', 'pushup', 'TRICEPS'),
    description: "Official NASM guide: Bench Dip  | Proper Form \\u0026 Technique",
    keywords: ["bench dip  | proper form \\u0026 technique","bench dip  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-lRo9zZ7EwpM',
    name: "Chest Press on a Machine | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'lRo9zZ7EwpM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Chest Press on a Machine | Proper Form \\u0026 Technique",
    keywords: ["chest press on a machine | proper form \\u0026 technique","chest press on a machine | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-qFTnmyC-nf4',
    name: "Single-Arm Dumbbell Chest Press  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'qFTnmyC-nf4',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Single-Arm Dumbbell Chest Press  | Proper Form \\u0026 Technique",
    keywords: ["single-arm dumbbell chest press  | proper form \\u0026 technique","single-arm dumbbell chest press  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-AuNRCrdhquE',
    name: "Two-Arm Dumbbell Chest Press  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'AuNRCrdhquE',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Two-Arm Dumbbell Chest Press  | Proper Form \\u0026 Technique",
    keywords: ["two-arm dumbbell chest press  | proper form \\u0026 technique","two-arm dumbbell chest press  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-iJ-GwVeUuCg',
    name: "Single-Arm Incline Dumbbell Chest Press | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'iJ-GwVeUuCg',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Single-Arm Incline Dumbbell Chest Press | Proper Form \\u0026 Technique",
    keywords: ["single-arm incline dumbbell chest press | proper form \\u0026 technique","single-arm incline dumbbell chest press | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-_x5m-s8xTf0',
    name: "Two-Arm Dumbbell Chest Press with Band | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '_x5m-s8xTf0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Two-Arm Dumbbell Chest Press with Band | Proper Form \\u0026 Technique",
    keywords: ["two-arm dumbbell chest press with band | proper form \\u0026 technique","two-arm dumbbell chest press with band | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-JKnpHchOWPU',
    name: "Two-Arm Incline Dumbbell Chest Press | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'JKnpHchOWPU',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Two-Arm Incline Dumbbell Chest Press | Proper Form \\u0026 Technique",
    keywords: ["two-arm incline dumbbell chest press | proper form \\u0026 technique","two-arm incline dumbbell chest press | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-lUH80pneL5w',
    name: "Lying Leg Curl | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'lUH80pneL5w',
    thumbnail_url: makeSvgThumbnail('#18181B', '#E11D48', 'legs', 'LEGS'),
    description: "Official NASM guide: Lying Leg Curl | Proper Form \\u0026 Technique",
    keywords: ["lying leg curl | proper form \\u0026 technique","lying leg curl | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-kGIfh3hHY0w',
    name: "Single-Leg Lying Curl  | Proper Form \\u0026 Technique",
    target_muscle: "Biceps",
    category: "Strength",
    equipment: "Dumbbells",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'kGIfh3hHY0w',
    thumbnail_url: makeSvgThumbnail('#18181B', '#60A5FA', 'dumbbell', 'BICEPS'),
    description: "Official NASM guide: Single-Leg Lying Curl  | Proper Form \\u0026 Technique",
    keywords: ["single-leg lying curl  | proper form \\u0026 technique","single-leg lying curl  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-G5iP_YcDQdE',
    name: "Seated Leg Curl  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'G5iP_YcDQdE',
    thumbnail_url: makeSvgThumbnail('#18181B', '#E11D48', 'legs', 'LEGS'),
    description: "Official NASM guide: Seated Leg Curl  | Proper Form \\u0026 Technique",
    keywords: ["seated leg curl  | proper form \\u0026 technique","seated leg curl  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-PXNJ71rksvU',
    name: "Single-Leg Seated Leg Curl | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Machine",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'PXNJ71rksvU',
    thumbnail_url: makeSvgThumbnail('#18181B', '#E11D48', 'legs', 'LEGS'),
    description: "Official NASM guide: Single-Leg Seated Leg Curl | Proper Form \\u0026 Technique",
    keywords: ["single-leg seated leg curl | proper form \\u0026 technique","single-leg seated leg curl | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-sSXnaFyhiZs',
    name: "Single-Leg Squat | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'sSXnaFyhiZs',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Single-Leg Squat | Proper Form \\u0026 Technique",
    keywords: ["single-leg squat | proper form \\u0026 technique","single-leg squat | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-h6lET2_DLA0',
    name: "Single-Leg Squat Touchdown  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'h6lET2_DLA0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Single-Leg Squat Touchdown  | Proper Form \\u0026 Technique",
    keywords: ["single-leg squat touchdown  | proper form \\u0026 technique","single-leg squat touchdown  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-CayG6UYqL8g',
    name: "Barbell Bench Press | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'CayG6UYqL8g',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Barbell Bench Press | Proper Form \\u0026 Technique",
    keywords: ["barbell bench press | proper form \\u0026 technique","barbell bench press | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-N4H4o8k9WbE',
    name: "Barbell Bench Press with Bands | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'N4H4o8k9WbE',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Barbell Bench Press with Bands | Proper Form \\u0026 Technique",
    keywords: ["barbell bench press with bands | proper form \\u0026 technique","barbell bench press with bands | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-6UKcYcDme-Y',
    name: "Barbell Bench Press with Chains  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: '6UKcYcDme-Y',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Barbell Bench Press with Chains  | Proper Form \\u0026 Technique",
    keywords: ["barbell bench press with chains  | proper form \\u0026 technique","barbell bench press with chains  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-BjGLs6KGWUc',
    name: "Incline Barbell Bench Press  | Proper Form \\u0026 Technique",
    target_muscle: "Chest",
    category: "Strength",
    equipment: "Barbell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'BjGLs6KGWUc',
    thumbnail_url: makeSvgThumbnail('#18181B', '#38BDF8', 'dumbbell', 'CHEST'),
    description: "Official NASM guide: Incline Barbell Bench Press  | Proper Form \\u0026 Technique",
    keywords: ["incline barbell bench press  | proper form \\u0026 technique","incline barbell bench press  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-v4OLkxi5-Q0',
    name: "Static Butterfly Stretch | Proper Form \\u0026 Technique",
    target_muscle: "Back",
    category: "Calisthenics",
    equipment: "Mat",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'v4OLkxi5-Q0',
    thumbnail_url: makeSvgThumbnail('#18181B', '#A855F7', 'pullup', 'BACK'),
    description: "Official NASM guide: Static Butterfly Stretch | Proper Form \\u0026 Technique",
    keywords: ["static butterfly stretch | proper form \\u0026 technique","static butterfly stretch | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-LnIMaf-XOpM',
    name: "Kettlebell Deadlift  | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Kettlebell",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'LnIMaf-XOpM',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: Kettlebell Deadlift  | Proper Form \\u0026 Technique",
    keywords: ["kettlebell deadlift  | proper form \\u0026 technique","kettlebell deadlift  | proper form \\u0026 technique"],
  },
  {
    id: 'nasm-cN4ExWjTP2Q',
    name: "TRX: Glute Bridge | Proper Form \\u0026 Technique",
    target_muscle: "Legs",
    category: "Strength",
    equipment: "Dumbbells / Bodyweight",
    default_sets: 3,
    default_reps: "10-12",
    youtube_id: 'cN4ExWjTP2Q',
    thumbnail_url: makeSvgThumbnail('#18181B', '#FB923C', 'legs', 'LEGS'),
    description: "Official NASM guide: TRX: Glute Bridge | Proper Form \\u0026 Technique",
    keywords: ["trx: glute bridge | proper form \\u0026 technique","trx: glute bridge | proper form \\u0026 technique"],
  },
];

/**
 * Intelligent exercise matcher: takes raw text (e.g. from AI consultation)
 * and returns the exact corresponding exercise with its related playlist video.
 */
export function matchExercise(rawText: string): CatalogExercise {
  if (!rawText) return EXERCISE_CATALOG[0];
  const clean = rawText.toLowerCase().trim();

  // 1. Direct high-priority matches to specific playlist videos
  if (clean.includes('side plank')) {
    return EXERCISE_CATALOG.find(e => e.id === 'abs-side-plank') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('straight-arm plank') || clean.includes('high plank')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'MDxfAuBbHHA') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('plank walk') || clean.includes('walkup') || clean.includes('climber') || clean.includes('mountain')) {
    return EXERCISE_CATALOG.find(e => e.id === 'abs-mountain-climbers') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('plank')) {
    return EXERCISE_CATALOG.find(e => e.id === 'abs-plank') || EXERCISE_CATALOG[0];
  }

  if (clean.includes('russian twist')) {
    return EXERCISE_CATALOG.find(e => e.id === 'abs-russian-twists') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('dead bug') || clean.includes('bicycle')) {
    return EXERCISE_CATALOG.find(e => e.id === 'abs-bicycle-crunches') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('knee raise') || clean.includes('leg raise') || clean.includes('crunch')) {
    if (clean.includes('weight') || clean.includes('dumbbell')) {
      return EXERCISE_CATALOG.find(e => e.id === 'abs-weighted-crunches') || EXERCISE_CATALOG[0];
    }
    return EXERCISE_CATALOG.find(e => e.id === 'abs-knee-raises') || EXERCISE_CATALOG[0];
  }

  // Arms & Shoulders
  if (clean.includes('hammer curl')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'CFBZ4jN1CMI') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('bicep') || (clean.includes('curl') && !clean.includes('leg curl'))) {
    if (clean.includes('barbell')) {
      return EXERCISE_CATALOG.find(e => e.youtube_id === 'QciWGMjD-nM') || EXERCISE_CATALOG.find(e => e.id === 'db-bicep-curls')!;
    }
    return EXERCISE_CATALOG.find(e => e.id === 'db-bicep-curls') || EXERCISE_CATALOG[0];
  }

  if (clean.includes('lateral raise') || clean.includes('iron cross') || clean.includes('side raise')) {
    return EXERCISE_CATALOG.find(e => e.id === 'db-lateral-raises') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('face pull')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'eTCBSFlCJ_s') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('shoulder press') || clean.includes('overhead press')) {
    return EXERCISE_CATALOG.find(e => e.id === 'db-shoulder-press') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('bench dip') || (clean.includes('dip') && !clean.includes('push'))) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'WVeZDBhZwLA') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('tricep') || clean.includes('skull crusher')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'J_d9LCMuyBU') || EXERCISE_CATALOG.find(e => e.id === 'pushup-triceps')!;
  }

  // Push-up Board Specific Angles
  if (clean.includes('green') || clean.includes('triceps position')) {
    return EXERCISE_CATALOG.find(e => e.id === 'pushup-triceps') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('yellow') || (clean.includes('back') && clean.includes('push'))) {
    return EXERCISE_CATALOG.find(e => e.id === 'pushup-back') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('red') || clean.includes('shoulder position') || clean.includes('pike')) {
    return EXERCISE_CATALOG.find(e => e.id === 'pushup-shoulders') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('incline push')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === '0JUrOH--Kdk') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('decline push')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'DBz85WuXqMk') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('plyometric push') || clean.includes('clap push')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'MH4gcTKQiEc') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('push-up') || clean.includes('pushup') || clean.includes('push up')) {
    return EXERCISE_CATALOG.find(e => e.id === 'pushup-chest') || EXERCISE_CATALOG[0];
  }

  // Chest & Pressing
  if (clean.includes('bench press') || (clean.includes('chest press') && clean.includes('barbell'))) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'CayG6UYqL8g') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('chest press') || clean.includes('dumbbell chest')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'AuNRCrdhquE') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('cable fly') || clean.includes('crossover')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'XY6JrX1wyxk') || EXERCISE_CATALOG[0];
  }

  // Legs & Lower Body
  if (clean.includes('goblet squat')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'nfX7IFK9UNI') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('bulgarian') || clean.includes('split squat')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'hbw7hdyOpq0') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('squat')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'UYbsgiiZgao') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('romanian deadlift') || clean.includes('rdl')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'aa57T45iFSE') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('deadlift')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'xgusDooVfKU') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('leg curl') || clean.includes('hamstring')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'lUH80pneL5w') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('leg press')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'cDGOn-yfKJA') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('burpee') || clean.includes('squat thrust')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'OO7-dWIy0W8') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('jumping jack')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'uLVt6u15L98') || EXERCISE_CATALOG[0];
  }
  if (clean.includes('box jump')) {
    return EXERCISE_CATALOG.find(e => e.youtube_id === 'DXu-8TAJwi4') || EXERCISE_CATALOG[0];
  }

  // 2. Search catalog by exact name or keywords
  for (const item of EXERCISE_CATALOG) {
    if (clean === item.name.toLowerCase()) return item;
    if (clean.includes(item.name.toLowerCase())) return item;
    for (const kw of item.keywords) {
      if (clean.includes(kw)) {
        return item;
      }
    }
  }

  // 3. Fallback category detection with relevant playlist video
  let targetMuscle: CatalogExercise['target_muscle'] = 'Full Body';
  let icon = 'dumbbell';
  let color = '#38BDF8';
  let fallbackYoutubeId = 'WDIpL0pjun0'; // Push-up default

  if (clean.includes('chest') || clean.includes('press') || clean.includes('push')) {
    targetMuscle = 'Chest';
    icon = 'pushup';
    color = '#38BDF8';
    fallbackYoutubeId = 'WDIpL0pjun0';
  } else if (clean.includes('back') || clean.includes('row') || clean.includes('pull')) {
    targetMuscle = 'Back';
    icon = 'pullup';
    color = '#FBBF24';
    fallbackYoutubeId = 'k0cTJCfxa0Y';
  } else if (clean.includes('shoulder') || clean.includes('deltoid')) {
    targetMuscle = 'Shoulders';
    icon = 'dumbbell';
    color = '#F87171';
    fallbackYoutubeId = '2b5t0Cu2nQI';
  } else if (clean.includes('bicep') || clean.includes('curl')) {
    targetMuscle = 'Biceps';
    icon = 'dumbbell';
    color = '#60A5FA';
    fallbackYoutubeId = 'CFBZ4jN1CMI';
  } else if (clean.includes('tricep') || clean.includes('dip')) {
    targetMuscle = 'Triceps';
    icon = 'pushup';
    color = '#34D399';
    fallbackYoutubeId = 'LJeqLAmJLfs';
  } else if (clean.includes('ab') || clean.includes('crunch') || clean.includes('core') || clean.includes('plank')) {
    targetMuscle = 'Abs';
    icon = 'core';
    color = '#2DD4BF';
    fallbackYoutubeId = 'mwlp75MS6Rg';
  } else if (clean.includes('leg') || clean.includes('squat') || clean.includes('lunge')) {
    targetMuscle = 'Legs';
    icon = 'legs';
    color = '#FB923C';
    fallbackYoutubeId = 'nfX7IFK9UNI';
  }

  return {
    id: `custom-${Math.random().toString(36).substring(2, 7)}`,
    name: rawText,
    target_muscle: targetMuscle,
    category: 'Strength',
    equipment: 'Gym / Bodyweight',
    default_sets: 3,
    default_reps: '12',
    youtube_id: fallbackYoutubeId,
    thumbnail_url: makeSvgThumbnail('#18181B', color, icon, targetMuscle.toUpperCase().substring(0, 8)),
    description: `Custom exercise routine movement: ${rawText}`,
    keywords: [],
  };
}

export function extractYoutubeId(input: string): string {
  if (!input) return PLAYLIST_DEFAULT_VIDEO_ID;
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : PLAYLIST_DEFAULT_VIDEO_ID;
}

export function searchExercises(query: string, category?: string): CatalogExercise[] {
  let list = EXERCISE_CATALOG;
  if (category && category !== 'All') {
    list = list.filter((e) => e.target_muscle === category || e.category === category);
  }
  if (!query.trim()) return list;

  const q = query.toLowerCase();
  return list.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.target_muscle.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q) ||
      e.keywords.some((k) => k.includes(q))
  );
}
