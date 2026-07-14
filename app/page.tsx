import { listApplications } from "@/lib/db";
import { AlertCircle, Calendar, Clock, Flame, FlaskConical, HelpCircle, Target, TrendingUp } from "lucide-react";
import { updateStatusAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default function Home() {
  const applications = listApplications();

  const totalApplied = applications.filter(a => a.estado !== "pendiente").length;
  const totalInterviews = applications.filter(a => a.estado === "entrevista").length;
  const conversionRate = totalApplied > 0 ? ((totalInterviews / totalApplied) * 100).toFixed(1) : "0.0";
  const conversionNumber = parseFloat(conversionRate);

  const staleApps = applications.filter(app => {
    if (app.estado !== "aplicado") return false;
    const daysDiff = (Date.now() - new Date(app.updatedAt).getTime()) / (1000 * 3600 * 24);
    return daysDiff > 7;
  });

  // Goals Logic
  const dailyGoal = 10;
  const weeklyGoal = 70;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayApps = applications.filter(a => new Date(a.createdAt).getTime() >= todayStart.getTime());
  const dailyProgress = Math.min((todayApps.length / dailyGoal) * 100, 100);

  const recentApps = applications.filter(a => {
    const daysDiff = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 3600 * 24);
    return daysDiff <= 7;
  });
  const weeklyProgress = Math.min((recentApps.length / weeklyGoal) * 100, 100);

  // Streak Logic
  const appsByDate = applications.reduce((acc, app) => {
    const d = new Date(app.createdAt);
    const dateStr = d.toLocaleDateString();
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let currentStreak = 0;
  let dateToCheck = new Date();
  const todayStr = dateToCheck.toLocaleDateString();

  if ((appsByDate[todayStr] || 0) >= dailyGoal) {
    currentStreak++;
  }
  dateToCheck.setDate(dateToCheck.getDate() - 1);

  while ((appsByDate[dateToCheck.toLocaleDateString()] || 0) >= dailyGoal) {
    currentStreak++;
    dateToCheck.setDate(dateToCheck.getDate() - 1);
  }

  const cvStats = applications.reduce((acc, app) => {
    const version = app.cvVersion || "Sin especificar";
    if (!acc[version]) acc[version] = { total: 0, interviews: 0 };
    if (app.estado !== "pendiente") acc[version].total++;
    if (app.estado === "entrevista") acc[version].interviews++;
    return acc;
  }, {} as Record<string, { total: number; interviews: number }>);

  return (
    <div className="dashboard-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 'calc(100vh - 130px)', padding: '12px 0 24px 0' }}>
      {/* GOALS HERO WIDGET */}
      <div className="dashboard-card goals-hero-card" style={{ flexShrink: 0 }}>
        <h3>
          <div className="widget-title-left">
            <Target size={18} /> Rendimiento y Objetivos
          </div>
          <div className="widget-help-container">
            <HelpCircle size={16} className="widget-help-icon" />
            <div className="widget-tooltip">
              Mantener un volumen alto de postulaciones es clave. Cumple tu objetivo diario y semanal para mantener tu racha de consistencia.
            </div>
          </div>
        </h3>
        <div className="goals-hero-grid">
          <div className="goal-hero-item">
            <div className="goal-hero-title"><Target size={16} /> Objetivo Diario</div>
            <div className="goal-hero-value">
              {todayApps.length} <span className="goal-target">/ {dailyGoal}</span>
            </div>
            <div className="goal-hero-progress-bg">
              <div className={`goal-hero-progress-fill ${dailyProgress >= 100 ? 'success' : ''}`} style={{ width: `${dailyProgress}%` }}></div>
            </div>
            <div className={`goal-hero-status ${dailyProgress >= 100 ? 'success' : 'pending'}`}>
              {dailyProgress >= 100 ? '¡Objetivo cumplido! 🚀' : `Faltan ${dailyGoal - todayApps.length} postulaciones`}
            </div>
          </div>
          
          <div className="goal-hero-item">
            <div className="goal-hero-title"><Calendar size={16} /> Objetivo Semanal</div>
            <div className="goal-hero-value">
              {recentApps.length} <span className="goal-target">/ {weeklyGoal}</span>
            </div>
            <div className="goal-hero-progress-bg">
              <div className={`goal-hero-progress-fill ${weeklyProgress >= 100 ? 'success' : ''}`} style={{ width: `${weeklyProgress}%` }}></div>
            </div>
            <div className={`goal-hero-status ${weeklyProgress >= 100 ? 'success' : 'pending'}`}>
              {weeklyProgress >= 100 ? '¡Semana superada! 🎉' : `Faltan ${weeklyGoal - recentApps.length} postulaciones`}
            </div>
          </div>

          <div className="goal-hero-item">
            <div className="goal-hero-title"><Flame size={16} /> Racha Actual</div>
            <div className="goal-hero-value">
              {currentStreak} <span className="goal-target">días</span>
            </div>
            <div className="goal-hero-status success" style={{ color: currentStreak > 0 ? 'var(--success)' : 'var(--muted)' }}>
              {currentStreak > 0 ? '¡Consistencia perfecta!' : '¡Cumple tu objetivo para iniciar tu racha!'}
            </div>
            <Flame size={80} className={`streak-icon-bg ${currentStreak > 0 ? 'active' : ''}`} />
          </div>
        </div>
      </div>

      <div className="dashboard-bottom-row" style={{ display: 'flex', gap: '24px', flex: 1, flexWrap: 'wrap' }}>
        {/* Funnel Card */}
        <div className="dashboard-card" style={{ flex: '1 1 300px' }}>
          <h3>
            <div className="widget-title-left">
              <TrendingUp size={18} /> Embudo de Conversión
            </div>
            <div className="widget-help-container">
              <HelpCircle size={16} className="widget-help-icon" />
              <div className="widget-tooltip">
                Compara el total de postulaciones enviadas con las que lograron avanzar a la etapa de entrevista. Te ayuda a diagnosticar si tu CV está funcionando.
              </div>
            </div>
          </h3>

          <div className="metric-hero" style={{ margin: 'auto 0' }}>
            <span className="metric-hero-value">{conversionRate}%</span>
            <span className="metric-hero-label">Tasa de Éxito</span>
          </div>

          <div className="progress-container">
            <div className="progress-label">
              <span>Enviadas: {totalApplied}</span>
              <span>Entrevistas: {totalInterviews}</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${conversionNumber}%` }}></div>
            </div>
          </div>
        </div>

        {/* A/B Testing Card */}
        <div className="dashboard-card" style={{ flex: '1 1 300px' }}>
          <h3>
            <div className="widget-title-left">
              <FlaskConical size={18} /> A/B Testing de CVs
            </div>
            <div className="widget-help-container">
              <HelpCircle size={16} className="widget-help-icon" />
              <div className="widget-tooltip">
                Analiza la tasa de éxito de cada versión de tu CV. Útil para descubrir qué perfil o formato resuena mejor con los reclutadores y enfocarte en ese.
              </div>
            </div>
          </h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {Object.keys(cvStats).length === 0 ? (
              <div className="stale-empty" style={{ margin: 'auto' }}>No hay suficientes datos todavía.</div>
            ) : (
              <table className="dashboard-ab-table" style={{ margin: 'auto 0' }}>
                <thead>
                  <tr>
                    <th>Versión CV</th>
                    <th>Enviados</th>
                    <th>Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cvStats).map(([version, stats]) => {
                    const rateNum = stats.total > 0 ? (stats.interviews / stats.total) * 100 : 0;
                    const rateStr = rateNum.toFixed(1);
                    return (
                      <tr key={version}>
                        <td style={{ fontWeight: 600 }}>{version}</td>
                        <td>{stats.total}</td>
                        <td>
                          <div className="ab-rate-container">
                            <span className="highlight">{rateStr}%</span>
                            <div className="ab-rate-bar">
                              <div className="ab-rate-fill" style={{ width: `${rateNum}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Follow-ups Card */}
        <div className="dashboard-card" style={{ flex: '1 1 300px' }}>
          <h3>
            <div className="widget-title-left">
              <Clock size={18} /> Acción Requerida
            </div>
            <div className="widget-help-container">
              <HelpCircle size={16} className="widget-help-icon" />
              <div className="widget-tooltip">
                Lista las postulaciones en estado 'Aplicado' que llevan más de 7 días sin novedades. ¡Es el momento perfecto para enviar un email de seguimiento!
              </div>
            </div>
          </h3>
          <div className="stale-list" style={{ flex: 1, maxHeight: 'none' }}>
            {staleApps.length === 0 ? (
              <div className="stale-empty" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div>¡Estás al día! 🎉<br /><span style={{ fontSize: 12, fontWeight: 400 }}>No hay follow-ups pendientes.</span></div>
              </div>
            ) : (
              staleApps.map(app => (
                <div key={app.id} className="stale-item">
                  <div className="stale-item-info">
                    <span className="stale-item-title">{app.nombreEmpresa}</span>
                    <span className="stale-item-date">
                      <AlertCircle size={12} /> Hace más de 7 días
                    </span>
                  </div>
                  <form action={async () => {
                    "use server";
                    await updateStatusAction(app.id, "rechazado");
                  }}>
                    <button
                      type="submit"
                      className="icon-button"
                      title="Marcar como rechazado"
                    >
                      <Target size={14} />
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
