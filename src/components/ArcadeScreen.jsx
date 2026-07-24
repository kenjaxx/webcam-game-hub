import './ArcadeScreen.css';

// Shared full-screen backdrop + layout chrome for every non-gameplay screen
// (difficulty select, game over) so they visually match the arcade homepage.
export default function ArcadeScreen({ eyebrow, title, children }) {
  return (
    <div className="screen">
      <div className="screen__bg" aria-hidden="true">
        <div className="screen__grid" />
        <div className="screen__glow" />
        <div className="screen__scanlines" />
      </div>
      <div className="screen__content">
        {eyebrow && <p className="screen__eyebrow">{eyebrow}</p>}
        {title && <h2 className="screen__title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}