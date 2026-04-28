export type LegacyHighlightType =
  | "selected"
  | "events"
  | "births"
  | "deaths"
  | "war"
  | "disaster"
  | "politics"
  | "science"
  | "culture"
  | "sports"
  | "discovery"
  | "crime"
  | "none";

export type HighlightKind = "selected" | "event" | "birth" | "death" | "none";

export type HighlightCategory =
  | "general"
  | "war"
  | "disaster"
  | "politics"
  | "science"
  | "culture"
  | "sports"
  | "discovery"
  | "crime";

export type HighlightBadgeKey =
  | LegacyHighlightType
  | HighlightKind
  | HighlightCategory;

export type HighlightItem = {
  kind?: HighlightKind;
  category?: HighlightCategory;
  type?: LegacyHighlightType;
  secondaryType?: LegacyHighlightType | null;
  year: number | null;
  text: string;
  title: string | null;
  image: string | null;
  articleUrl: string | null;
};

export type HighlightResponse = {
  highlight?: HighlightItem;
  highlights?: HighlightItem[];
};

export type ReplyItem = {
  id: string;
  ratingId: string;
  text: string;
  createdAt?: string;
  isMine?: boolean;
  authorLabel: string;
  parentReplyId?: string | null;
  likesCount: number;
  likedByMe: boolean;
  reportedByMe?: boolean;
  replies: ReplyItem[];
};

export type ReviewItem = {
  id: string;
  stars: number;
  review: string;
  createdAt?: string;
  likesCount: number;
  likedByMe: boolean;
  isMine?: boolean;
  authorLabel: string;
  replies: ReplyItem[];
};

export type DayResponse = {
  day: string;
  avg: number;
  count: number;
  views?: number;
  reviews: ReviewItem[];
};

export type TopItem = {
  day: string;
  avg: number;
  count: number;
  title?: string | null;
};

export type DiscoverCard = {
  day: string;
  title: string;
  text: string;
  image: string | null;
  avg: number;
  count: number;
  views: number;
  type:
    | "selected"
    | "events"
    | "births"
    | "deaths"
    | "war"
    | "disaster"
    | "politics"
    | "science"
    | "culture"
    | "sports"
    | "discovery"
    | "crime"
    | "none";
};

export type FavoriteDayResponse = {
  day: string;
  isFavorite: boolean;
  favoriteDay: string | null;
};

export type SurpriseResponse = {
  day: string;
  source?: "cache" | "generated" | "realtime-balanced" | "live-balanced-random";
  dayData: DayResponse;
  highlightData: HighlightResponse;
};