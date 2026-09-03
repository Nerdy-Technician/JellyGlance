import React from "react";
import "../../css/loading.css";

function Loading({ message }) {
  return (
    <div className="loading">
      <div className="loading__spinner"></div>
      {message ? <p className="loading__message">{message}</p> : null}
    </div>
  );
}

export default Loading;