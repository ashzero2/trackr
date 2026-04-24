import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY = 'trackr_gemini_api_key';
const MODEL_STORAGE_KEY = '@trackr/gemini_model_id';

/** Matches Google’s documented alias; often shares free-tier quota more predictably than fixed version ids. */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export async function getGeminiApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_KEY);
  } catch {
    return null;
  }
}

export async function setGeminiApiKey(key: string | null): Promise<void> {
  if (key === null || key.trim() === '') {
    await SecureStore.deleteItemAsync(SECURE_KEY);
    return;
  }
  await SecureStore.setItemAsync(SECURE_KEY, key.trim());
}

const LEGACY_MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-flash-latest',
  'gemini-2.0-flash-001': 'gemini-flash-latest',
  'gemini-1.5-flash': 'gemini-flash-latest',
};

export async function getGeminiModelId(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
    const trimmed = v?.trim();
    if (!trimmed) return DEFAULT_GEMINI_MODEL;
    const mapped = LEGACY_MODEL_MAP[trimmed] ?? trimmed;
    if (mapped !== trimmed) {
      await AsyncStorage.setItem(MODEL_STORAGE_KEY, mapped);
    }
    return mapped;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export async function setGeminiModelId(modelId: string): Promise<void> {
  const m = modelId.trim() || DEFAULT_GEMINI_MODEL;
  await AsyncStorage.setItem(MODEL_STORAGE_KEY, m);
}
