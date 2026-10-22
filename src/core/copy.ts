// English UI copy from 03_UI_SPEC.md §9.
export const copy = {
  "app": {
    "title": "LiftLog Coach",
    "ruleBadge": "Rules {version}",
    "noKeyBanner": "Add your API key in Settings to start."
  },
  "tabs": {
    "chat": "Chat",
    "history": "History",
    "settings": "Settings"
  },
  "composer": {
    "placeholder": "Describe your workout or ask about your training…",
    "placeholderPending": "Add the missing details…",
    "send": "Send",
    "disabledBusy": "Working on your last message…"
  },
  "chat": {
    "recordingOnly": "This preview supports workout recording and training queries. Advice is coming in a later checkpoint.",
    "thinking": "Thinking…",
    "welcome": "Hi! I log your strength training and answer questions about it. Try:\n• 'Bench press 60kg 4x8, incline fly 15kg 3x12'\n• 'Is my squat improving?'\n• 'My bench is stuck at 60kg, what should I do?'\nI draft, you check and save. I don't give medical advice.",
    "welcomeExamples": [
      "Bench press 60kg 4x8, incline fly 15kg 3x12",
      "Is my squat improving?",
      "My bench is stuck at 60kg, what should I do?"
    ]
  },
  "badge": {
    "aiDraft": "AI draft — check before saving",
    "aiInterpretation": "AI interpretation · based on {n} sessions",
    "basedOnData": "Based on your data · {n} sessions",
    "general": "General advice — your training data was not used",
    "blockedRule": "Blocked by safety rule",
    "blockedCheck": "Blocked by safety check",
    "notHandled": "Not handled by AI",
    "custom": "custom",
    "sample": "sample"
  },
  "card": {
    "appendNotice": "Will be added to your session on {date} ({n} exercises already logged)",
    "appendShow": "Show",
    "appendHide": "Hide",
    "date": "Date",
    "feeling": "Feeling",
    "feelingNone": "—",
    "feelingGood": "Good",
    "feelingNormal": "Normal",
    "feelingBad": "Bad",
    "feelingMapped": "≈ \"{text}\" → {feeling}",
    "feelingReplace": "Feeling: {old} → {new} (will replace)",
    "notes": "Notes",
    "youWrote": "you wrote: \"{raw}\"",
    "chooseExercise": "Choose an exercise:",
    "keepCustom": "Keep as custom: {raw}",
    "notInLibrary": "Not in library",
    "selectFromList": "Pick from the exercise list…",
    "change": "Change",
    "reps": "reps",
    "sets": "sets",
    "unit": "unit",
    "setType": "set type",
    "setTypeWorking": "Working",
    "setTypeWarmup": "Warm-up",
    "setTypeDrop": "Drop set",
    "bodyweight": "Bodyweight",
    "inferredTooltip": "Inferred — you didn't specify this",
    "skippedCardio": "Skipped (cardio not supported): {items}",
    "removeExercise": "Remove from draft",
    "chooseExerciseFor": "Choose an exercise for: {raw}",
    "fixMissing": "Fill in weight, reps and sets for every exercise.",
    "fixValues": "Check exercise choices and units. Weight must be 0–500 kg or 0–1100 lb; sets must be whole numbers from 1–20 and reps from 1–100.",
    "fixDate": "Pick a date that isn't in the future.",
    "save": "Save",
    "addToSession": "Add to session",
    "saving": "Saving…",
    "discard": "Discard",
    "saved": "Saved ✓",
    "viewInHistory": "View in History",
    "discarded": "Discarded",
    "saveFailed": "Couldn't save. Please try again."
  },
  "record": {
    "askExercises": "What exercises did you do? For example: 'Bench press 60kg 4x8'.",
    "missingPrefix": "A few details are missing:",
    "missingItem": "{exercise} — {fields}",
    "missingSuffix": "Please add them and I'll prepare the draft.",
    "fieldWeight": "weight",
    "fieldSets": "number of sets",
    "fieldReps": "reps per set",
    "futureDate": "That date is in the future. Which day did you train?",
    "whichDay": "Which day did you train?",
    "unusualValue": "Please double-check: '{exercise} {value}' looks unusual. What was the {field}?",
    "giveUp": "I still couldn't build a complete record. Try a format like 'Bench press 60kg 4x8'.",
    "cardioOnly": "Cardio logging isn't supported yet. I can log strength training, e.g. 'Squat 100kg 5x5'."
  },
  "query": {
    "thisWeek": "this week",
    "lastWeek": "last week",
    "thisMonth": "this month",
    "lastMonth": "last month",
    "lastDays": "in the last {n} days",
    "lastWeeks": "in the last {n} weeks",
    "lastEightWeeks": "in the last 8 weeks",
    "onDate": "on {date}",
    "sessionCount": "You trained on {n} day(s) {period} ({range}).",
    "sessionCountZero": "No sessions logged {period}.",
    "volumeSets": "{period}: {sets} sets, volume {volume}.",
    "volumeNoWeighted": "{period}: {sets} sets, no weighted volume.",
    "volumeBodyweightNote": "(bodyweight sets not included in volume)",
    "dayNone": "No session logged on {date}.",
    "exerciseLast": "Last {exercise}: {date} — {setGroups}.",
    "exerciseLastNone": "You haven't logged {exercise} yet.",
    "exerciseBest": "Best {exercise} {period}: {topSet} on {date}.",
    "exerciseBestNone": "No {exercise} logged {period}.",
    "noWeightedData": "Only bodyweight sets were logged for {exercise} {period}. Weight-based bests and trends need added-load records.",
    "weightedOnlyNote": "Only added or external load is compared; bodyweight-only sets are excluded.",
    "defaultRangeNote": "(last 8 weeks)",
    "unsupported": "I can answer questions about session counts, volume, a specific day, or a specific exercise's best, last session or trend. Try: 'Is my squat improving?'",
    "askPeriod": "Which period do you mean — this week, last week, or this month?",
    "askPeriodOptions": [
      {
        "label": "This week",
        "value": "this_week"
      },
      {
        "label": "Last week",
        "value": "last_week"
      }
    ],
    "askDay": "Which day do you want to see?",
    "askDayOptions": [
      {
        "label": "Today",
        "value": "today"
      },
      {
        "label": "Yesterday",
        "value": "yesterday"
      }
    ],
    "askExercise": "Which exercise do you want to check?",
    "whichExercise": "Which exercise do you mean?",
    "exerciseNotFound": "I couldn't find '{raw}' in your log or the exercise library."
  },
  "dayDetail": {
    "openInHistory": "Open in History"
  },
  "bodyPart": {
    "chest": "Chest",
    "back": "Back",
    "shoulders": "Shoulders",
    "legs": "Legs",
    "glutes": "Glutes",
    "biceps": "Biceps",
    "triceps": "Triceps",
    "core": "Core"
  },
  "trend": {
    "defaultRange": "last 8 weeks",
    "chartLabel": "{exercise} {mode} trend, {n} sessions",
    "title": "{exercise} · {range}",
    "modeTop": "Top set",
    "modeVolume": "Volume",
    "mixedUnits": "Mixed units converted to kg for this chart",
    "notEnough": "Not enough data: only {n} session(s) of {exercise} {period}. I need at least 3 to describe a trend.",
    "interpretationUnavailable": "Interpretation unavailable."
  },
  "advice": {
    "askType": "What would you like advice on — a specific lift, what to train next, or a general training question?",
    "askTypeOptions": [
      "Advice on a specific lift",
      "What should I train next?"
    ],
    "askBodyPart": "Which body part do you mean?",
    "askLift": "Which lift do you want advice on?",
    "discomfortNote": "If pain persists or gets worse, stop and see a doctor or physiotherapist.",
    "footer": "Suggestions only. You decide what to apply."
  },
  "refusal": {
    "medical": "I can't help with diagnosis, treatment, medication, or whether it's safe to train with pain. Please talk to a doctor or physiotherapist. I can still help you log training or look at your data.",
    "delete": "I can't delete data from chat. To remove a session, go to History, open it and tap Delete.",
    "edit": "Editing saved sessions isn't supported in chat. You can delete the session in History and log it again.",
    "outOfScope": "I'm a strength-training log assistant. I can log workouts, answer questions about your training data, and give training suggestions. Try: 'Squat 100kg 5x5'.",
    "unsupported": "That isn't supported yet. I can log workouts, answer questions about your data, and give training suggestions.",
    "openHistory": "Open History"
  },
  "unknown": {
    "chitchat": "Hi! I can log your strength training and answer questions about it. Try: 'Squat 100kg 5x5'.",
    "giveUp": "I'm not sure I can help with that. Try: 'Bench press 60kg 4x8' or 'Is my squat improving?'"
  },
  "clarify": {
    "fallbackOptions": [
      "Log a workout",
      "Check my training"
    ]
  },
  "error": {
    "noKey": "Add your API key in Settings to use this. Safety rules still work without a key.",
    "unauthorized": "Your API key was rejected. Check it in Settings.",
    "modelNotFound": "The model name wasn't found. Check it in Settings.",
    "rateLimited": "The AI provider is rate-limiting requests. Wait a moment and try again.",
    "timeout": "The AI didn't respond in time. Please try again.",
    "network": "Couldn't reach the AI provider. Check your connection or API address.",
    "invalidJson": "I couldn't understand the AI's response. Please try rephrasing.",
    "tryAgain": "Try again"
  },
  "history": {
    "title": "History",
    "count": "{n} sessions",
    "summary": "{exercises} exercises · {sets} sets",
    "feeling": "Feeling: {feeling}",
    "notes": "Notes: {notes}",
    "loggedFrom": "Logged from chat:",
    "delete": "Delete",
    "deleteTitle": "Delete session?",
    "deleteBody": "Delete the whole session from {date}? This can't be undone.",
    "cancel": "Cancel",
    "deleted": "Session deleted.",
    "empty": "No sessions yet. Log one in Chat, e.g. 'Bench press 60kg 4x8'."
  },
  "settings": {
    "groupModel": "AI model",
    "presets": "Provider presets",
    "baseUrl": "API base URL",
    "apiKey": "API key",
    "show": "Show",
    "hide": "Hide",
    "keyNote": "Your key is stored only in this browser and sent only to the API address above.",
    "model": "Model",
    "modelNote": "Model names change over time — check your provider's docs if Test connection fails.",
    "test": "Test connection",
    "testing": "Testing…",
    "testOk": "Connected · {model} · {ms} ms",
    "testFail": "Failed: {reason}",
    "geminiHelpTitle": "How to get a free Gemini API key",
    "geminiHelp": "1. Go to Google AI Studio (aistudio.google.com) and sign in with a Google account.\n2. Choose \"Get API key\" and create a key.\n3. Click the \"Google Gemini\" preset above and paste the key.",
    "groupPrefs": "Preferences",
    "defaultUnit": "Default unit",
    "groupRules": "Rules",
    "ruleVersion": "Rule version",
    "ruleV2": "v2 — Safety regex + AI risk check (redesigned)",
    "ruleV1": "v1 — Safety regex only (original)",
    "ruleSwitched": "Now using rules {version}.",
    "groupData": "Data",
    "loadSample": "Load sample data",
    "loadSampleNote": "Replaces all sessions with 8 weeks of made-up training data.",
    "loadSampleConfirm": "This will replace all current sessions. Continue?",
    "loadSampleDone": "Sample data loaded.",
    "export": "Export data",
    "exportNote": "Downloads your sessions as JSON (no API key included).",
    "clear": "Clear all data",
    "clearConfirm": "Delete all sessions? This can't be undone.",
    "cleared": "All sessions deleted.",
    "groupDev": "Developer",
    "showDebug": "Show debug panel",
    "groupAbout": "About",
    "about": "LiftLog Coach is a prototype for a university assignment. It does not give medical advice. AI output can be wrong — check every draft before saving.",
    "version": "Version 1.0 · Rules {version}",
    "continue": "Continue",
    "cancel": "Cancel"
  },
  "debug": {
    "toggle": "Details",
    "ruleVersion": "Rule version",
    "path": "Path",
    "safetyRule": "Safety rule",
    "aiCalls": "AI calls",
    "dataSent": "Data sent",
    "postCheck": "Post-check",
    "totalTime": "Total time",
    "rawOutput": "{purpose} · raw output",
    "request": "{purpose} · request",
    "copy": "Copy",
    "copied": "Copied ✓",
    "copyRow": "Copy as test log row",
    "copyTrace": "Copy full trace JSON",
    "none": "none"
  }
} as const;
import { localDate } from './time/resolve';

export type Unit = 'kg' | 'lb';
const dateText = (iso: string, year: boolean): string => {
  const date = localDate(iso);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${weekdays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}${year ? ` ${date.getFullYear()}` : ''}`;
};
// The injected clock is required for current-year formatting (AGENTS §4.1).
export const fmtDate = (iso: string, now: Date): string => dateText(iso, localDate(iso).getFullYear() !== now.getFullYear());
export const fmtDateLong = (iso: string): string => dateText(iso, true);
export const fmtWeight = (weight: number, unit: Unit): string => `${Number(weight.toFixed(2))} ${unit}`;
export interface DisplaySetGroup {weight: number | null; unit: Unit; reps: number; sets: number}
export function fmtSetGroup(group: DisplaySetGroup, isBodyweight: boolean): string {
  const weight = group.weight === null ? copy.card.bodyweight : `${isBodyweight ? 'BW + ' : ''}${fmtWeight(group.weight, group.unit)}`;
  return `${weight} × ${group.reps} reps × ${group.sets} ${group.sets === 1 ? 'set' : 'sets'}`;
}
export const fmtTopSet = (weight: number, unit: Unit, reps: number): string => `${fmtWeight(weight, unit)} × ${reps}`;
export const fmtRange = (start: string, end: string, now: Date): string => `${fmtDate(start, now)} – ${fmtDate(end, now)}`;
export const formatCopy = (template: string, values: Readonly<Record<string, string | number>>): string => template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]));
