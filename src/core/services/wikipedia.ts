export interface WikipediaExcerpt {
  text: string
  source: string
  url: string
}

export async function fetchAlbumExcerpt(
  _artist: string,
  _album: string
): Promise<WikipediaExcerpt | null> {
  // TODO: Step 5 — Fetch introductory excerpt from Wikipedia/Wikidata
  throw new Error('Not implemented yet')
}
