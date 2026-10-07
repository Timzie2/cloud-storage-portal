import Logo from "./Logo";

function NovaLoader({ message = "Preparing your workspace..." }) {
  return (
    <div className="nova-loading-screen">
      <div className="nova-loading-content">
        <div className="nova-loading-logo">
          <Logo />
        </div>

        <div className="nova-loading-spinner" aria-hidden="true">
          <span />
        </div>

        <div className="nova-loading-text">
          <strong>{message}</strong>
          <span>Just a moment...</span>
        </div>
      </div>
    </div>
  );
}

export default NovaLoader;