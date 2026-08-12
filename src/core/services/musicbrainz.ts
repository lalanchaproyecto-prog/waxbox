export interface MusicBrainzRelease {
  id: string
  title: string
  year: number | null
  label: string | null
  genres: string[]
  tracks: Array<{
    artist: string
    side: string
    number: number
    title: string
    duration: string | null
  }>
}

export async function searchRelease(
  _artist: string,
  _album: string
): Promise<MusicBrainzRelease[]> {
  // TODO: Step 3 — Integrate with MusicBrainz API
  throw new Error('Not implemented yet')
}

export async function getReleaseDetails(
  _releaseId: string
): Promise<MusicBrainzRelease | null> {
  // TODO: Step 3 — Fetch full release details including tracklist
  throw new Error('Not implemented yet')
}
