import { useRef } from "react";
import MediaCard from "./MediaCard.jsx";
import { useT } from "../i18n/I18nContext.jsx";

export default function MediaRow({ title, items }) {
  const t = useT();
  const scrollRef = useRef(null);

  if (!items?.length) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const amount = scrollRef.current.clientWidth * 0.85;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="row">
      <div className="row-header">
        <h2 className="row-title">{title}</h2>
        <div className="row-arrows">
          <button
            className="row-arrow"
            onClick={() => scroll("left")}
            aria-label={t("Scroll esquerda")}
          >
            <svg
              aria-hidden="true"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            className="row-arrow"
            onClick={() => scroll("right")}
            aria-label={t("Scroll direita")}
          >
            <svg
              aria-hidden="true"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="row-scroll" ref={scrollRef}>
        {items.map((item) => (
          <MediaCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}
