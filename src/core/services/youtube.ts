export interface YouTubeSearchResult {
  videoId: string
  title: string
}

export async function searchTrackVideo(
  _artist: string,
  _trackTitle: string
): Promise<YouTubeSearchResult | null> {
  // TODO: Step 6 — Search YouTube Data API v3 for track videos
  throw new Error('Not implemented yet')
}
