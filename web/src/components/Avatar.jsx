// Avatares predefinidos (emoji). O utilizador pode também usar um URL de imagem.
export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐱", "🦁", "🐯", "🐸", "🐵", "🐶",
  "🐺", "🐲", "👾", "🤖", "🎬", "🍿", "⭐", "🔥",
];

// Renderiza o avatar de um utilizador: imagem (URL), emoji predefinido
// ("emoji:🦊") ou, em último caso, a inicial do nome.
export default function Avatar({ avatar, name = "?", size = 38 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5) };

  if (avatar && /^https?:\/\//i.test(avatar)) {
    return <img className="avatar-img" src={avatar} alt={name} style={style} />;
  }
  if (avatar && avatar.startsWith("emoji:")) {
    return (
      <span className="avatar-emoji" style={style}>
        {avatar.slice(6)}
      </span>
    );
  }
  return (
    <span className="avatar-initial" style={style}>
      {(name[0] || "?").toUpperCase()}
    </span>
  );
}
