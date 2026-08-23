import React, { useEffect, useState } from "react";
import Lobby from "./Lobby.jsx";
import Mesa from "./Mesa.jsx";

function matchIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("match");
}

export default function App() {
  const [matchId, setMatchId] = useState(matchIdFromUrl());

  useEffect(() => {
    const onPop = () => setMatchId(matchIdFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (!matchId) return <Lobby onCreated={(id) => setMatchId(id)} />;
  return <Mesa matchId={matchId} />;
}
