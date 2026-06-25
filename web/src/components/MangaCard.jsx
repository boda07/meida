import { openExternal, imageUrl } from "../api/client.js";

// Estado de publicacao (MAL) em PT.
const STATUS_PT = {
  Finished: "Completo",
  Publishing: "A publicar",
  "On Hiatus": "Em pausa",
  Discontinued: "Descontinuado",
  "Not yet published": "Por publicar",
};

// Cartao de manga. A app nao tem leitor, por isso abre a pagina do MAL no
// browser (para ler/adicionar a lista).
export default function MangaCard({ item }) {
  const img = imageUrl(item.poster, "w342");
  const sub = [item.mediaType, item.year].filter(Boolean).join(" · ");
  const open = () => item.url && openExternal(item.url);

  return (
    <button className="card card-portrait manga-card" onClick={open} title={item.title}>
      <div className="card-poster">
        {img ? (
          <img src={img} alt={item.title} loading="lazy" />
        ) : (
          <div className="card-noimg">{item.title}</div>
        )}
        <div className="card-scrim" />
        {item.rating ? <div className="manga-score">⭐ {item.rating}</div> : null}
        {item.status ? (
          <div className="manga-status">{STATUS_PT[item.status] || item.status}</div>
        ) : null}
      </div>
      <div className="card-footer">
        <h3 className="card-title">{item.title}</h3>
        {sub && <div className="card-subtitle">{sub}</div>}
      </div>
    </button>
  );
}
