"use client";

import { useState } from "react";
import type { HostHomeProps } from "../types";
import { Card } from "../Card";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Select } from "../Select";
import { FAMILY_DEFAULT_TIME_ZONE } from "../format";

type HomeEditorProps = {
  home: HostHomeProps["homes"][number];
  timeZones: string[];
  onUpdateHome: HostHomeProps["onUpdateHome"];
  onAddCoHost: HostHomeProps["onAddCoHost"];
  onRemoveHost: HostHomeProps["onRemoveHost"];
  onSetCapacity: HostHomeProps["onSetCapacity"];
};

function HomeCard({ home, timeZones, onUpdateHome, onAddCoHost, onRemoveHost, onSetCapacity }: HomeEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(home.name);
  const [address, setAddress] = useState(home.address ?? "");
  const [timeZone, setTimeZone] = useState(home.timeZone);
  const [capacity, setCapacity] = useState(home.capacity !== undefined ? String(home.capacity) : "");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | undefined>(undefined);

  const [addingHost, setAddingHost] = useState(false);
  const [coHostEmail, setCoHostEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState<string | undefined>(undefined);

  const [removeMessage, setRemoveMessage] = useState<string | undefined>(undefined);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const timeZoneOptions = timeZones.map((zone) => ({ value: zone, label: zone }));

  function parsedCapacity(): { ok: true; value: number | null } | { ok: false } {
    const trimmed = capacity.trim();
    if (trimmed === "") return { ok: true, value: null };
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n <= 0) return { ok: false };
    return { ok: true, value: n };
  }

  async function save() {
    if (!name.trim() || !timeZone.trim()) return;
    const capacityValue = parsedCapacity();
    if (!capacityValue.ok) {
      setSaveMessage("Capacity must be a positive number, or left blank for no limit.");
      return;
    }
    setSaveBusy(true);
    setSaveMessage(undefined);
    const result = await onUpdateHome(home.id, {
      name: name.trim(),
      address: address.trim() || undefined,
      timeZone: timeZone.trim(),
    });
    if (!result.ok) {
      setSaveBusy(false);
      setSaveMessage(result.message);
      return;
    }
    const capacityResult = await onSetCapacity(home.id, capacityValue.value);
    setSaveBusy(false);
    if (capacityResult.ok) {
      setEditing(false);
    } else {
      setSaveMessage(capacityResult.message);
    }
  }

  async function addCoHost() {
    if (!coHostEmail.trim()) return;
    setAddBusy(true);
    setAddMessage(undefined);
    const result = await onAddCoHost(home.id, coHostEmail.trim());
    setAddBusy(false);
    if (result.ok) {
      setCoHostEmail("");
      setAddingHost(false);
    } else {
      setAddMessage(result.message);
    }
  }

  async function removeHost(memberId: string) {
    setRemovingId(memberId);
    setRemoveMessage(undefined);
    const result = await onRemoveHost(home.id, memberId);
    setRemovingId(null);
    if (!result.ok) {
      setRemoveMessage(result.message);
    }
  }

  return (
    <Card>
      {editing ? (
        <div className="flex flex-col gap-3">
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
            options={timeZoneOptions}
          />
          <TextField
            label="Capacity — how many children can you host at once? (optional)"
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            placeholder="No limit"
            errorText={saveMessage}
          />
          <div className="flex gap-2">
            <Button variant="primary" busy={saveBusy} onClick={save}>
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setName(home.name);
                setAddress(home.address ?? "");
                setTimeZone(home.timeZone);
                setCapacity(home.capacity !== undefined ? String(home.capacity) : "");
                setSaveMessage(undefined);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-display text-[24px] font-semibold text-text">
              {home.name}
            </p>
            <p className="break-words text-[15px] text-muted">
              {home.address ? `${home.address} · ` : ""}
              {home.timeZone}
            </p>
            <p className="mt-1 text-[15px] text-muted">
              {home.capacity !== undefined
                ? `Hosts up to ${home.capacity} child${home.capacity === 1 ? "" : "ren"} at once`
                : "No limit on how many children can stay at once"}
            </p>
          </div>
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {home.hosts.map((host) => (
          <li key={host.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1 break-words text-[17px] text-text">
              {host.name} <span className="text-muted">· {host.email}</span>
            </span>
            <Button
              variant="quiet"
              className="shrink-0"
              busy={removingId === host.id}
              onClick={() => removeHost(host.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {removeMessage ? (
        <p role="alert" className="mt-2 text-[15px] font-semibold text-danger">
          {removeMessage}
        </p>
      ) : null}

      {addingHost ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Co-host's email"
            type="email"
            value={coHostEmail}
            onChange={(event) => setCoHostEmail(event.target.value)}
            errorText={addMessage}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button variant="primary" busy={addBusy} onClick={addCoHost}>
              Add
            </Button>
            <Button variant="secondary" onClick={() => setAddingHost(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="mt-4" onClick={() => setAddingHost(true)}>
          Add co-host
        </Button>
      )}
    </Card>
  );
}

export function HostHome({
  me,
  homes,
  timeZones,
  onAddHome,
  onUpdateHome,
  onAddCoHost,
  onRemoveHost,
  onSetCapacity,
}: HostHomeProps) {
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  // Deterministic on both server and client (unlike the old
  // `Intl.DateTimeFormat().resolvedOptions().timeZone` default, which read
  // the server's own zone during SSR — UTC on Vercel — instead of the
  // viewer's, and so didn't match the client's first render either). Just
  // a prefill for a brand-new home's form field; the host can still change
  // it before saving.
  const [newTimeZone, setNewTimeZone] = useState(FAMILY_DEFAULT_TIME_ZONE);
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState<string | undefined>(undefined);

  const timeZoneOptions = timeZones.map((zone) => ({ value: zone, label: zone }));

  async function addHome() {
    if (!newName.trim() || !newTimeZone.trim()) return;
    setAddBusy(true);
    setAddMessage(undefined);
    const result = await onAddHome({
      name: newName.trim(),
      address: newAddress.trim() || undefined,
      timeZone: newTimeZone.trim(),
    });
    setAddBusy(false);
    if (result.ok) {
      setNewName("");
      setNewAddress("");
    } else {
      setAddMessage(result.message);
    }
  }

  const addForm = (
    <div className="flex flex-col gap-3">
      <TextField label="Home name" value={newName} onChange={(event) => setNewName(event.target.value)} />
      <TextField
        label="Address (optional)"
        value={newAddress}
        onChange={(event) => setNewAddress(event.target.value)}
      />
      <Select
        label="Time zone"
        searchable
        value={newTimeZone}
        onChange={setNewTimeZone}
        options={timeZoneOptions}
        errorText={addMessage}
      />
      <Button variant="primary" busy={addBusy} onClick={addHome}>
        Add home
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Hi {me.name}</p>

      {homes.length === 0 ? (
        <Card letterhead className="text-center">
          <p className="font-display text-[24px] font-semibold text-text">Add your home</p>
          <p className="mt-2 text-[17px] text-muted">
            Add your home so parents can ask to plan a stay there.
          </p>
          <div className="mt-4 text-left">{addForm}</div>
        </Card>
      ) : (
        <>
          {homes.map((home) => (
            <HomeCard
              key={home.id}
              home={home}
              timeZones={timeZones}
              onUpdateHome={onUpdateHome}
              onAddCoHost={onAddCoHost}
              onRemoveHost={onRemoveHost}
              onSetCapacity={onSetCapacity}
            />
          ))}
          <Card>
            <p className="text-[16px] font-bold text-text">Add another home</p>
            <div className="mt-3">{addForm}</div>
          </Card>
        </>
      )}
    </div>
  );
}
