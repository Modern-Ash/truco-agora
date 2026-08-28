import React from "react";

export default function Spinner({ size = "sm", testId }) {
  return (
    <span
      aria-hidden="true"
      className={`waiting-spinner waiting-spinner--${size}`}
      data-testid={testId}
    />
  );
}
