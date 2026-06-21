import { useRef } from "react";
import MediaCard from "./MediaCard.jsx";

export default function MediaRow({ title, items }) {
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
            aria-label="Scroll esquerda"
          >
            ‹
          </button>
          <button
            className="row-arrow"
            onClick={() => scroll("right")}
            aria-label="Scroll direita"
          >
            ›
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
