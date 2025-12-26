// src/components/ExternalRedirect.tsx
import { useEffect } from "react";

export default function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}
