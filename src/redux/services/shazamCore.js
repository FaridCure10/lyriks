import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const RAPID_API_KEY = import.meta.env.VITE_SHAZAM_CORE_RAPID_API_KEY;
const ITUNES_BASE_URL = import.meta.env.DEV ? '/api/itunes' : 'https://itunes.apple.com';

const GENRE_TERM_MAP = {
  POP: 'pop hits',
  HIP_HOP_RAP: 'hip hop rap',
  DANCE: 'dance electronic',
  ELECTRONIC: 'electronic',
  SOUL_RNB: 'soul rnb',
  ALTERNATIVE: 'alternative rock',
  ROCK: 'rock hits',
  LATIN: 'latin music',
  FILM_TV: 'soundtrack film',
  COUNTRY: 'country music',
  WORLDWIDE: 'top hits',
  REGGAE_DANCE_HALL: 'reggae dancehall',
  HOUSE: 'house music',
  K_POP: 'k-pop',
};

const toHighResArtwork = (url = '', size = '500x500bb') =>
  url ? url.replace(/100x100bb/i, size) : '';

const normalizeItunesTrack = (item) => {
  const artwork = toHighResArtwork(item.artworkUrl100, '500x500bb');
  return {
    key: String(item.trackId),
    title: item.trackName,
    subtitle: item.artistName,
    images: {
      coverart: artwork,
      background: artwork,
    },
    artists: item.artistId ? [{ adamid: String(item.artistId) }] : [],
    hub: {
      actions: [
        { type: 'applemusicplay' },
        { type: 'uri', uri: item.previewUrl || '' },
      ],
    },
    genres: {
      primary: item.primaryGenreName || 'Music',
    },
  };
};

const fetchItunesJson = async (path) => {
  const response = await fetch(`${ITUNES_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`iTunes API error: ${response.status}`);
  }
  return response.json();
};

const fetchLyricsText = async (artist, title) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.lyrics ? data.lyrics.split('\n') : null;
  } catch {
    return null;
  }
};

const rapidApiBaseQuery = fetchBaseQuery({
  baseUrl: 'https://shazam-core.p.rapidapi.com/v1',
  prepareHeaders: (headers) => {
    headers.set('X-RapidAPI-Key', RAPID_API_KEY);
    return headers;
  },
});

const freeMusicBaseQuery = async ({ endpoint, params }) => {
  try {
    switch (endpoint) {
      case 'topCharts': {
        const data = await fetchItunesJson('/search?term=top+hits&media=music&entity=song&limit=20');
        return { data: (data.results || []).map(normalizeItunesTrack) };
      }
      case 'byGenre': {
        const term = GENRE_TERM_MAP[params] || 'pop hits';
        const data = await fetchItunesJson(
          `/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=20`,
        );
        return { data: (data.results || []).map(normalizeItunesTrack) };
      }
      case 'byCountry': {
        const country = params || 'US';
        const data = await fetchItunesJson(
          `/search?term=top+music&media=music&entity=song&country=${encodeURIComponent(country)}&limit=20`,
        );
        return { data: (data.results || []).map(normalizeItunesTrack) };
      }
      case 'songDetails': {
        const data = await fetchItunesJson(`/lookup?id=${encodeURIComponent(params.songid)}&entity=song`);
        const trackItem = (data.results || []).find((r) => r.wrapperType === 'track') || data.results?.[0];
        if (!trackItem) return { error: { status: 404, data: 'Song not found' } };
        const normalized = normalizeItunesTrack(trackItem);
        const lyricsLines = await fetchLyricsText(trackItem.artistName, trackItem.trackName);
        return {
          data: {
            ...normalized,
            sections: [
              { type: 'SONG' },
              lyricsLines ? { type: 'LYRICS', text: lyricsLines } : { type: 'NONE', text: [] },
            ],
          },
        };
      }
      case 'songRelated': {
        const lookup = await fetchItunesJson(`/lookup?id=${encodeURIComponent(params.songid)}&entity=song`);
        const trackItem = (lookup.results || []).find((r) => r.wrapperType === 'track');
        const term = trackItem?.artistName || trackItem?.primaryGenreName || 'top hits';
        const data = await fetchItunesJson(
          `/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=12`,
        );
        const related = (data.results || [])
          .filter((item) => String(item.trackId) !== String(params.songid))
          .map(normalizeItunesTrack);
        return { data: related };
      }
      case 'artistDetails': {
        const data = await fetchItunesJson(`/lookup?id=${encodeURIComponent(params)}&entity=song&limit=20`);
        const results = data.results || [];
        const artistInfo = results.find((r) => r.wrapperType === 'artist') || results[0];
        const tracks = results.filter((r) => r.wrapperType === 'track');
        if (!artistInfo) return { error: { status: 404, data: 'Artist not found' } };
        const firstTrackArt = tracks[0]?.artworkUrl100 || '';
        const songsMap = {};
        tracks.forEach((t) => {
          songsMap[String(t.trackId)] = {
            attributes: {
              name: t.trackName,
              albumName: t.collectionName,
              artwork: { url: toHighResArtwork(t.artworkUrl100, '{w}x{h}bb') },
            },
          };
        });
        return {
          data: {
            artists: {
              [params]: {
                attributes: {
                  name: artistInfo.artistName,
                  genreNames: [artistInfo.primaryGenreName || 'Music'],
                  artwork: { url: toHighResArtwork(firstTrackArt, '{w}x{h}bb') },
                },
              },
            },
            songs: songsMap,
          },
        };
      }
      case 'search': {
        const data = await fetchItunesJson(
          `/search?term=${encodeURIComponent(params)}&media=music&entity=song&limit=20`,
        );
        return {
          data: {
            tracks: {
              hits: (data.results || []).map((item) => ({ track: normalizeItunesTrack(item) })),
            },
          },
        };
      }
      default:
        return { error: { status: 400, data: 'Unknown endpoint' } };
    }
  } catch (err) {
    return { error: { status: 'FETCH_ERROR', error: err.message } };
  }
};

const baseQuery = (args, api, extraOptions) => {
  if (RAPID_API_KEY) {
    return rapidApiBaseQuery(args.rapidUrl, api, extraOptions);
  }
  return freeMusicBaseQuery(args);
};

export const shazamCoreApi = createApi({
  reducerPath: 'shazamCoreApi',
  baseQuery,
  endpoints: (builder) => ({
    getTopCharts: builder.query({
      query: () => ({ endpoint: 'topCharts', rapidUrl: '/charts/world' }),
    }),
    getSongsByGenre: builder.query({
      query: (genre) => ({
        endpoint: 'byGenre',
        params: genre,
        rapidUrl: `/charts/genre-world?genre_code=${genre}`,
      }),
    }),
    getSongDetails: builder.query({
      query: ({ songid }) => ({
        endpoint: 'songDetails',
        params: { songid },
        rapidUrl: `/tracks/details?track_id=${songid}`,
      }),
    }),
    getSongRelated: builder.query({
      query: ({ songid }) => ({
        endpoint: 'songRelated',
        params: { songid },
        rapidUrl: `/tracks/related?track_id=${songid}`,
      }),
    }),
    getArtistDetails: builder.query({
      query: (artistId) => ({
        endpoint: 'artistDetails',
        params: artistId,
        rapidUrl: `/artists/details?artist_id=${artistId}`,
      }),
    }),
    getSongsByCountry: builder.query({
      query: (countryCode) => ({
        endpoint: 'byCountry',
        params: countryCode,
        rapidUrl: `/charts/country?country_code=${countryCode}`,
      }),
    }),
    getSongsBySearch: builder.query({
      query: (searchTerm) => ({
        endpoint: 'search',
        params: searchTerm,
        rapidUrl: `/search/multi?search_type=SONGS_ARTISTS&query=${searchTerm}`,
      }),
    }),
  }),
});

export const {
  useGetTopChartsQuery,
  useGetSongsByGenreQuery,
  useGetSongDetailsQuery,
  useGetSongRelatedQuery,
  useGetArtistDetailsQuery,
  useGetSongsByCountryQuery,
  useGetSongsBySearchQuery,
} = shazamCoreApi;
