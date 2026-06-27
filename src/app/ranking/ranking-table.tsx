"use client";

import { useRef } from "react";

import { UserIdentity } from "@/components/user-avatar";

export type RankingTableRow = {
  avatarImageDataUrl: string | null;
  displayName: string;
  exactCount: number;
  oneTeamGoalsCount: number;
  outcomeCount: number;
  placementCount: number;
  placementPoints: number;
  rank: number;
  scoredMatches: number;
  totalPoints: number;
  userId: string;
};

const columns = [
  { className: "ranking-number-cell", label: "Pos." },
  { label: "Jogador" },
  { className: "ranking-number-cell", label: "Gol de um time" },
  { className: "ranking-number-cell", label: "G/P/Empate" },
  { className: "ranking-number-cell", label: "Placar exato" },
  { className: "ranking-number-cell", label: "Campeões" },
  { className: "ranking-number-cell", label: "Aproveitamento" },
  { className: "ranking-number-cell", label: "Total" },
];

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

export function RankingTable({ rows }: { rows: RankingTableRow[] }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  function syncScroll(source: "header" | "table") {
    if (isSyncingRef.current) {
      return;
    }

    const header = headerRef.current;
    const table = tableRef.current;

    if (!header || !table) {
      return;
    }

    const from = source === "header" ? header : table;
    const to = source === "header" ? table : header;

    isSyncingRef.current = true;
    to.scrollLeft = from.scrollLeft;
    window.requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }

  return (
    <div className="ranking-table-region">
      <div
        className="ranking-sticky-header"
        onScroll={() => syncScroll("header")}
        ref={headerRef}
      >
        <div className="ranking-sticky-row">
          {columns.map((column) => (
            <div
              className={["ranking-sticky-cell", column.className].filter(Boolean).join(" ")}
              key={column.label}
            >
              {column.label}
            </div>
          ))}
        </div>
      </div>

      <div
        className="ranking-table-wrap"
        onScroll={() => syncScroll("table")}
        ref={tableRef}
      >
        <table className="ranking-table">
          <colgroup>
            <col className="ranking-col-position" />
            <col className="ranking-col-player" />
            <col className="ranking-col-method" />
            <col className="ranking-col-outcome" />
            <col className="ranking-col-method" />
            <col className="ranking-col-method" />
            <col className="ranking-col-usage" />
            <col className="ranking-col-total" />
          </colgroup>
          <thead className="ranking-table-head-hidden">
            <tr>
              {columns.map((column) => (
                <th
                  className={column.className}
                  key={column.label}
                  scope="col"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td className="ranking-position ranking-number-cell">{row.rank}</td>
                <th className="ranking-player" scope="row">
                  <UserIdentity user={row} />
                </th>
                <td className="ranking-number-cell">
                  <strong>{row.oneTeamGoalsCount}</strong>
                </td>
                <td className="ranking-number-cell">
                  <strong>{row.outcomeCount}</strong>
                </td>
                <td className="ranking-number-cell">
                  <strong>{row.exactCount}</strong>
                </td>
                <td className="ranking-number-cell">
                  <strong>{row.placementCount}</strong>
                </td>
                <td className="ranking-number-cell">
                  <strong>{row.scoredMatches}</strong>
                  <span>pontuados</span>
                </td>
                <td className="ranking-total ranking-number-cell">
                  <strong>{formatPoints(row.totalPoints)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
