import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { BadgeIcon } from "../components/icons.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";

export default function Achievements() {
  const { user, ready } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .achievements()
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (ready && !user) {
    return (
      <p className="status muted">
        <Link to="/login">Entra</Link> para veres as tuas conquistas.
      </p>
    );
  }
  if (loading) return <LoadingStatus>A carregar conquistas</LoadingStatus>;

  const badges = data?.badges || [];
  const unlocked = badges.filter((b) => b.unlocked);
  const streak = data?.streak ?? 0;
  const bestStreak = data?.bestStreak ?? 0;

  return (
    <div className="sub-page achievements-page">
      <div className="ach-header">
        <h2 className="row-title">Conquistas</h2>
        <div className="ach-streak">
          <span className="ach-streak-num">{streak}</span>
          <span className="ach-streak-label">dias de racha</span>
          <span className="ach-streak-best">melhor: {bestStreak}</span>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 4 }}>
        {unlocked.length} de {badges.length} conquistadas
      </p>

      <div className="ach-grid">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`ach-card ${b.unlocked ? "unlocked" : "locked"}`}
            title={b.unlocked ? undefined : b.desc}
          >
            <div className="ach-icon">
              <BadgeIcon id={b.icon} />
            </div>
            <div className="ach-body">
              <h3 className="ach-name">{b.label}</h3>
              <p className="ach-desc muted">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
