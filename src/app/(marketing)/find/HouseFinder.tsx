"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { copy } from "@/config/copy";

type House = { campus: string; name: string; token: string };

export function HouseFinder({ houses }: { houses: House[] }) {
  const [campus, setCampus] = useState("");
  const [token, setToken] = useState("");

  const campuses = useMemo(
    () => Array.from(new Set(houses.map((h) => h.campus))).sort(),
    [houses]
  );
  const housesForCampus = useMemo(
    () => houses.filter((h) => h.campus === campus).sort((a, b) => a.name.localeCompare(b.name)),
    [houses, campus]
  );

  return (
    <div className="stack">
      <label>
        Campus
        <select
          value={campus}
          onChange={(e) => {
            setCampus(e.target.value);
            setToken("");
          }}
        >
          <option value="">Select your campus…</option>
          {campuses.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      {campus && (
        <label>
          House
          <select value={token} onChange={(e) => setToken(e.target.value)}>
            <option value="">Select your house…</option>
            {housesForCampus.map((h) => (
              <option key={h.token} value={h.token}>{h.name}</option>
            ))}
          </select>
        </label>
      )}

      {token ? (
        <Link className="btn full" href={`/join/${token}`}>Continue to sign up</Link>
      ) : (
        <button className="btn full" disabled>Continue to sign up</button>
      )}

      <p className="fine">
        Don&apos;t see your house?{" "}
        <Link href="/bring-scc">{copy.marketing.ctaBringScc}</Link>.
      </p>
    </div>
  );
}
