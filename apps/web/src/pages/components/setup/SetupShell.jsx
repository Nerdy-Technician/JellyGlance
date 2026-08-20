import { useEffect } from "react";
import CheckLineIcon from "remixicon-react/CheckLineIcon";
import AdminLineIcon from "remixicon-react/AdminLineIcon";
import ServerLineIcon from "remixicon-react/ServerLineIcon";
import PlugLineIcon from "remixicon-react/PlugLineIcon";
import RefreshLineIcon from "remixicon-react/RefreshLineIcon";
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
    hint: "Arr, Seerr, downloads",
    icon: PlugLineIcon,
  },
  {
    id: 4,
    title: "History import",
    hint: "Tautulli backup",
    icon: Database2LineIcon,
  },
  {
    id: 5,
    title: "First sync",
    hint: "Build dashboard data",
    icon: RefreshLineIcon,
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

export default function SetupShell({ step, eyebrow, title, description, children, minimal = false }) {
  const progress = Math.round((step / steps.length) * 100);
  const activeStepMeta = steps.find((item) => item.id === step) || steps[0];
  const completedSteps = Math.max(0, step - 1);

  useEffect(() => {
    document.body.classList.add("setup-mode");
    return () => {
      document.body.classList.remove("setup-mode");
    };
  }, []);

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
      <div className="setup-card setup-card-remade">
        <header className="setup-header">
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

          <div className="setup-progress-badges" aria-hidden="true">
            <span>{completedSteps} done</span>
            <span>{steps.length - step} left</span>
            <span>{progress}% ready</span>
          </div>
        </header>

        <div className="setup-progress-strip" aria-label="Setup progress">
          {steps.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === step;
            const isDone = item.id < step;
            const stepGraphic = item.logo && !isDone ? <img src={item.logo} alt="" /> : isDone ? <CheckLineIcon /> : <Icon />;

            return (
              <div className={`setup-progress-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`} key={item.id}>
                <span className="setup-progress-node">{stepGraphic}</span>
                <div className="setup-progress-copy">
                  <small>{String(item.id).padStart(2, "0")}</small>
                  <strong>{item.title}</strong>
                </div>
              </div>
            );
          })}
          <div className="setup-progress-line" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <main className="setup-main">
          <div className="setup-content">
            {!minimal ? (
              <div className="setup-topbar">
                <div className="setup-intro">
                  <span className="setup-eyebrow">{eyebrow}</span>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <div className="setup-intro-meta">
                    <span>Step {step} of {steps.length}</span>
                    <span>{activeStepMeta.hint}</span>
                  </div>
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
              </div>
            ) : null}

            <div className="setup-form-panel">
              {children}
            </div>
          </div>
        </main>

        <div className="setup-mobile-steps">
          <div className="setup-mobile-progress-meta">
            <span>{activeStepMeta.title}</span>
            <strong>{progress}%</strong>
          </div>
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
      </div>
    </section>
  );
}
