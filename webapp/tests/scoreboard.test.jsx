import React from "react";
import { render, screen, within } from "@testing-library/react";
import Scoreboard from "../src/components/Scoreboard.jsx";

function activeSticks(element) {
  return element.querySelectorAll('[data-stick-active="true"]');
}

test("anota nueve como un grupo de cinco y otro de cuatro", () => {
  render(
    <Scoreboard
      target={15}
      teams={[
        { name: "Nosotros", score: 9 },
        { name: "Ellos", score: 4 },
      ]}
      finished={false}
      winner={null}
    />
  );

  const nosotros = screen.getByTestId("cerillos-Nosotros-tantos");
  expect(activeSticks(nosotros)).toHaveLength(9);
  expect(
    activeSticks(screen.getByTestId("cerillo-grupo-Nosotros-tantos-0"))
  ).toHaveLength(5);
  expect(
    activeSticks(screen.getByTestId("cerillo-grupo-Nosotros-tantos-1"))
  ).toHaveLength(4);
  expect(activeSticks(screen.getByTestId("cerillos-Ellos-tantos"))).toHaveLength(4);
});

test("a treinta separa los primeros quince como malas y el resto como buenas", () => {
  render(
    <Scoreboard
      target={30}
      teams={[
        { name: "Patagonia", score: 16 },
        { name: "Salta", score: 30 },
      ]}
      finished={false}
      winner={null}
    />
  );

  expect(activeSticks(screen.getByTestId("cerillos-Patagonia-malas"))).toHaveLength(15);
  expect(activeSticks(screen.getByTestId("cerillos-Patagonia-buenas"))).toHaveLength(1);
  expect(activeSticks(screen.getByTestId("cerillos-Salta-malas"))).toHaveLength(15);
  expect(activeSticks(screen.getByTestId("cerillos-Salta-buenas"))).toHaveLength(15);
  expect(screen.getByTestId("equipo-Patagonia").querySelector(".puntos"))
    .toHaveClass("buenas");
});

test("mantiene número exacto y anuncia al campeón", () => {
  render(
    <Scoreboard
      target={15}
      teams={[
        { name: "Racing", score: 15 },
        { name: "River", score: 8 },
      ]}
      finished
      winner="Racing"
    />
  );

  const champion = screen.getByLabelText("Racing: 15 puntos, campeón");
  expect(champion).toHaveClass("campeon");
  expect(within(champion).getByText("15")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Racing, tantos: 15 puntos en cerillos" }))
    .toBeInTheDocument();
});

test("en 1v1 muestra participantes aunque el estado conserve colectividades", () => {
  render(
    <Scoreboard
      target={15}
      teams={[
        { name: "Patagonia", score: 8, players: ["Máquina-9"] },
        { name: "Salta", score: 9, players: ["Androide-3"] },
      ]}
      finished={false}
      winner={null}
    />
  );

  expect(screen.getByText("Máquina-9")).toBeInTheDocument();
  expect(screen.getByText("Androide-3")).toBeInTheDocument();
  expect(screen.queryByText("Patagonia")).not.toBeInTheDocument();
  expect(screen.queryByText("Salta")).not.toBeInTheDocument();
});
