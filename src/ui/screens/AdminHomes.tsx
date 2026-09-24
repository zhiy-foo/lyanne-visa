"use client";

import { useState } from "react";
import type { AdminHomesProps } from "../types";
import { Card } from "../Card";
import { Collapsible } from "../Collapsible";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Select } from "../Select";

type Account = AdminHomesProps["accounts"][number];

function HomeCard({
  home,
  accounts,
  timeZones,
  defaultOpen,
  onUpdateHome,
  onLinkHost,
}: {
  home: AdminHomesProps["homes"][number];
  accounts: Account[];
  timeZones: string[];
  defaultOpen: boolean;
  onUpdateHome: AdminHomesProps["onUpdateHome"];
  onLinkHost: AdminHomesProps["onLinkHost"];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(home.name);
  const [address, setAddress] = useState(home.address ?? "");
  const [timeZone, setTimeZone] = useState(home.timeZone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [linkToAdd, setLinkToAdd] = useState("");
  const [linkBusy, setLinkBusy] = useState<string | null>(null);

  const linkedHosts = accounts.filter((account) => home.hostIds.includes(account.id));
  const availableHosts = accounts.filter(
    (account) =>
      account.role === "host" && account.status === "active" && !home.hostIds.includes(account.id),
  );

  async function save() {
    if (!name.trim() || !timeZone.trim()) return;
    setBusy(true);
    setMessage(undefined);
    const result = await onUpdateHome(home.id, {
      name: name.trim(),
      address: address.trim() || undefined,
      timeZone: timeZone.trim(),
    });
    setBusy(false);
    if (result.ok) setEditing(false);
    else setMessage(result.message);
  }

  async function toggleLink(accountId: string, linked: boolean) {
    setLinkBusy(accountId);
    const result = await onLinkHost(home.id, accountId, linked);
    setLinkBusy(null);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <Card>
      <Collapsible
        defaultOpen={defaultOpen}
        summary={
          <span className="min-w-0 flex-1 break-words">
            {home.name}
            <span className="ml-2 font-normal text-muted">
              {linkedHosts.length} host{linkedHosts.length === 1 ? "" : "s"}
            </span>
          </span>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-2">
            <TextField label="Home name" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField
              label="Address (optional)"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <Select
              label="Time zone"
              searchable
              value={timeZone}
              onChange={setTimeZone}
              options={timeZones.map((zone) => ({ value: zone, label: zone }))}
            />
            <div className="flex gap-2">
              <Button variant="primary" busy={busy} onClick={save}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-words text-[15px] text-muted">
              {home.address ? `${home.address} · ` : ""}
              {home.timeZone}
            </p>
            <Button variant="quiet" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
        <ul className="mt-3 flex flex-col gap-1">
          {linkedHosts.map((host) => (
            <li
              key={host.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[15px] text-text"
            >
              <span className="min-w-0 flex-1 break-words">
                {host.name} · {host.email}
              </span>
              <Button
                variant="quiet"
                className="shrink-0"
                busy={linkBusy === host.id}
                onClick={() => toggleLink(host.id, false)}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
        {availableHosts.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Link a host"
              className="w-full min-w-0 sm:flex-1"
              value={linkToAdd}
              onChange={setLinkToAdd}
              placeholder="Choose a host account"
              options={availableHosts.map((account) => ({ value: account.id, label: `${account.name} · ${account.email}` }))}
            />
            <Button
              variant="secondary"
              busy={linkBusy === linkToAdd}
              disabled={!linkToAdd}
              onClick={() => {
                toggleLink(linkToAdd, true);
                setLinkToAdd("");
              }}
            >
              Link
            </Button>
          </div>
        ) : null}
        {message ? (
          <p role="alert" className="mt-2 text-[15px] font-semibold text-danger">
            {message}
          </p>
        ) : null}
      </Collapsible>
    </Card>
  );
}

export function AdminHomes({ homes, accounts, timeZones, onUpdateHome, onLinkHost }: AdminHomesProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Homes</p>

      {homes.length === 0 ? (
        <Card>
          <p className="text-[17px] text-muted">No homes yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {homes.map((home) => (
            <HomeCard
              key={home.id}
              home={home}
              accounts={accounts}
              timeZones={timeZones}
              defaultOpen={homes.length === 1}
              onUpdateHome={onUpdateHome}
              onLinkHost={onLinkHost}
            />
          ))}
        </div>
      )}
    </div>
  );
}
