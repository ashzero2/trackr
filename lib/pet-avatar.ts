const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?.*)?$/i;

async function fetchRandomDogImageUrl(): Promise<string | null> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch('https://random.dog/woof.json');
    if (!res.ok) continue;
    const j = (await res.json()) as { url?: string };
    const url = j.url;
    if (typeof url === 'string' && IMAGE_EXT.test(url)) return url;
  }
  return null;
}

async function fetchRandomCatImageUrl(): Promise<string | null> {
  const res = await fetch('https://cataas.com/cat?json=true');
  if (!res.ok) return null;
  const j = (await res.json()) as { url?: string };
  if (typeof j.url !== 'string') return null;
  return j.url.startsWith('http') ? j.url : `https://cataas.com${j.url}`;
}

/** Picks a stable random dog or cat image URL (network). */
export async function fetchRandomPetAvatarUrl(): Promise<string | null> {
  try {
    const useDog = Math.random() < 0.5;
    const url = useDog ? await fetchRandomDogImageUrl() : await fetchRandomCatImageUrl();
    if (url) return url;
    return useDog ? await fetchRandomCatImageUrl() : await fetchRandomDogImageUrl();
  } catch {
    return null;
  }
}
