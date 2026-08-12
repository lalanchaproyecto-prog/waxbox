export interface CoverArtResult {
  imageUrl: string
  thumbnailUrl: string | null
}

export async function fetchCoverArt(
  _musicbrainzReleaseId: string
): Promise<CoverArtResult | null> {
  // TODO: Step 4 — Fetch cover art from Cover Art Archive
  throw new Error('Not implemented yet')
}
