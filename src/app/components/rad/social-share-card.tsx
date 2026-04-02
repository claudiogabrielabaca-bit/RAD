"use client";

import type { HighlightItem, ReviewItem } from "@/app/lib/rad-types";

export const SOCIAL_POST_WIDTH = 1080;
export const SOCIAL_POST_HEIGHT = 1350;

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function getBadgeLabel(value?: string | null) {
  switch (value) {
    case "selected":
      return "Selected";
    case "event":
    case "events":
      return "Event";
    case "birth":
    case "births":
      return "Birth";
    case "death":
    case "deaths":
      return "Death";
    case "war":
      return "War";
    case "disaster":
      return "Disaster";
    case "politics":
      return "Politics";
    case "science":
      return "Science";
    case "culture":
      return "Culture";
    case "sports":
      return "Sports";
    case "discovery":
      return "Discovery";
    case "crime":
      return "Crime";
    default:
      return null;
  }
}

function getBadgeClasses(value?: string | null) {
  switch (value) {
    case "event":
    case "events":
      return "border-sky-400/25 bg-sky-500/18 text-sky-200";
    case "birth":
    case "births":
      return "border-emerald-400/25 bg-emerald-500/18 text-emerald-200";
    case "death":
    case "deaths":
      return "border-rose-400/25 bg-rose-500/18 text-rose-200";
    case "war":
      return "border-amber-400/25 bg-amber-500/18 text-amber-200";
    case "disaster":
      return "border-orange-400/25 bg-orange-500/18 text-orange-200";
    case "politics":
      return "border-indigo-400/25 bg-indigo-500/18 text-indigo-200";
    case "science":
      return "border-cyan-400/25 bg-cyan-500/18 text-cyan-200";
    case "culture":
      return "border-fuchsia-400/25 bg-fuchsia-500/18 text-fuchsia-200";
    case "sports":
      return "border-lime-400/25 bg-lime-500/18 text-lime-200";
    case "discovery":
      return "border-teal-400/25 bg-teal-500/18 text-teal-200";
    case "crime":
      return "border-red-400/25 bg-red-500/18 text-red-200";
    default:
      return "border-white/15 bg-white/10 text-white";
  }
}

function ClampText({
  children,
  lines,
  className = "",
}: {
  children: string;
  lines: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function renderStars(stars: number) {
  const safe = Math.max(0, Math.min(5, stars));
  return `${"★".repeat(safe)}${"☆".repeat(5 - safe)}`;
}

function getTitleConfig(length: number) {
  if (length > 58) {
    return {
      className:
        "mt-5 max-w-[11.4ch] text-[48px] font-semibold leading-[0.94] tracking-tight text-white",
      lines: 3,
    };
  }

  if (length > 36) {
    return {
      className:
        "mt-5 max-w-[11.4ch] text-[58px] font-semibold leading-[0.95] tracking-tight text-white",
      lines: 2,
    };
  }

  return {
    className:
      "mt-5 max-w-[11.4ch] text-[68px] font-semibold leading-[0.96] tracking-tight text-white",
    lines: 2,
  };
}

function getDescriptionConfig(length: number) {
  if (length > 180) {
    return {
      className:
        "mt-5 max-w-[860px] text-[21px] leading-[1.42] text-zinc-100/92",
      lines: 4,
    };
  }

  if (length > 110) {
    return {
      className:
        "mt-5 max-w-[860px] text-[24px] leading-[1.42] text-zinc-100/92",
      lines: 3,
    };
  }

  return {
    className:
      "mt-5 max-w-[860px] text-[27px] leading-[1.42] text-zinc-100/92",
    lines: 3,
  };
}

function getReviewClass(length: number) {
  if (length > 210) {
    return "mt-5 text-[20px] leading-[1.56] text-zinc-100 break-words [overflow-wrap:anywhere]";
  }

  if (length > 150) {
    return "mt-5 text-[23px] leading-[1.54] text-zinc-100 break-words [overflow-wrap:anywhere]";
  }

  if (length > 90) {
    return "mt-5 text-[27px] leading-[1.5] text-zinc-100 break-words [overflow-wrap:anywhere]";
  }

  return "mt-5 text-[31px] leading-[1.46] text-zinc-100 break-words [overflow-wrap:anywhere]";
}

export default function SocialShareCard({
  day,
  highlight,
  review,
  username,
}: {
  day: string;
  highlight: HighlightItem;
  review: ReviewItem | null;
  username?: string | null;
}) {
  const title = normalizeText(highlight.title) || "Historical moment";
  const description =
    normalizeText(highlight.text) || "No description available.";
  const reviewText =
    normalizeText(review?.review) || "Rated this day on rateanyday.com.";
  const author = review?.authorLabel || (username ? `@${username}` : "@you");

  const titleConfig = getTitleConfig(title.length);
  const descriptionConfig = getDescriptionConfig(description.length);
  const reviewClass = getReviewClass(reviewText.length);

  const badgeValues = [
    highlight.year ? String(highlight.year) : null,
    getBadgeLabel(highlight.kind || highlight.type),
    getBadgeLabel(highlight.category || highlight.secondaryType),
  ].filter(Boolean) as string[];

  const badgeClassSources = [
    null,
    highlight.kind || highlight.type,
    highlight.category || highlight.secondaryType,
  ];

  return (
    <div
      className="overflow-hidden border border-white/10 bg-[#060606] text-white rounded-none"
      style={{
        width: SOCIAL_POST_WIDTH,
        height: SOCIAL_POST_HEIGHT,
      }}
    >
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
        <div className="relative min-h-0 overflow-hidden border-b border-white/10 bg-black">
          {highlight.image ? (
            <img
              src={highlight.image}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,#1a1a1a_0%,#090909_100%)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/84 via-black/58 to-black/18" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/16 via-transparent to-black/66" />

          <div className="relative z-10 flex h-full flex-col justify-end p-[56px]">
            <div className="text-[20px] font-medium text-zinc-200/90">
              In this day
            </div>

            <div className="mt-2 text-[50px] font-semibold leading-none tracking-tight text-white">
              {formatDisplayDate(day)}
            </div>

            <div className="mt-5 flex min-h-[40px] flex-wrap items-center gap-2.5">
              {badgeValues.map((badge, index) => (
                <span
                  key={`${badge}-${index}`}
                  className={`rounded-[10px] border px-4 py-2 text-[17px] font-semibold uppercase tracking-[0.12em] backdrop-blur-xl ${
                    index === 0
                      ? "border-white/12 bg-white/10 text-white"
                      : getBadgeClasses(badgeClassSources[index])
                  }`}
                >
                  {badge}
                </span>
              ))}
            </div>

            <ClampText
              lines={titleConfig.lines}
              className={titleConfig.className}
            >
              {title}
            </ClampText>

            <ClampText
              lines={descriptionConfig.lines}
              className={descriptionConfig.className}
            >
              {description}
            </ClampText>
          </div>
        </div>

        <div className="bg-[#050505] px-[42px] py-[34px]">
          <div className="mb-3 text-[14px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Your rating for this day
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[32px] font-semibold text-yellow-400">
              {renderStars(review?.stars ?? 0)}
            </span>

            <span className="rounded-[10px] border border-white/10 bg-white/[0.06] px-4 py-2 text-[19px] font-medium text-zinc-200">
              {author}
            </span>
          </div>

          <div className={reviewClass}>{reviewText}</div>

          <div className="mt-5 text-center text-[12px] lowercase tracking-[0.08em] text-zinc-500">
            rateanyday.com
          </div>
        </div>
      </div>
    </div>
  );
}