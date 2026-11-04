import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MediaCard from "./MediaCard.jsx";
import { useT } from "../i18n/I18nContext.jsx";

// `href` e' opcional: quando a pagina onde a linha vive ja' E' a lista completa
// (ex.: /movies com as suas proprias rows), nao se mostra um "Ver todos" que so'
// recarregava a mesma pagina.
export default function MediaRow({ title, items, href }) {
  const t = useT();
  const scrollRef = useRef(null);
  // Cada seta so' existe se houver mesmo cartoes para esse lado. Sem isto, a
  // seta da esquerda aparecia no inicio (onde nao ha nada) e a da direita no
  // fim, ambas a fazer nada.
  const [podeEsquerda, setPodeEsquerda] = useState(false);
  const [podeDireita, setPodeDireita] = useState(false);

  const atualizarSetas = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 1 px de tolerancia: o scroll com zoom/arredondamento pode ficar a 0,99.
    setPodeEsquerda(el.scrollLeft > 1);
    setPodeDireita(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Calcula ao montar, quando os itens mudam e quando a largura da janela muda.
  useEffect(() => {
    atualizarSetas();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(atualizarSetas);
    ro.observe(el);
    return () => ro.disconnect();
  }, [atualizarSetas, items?.length]);

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
        {href ? (
          <Link className="row-more" to={href}>
            {t("Ver todos")}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ) : null}
      </div>
      <div className="row-body">
        {podeEsquerda ? (
          <button
            className="row-arrow row-arrow-left"
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
        ) : null}
        <div className="row-scroll" ref={scrollRef} onScroll={atualizarSetas}>
          {items.map((item) => (
            <MediaCard key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
        {podeDireita ? (
          <button
            className="row-arrow row-arrow-right"
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
        ) : null}
      </div>
    </section>
  );
}
