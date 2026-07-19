import CheckLineIcon from "remixicon-react/CheckLineIcon";
import AdminLineIcon from "remixicon-react/AdminLineIcon";
import ServerLineIcon from "remixicon-react/ServerLineIcon";
import PlugLineIcon from "remixicon-react/PlugLineIcon";
import DashboardLineIcon from "remixicon-react/DashboardLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import Key2LineIcon from "remixicon-react/Key2LineIcon";
import logo from "../../images/icon-b-512.png";
import jellyfinLogo from "../../images/jellyfin.svg";
import projectText from "../../images/project-text.png";
import AuthArtworkBackground from "../AuthArtworkBackground";

const steps = [
  {
    id: 1,
    title: "Jellyfin server",
    hint: "Connect analytics",
    icon: ServerLineIcon,
    logo: jellyfinLogo,
  },
  {
    id: 2,
    title: "Admin access",
    hint: "Quick Connect or OIDC",
    icon: AdminLineIcon,
  },
  {
    id: 3,
    title: "Integrations",
    hint: "Optional next step",
    icon: PlugLineIcon,
  },
];

const features = [
  {
    title: "Playback intelligence",
    text: "Turn Jellyfin activity into fast, useful library and user insights.",
    icon: DashboardLineIcon,
  },
  {
    title: "Local data store",
    text: "Keep the analytics cache close to your stack with PostgreSQL.",
    icon: Database2LineIcon,
  },
  {
    title: "API-key sync",
    text: "Connect once, validate the server, then start the first sync.",
    icon: Key2LineIcon,
  },
];

const defaultPosterTiles = Array.from({ length: 42 }, (_, index) => index);

export default function SetupShell({ step, eyebrow, title, description, children }) {
  const progress = Math.round((step / steps.length) * 100);

  return (
    <section className="setup-page">
      <div className="setup-background" />
      {step === 1 && (
        <div className="setup-default-artwork" aria-hidden="true">
          <div className="setup-default-artwork-grid">
            {defaultPosterTiles.map((item) => (
              <span className="setup-default-artwork-tile" key={item} />
            ))}
          </div>
          <div className="setup-default-artwork-scrim" />
          <div className="setup-default-artwork-vignette" />
        </div>
      )}
      <AuthArtworkBackground enabled={step > 1} />
      <div className="setup-card">
        <aside className="setup-sidebar">
          <div className="setup-brand">
            <div className="setup-logo-mark">
              <img src={logo} alt="" />
            </div>
            <div>
              <p className="setup-brand-kicker">Initial Setup</p>
              <img className="setup-brand-wordmark" src={projectText} alt="JellyGlance" />
              <p className="setup-brand-author">by Nerdy-Technician</p>
            </div>
          </div>

          <nav className="setup-step-list" aria-label="Setup progress">
            {steps.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === step;
              const isDone = item.id < step;

              const stepGraphic = item.logo && !isDone ? <img src={item.logo} alt="" /> : isDone ? <CheckLineIcon /> : <Icon />;

              return (
                <div className={`setup-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`} key={item.id}>
                  <span className="setup-step-icon">{stepGraphic}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.hint}</small>
                  </span>
                </div>
              );
            })}
          </nav>

          <div className="setup-progress-block">
            <div className="setup-progress-meta">
              <span>Setup progress</span>
              <strong>{progress}%</strong>
            </div>
            <div className="setup-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              Step {step} of {steps.length}
            </p>
          </div>
        </aside>

        <main className="setup-main">
          <div className="setup-mobile-steps">
            {steps.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === step;
              const isDone = item.id < step;
              const stepGraphic = item.logo && !isDone ? <img src={item.logo} alt="" /> : isDone ? <CheckLineIcon /> : <Icon />;
              return (
                <span className={`setup-mobile-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`} key={item.id}>
                  {stepGraphic}
                  {item.title}
                </span>
              );
            })}
            <div className="setup-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="setup-content">
            <div className="setup-intro">
              <span className="setup-eyebrow">{eyebrow}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>

            <div className="setup-feature-grid">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div className="setup-feature" key={feature.title}>
                    <span>
                      <Icon />
                    </span>
                    <div>
                      <strong>{feature.title}</strong>
                      <small>{feature.text}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="setup-form-panel">
              {children}
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
