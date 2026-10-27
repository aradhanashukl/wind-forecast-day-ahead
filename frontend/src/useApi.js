import { useEffect, useState } from "react";

export const API = import.meta.env.VITE_API_URL ?? "";

// Loads JSON from the API. Never throws: returns loading / ok / error state.
export function useApi(path, attempt = 0) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const ctl = new AbortController();
    setState({ status: "loading" });

    fetch(`${API}${path}`, { signal: ctl.signal })
      .then(async (r) => {
        if (!r.ok) {
          let msg = `The server answered with an error (${r.status}).`;
          try {
            const body = await r.json();
            if (body && typeof body.detail === "string") msg = body.detail;
          } catch { /* keep default message */ }
          throw new Error(msg);
        }
        return r.json();
      })
      .then((data) => setState({ status: "ok", data }))
      .catch((e) => {
        if (e && e.name === "AbortError") return;
        setState({
          status: "error",
          message:
            e instanceof TypeError
              ? "Cannot reach the data service. Check that the API is running, then try again."
              : e.message,
        });
      });

    return () => ctl.abort();
  }, [path, attempt]);

  return state;
}