"use client";

import { useState } from "react";
import type { AdminProps, Side } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Select } from "../Select";
import { Badge } from "../Badge";
import { ConfirmDialog } from "../ConfirmDialog";

type Account = AdminProps["accounts"][number];

function statusBadge(status: Account["status"]) {
  if (status === "active") return <Badge variant="confirmed" icon="✓" label="Active" />;
  if (status === "waiting") return <Badge variant="attention" icon="!" label="Waiting" />;
  return <Badge variant="neutral" icon="–" label="Deactivated" />;
}

function isUnlinked(account: Account) {
  return account.childIds.length === 0 && account.homeIds.length === 0;
}

function WaitingCard({
  account,
  onApprove,
  onDecline,
}: {
  account: Account;
  onApprove: AdminProps["onApprove"];
  onDecline: AdminProps["onDecline"];
}) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function approve() {
    setBusy("approve");
    setMessage(undefined);
    const result = await onApprove(account.id);
    setBusy(null);
    if (!result.ok) setMessage(result.message);
  }

  async function decline() {
    setBusy("decline");
    setMessage(undefined);
    const result = await onDecline(account.id);
    setBusy(null);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-text">{account.name}</p>
          <p className="text-[15px] text-muted">
            {account.email} · {account.role === "parent" ? "Parent" : "Host"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" busy={busy === "approve"} onClick={approve}>
            Approve
          </Button>
          <Button variant="danger" busy={busy === "decline"} onClick={decline}>
            Decline
          </Button>
        </div>
      </div>
      {message ? (
        <p role="alert" className="mt-2 text-[15px] font-semibold text-danger">
          {message}
        </p>
      ) : null}
    </Card>
  );
}

function JoinCodeCard({
  joinCodeSet,
  onSetJoinCode,
}: {
  joinCodeSet: boolean;
  onSetJoinCode: AdminProps["onSetJoinCode"];
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function save() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage(undefined);
    const result = await onSetJoinCode(code.trim());
    setBusy(false);
    if (result.ok) {
      setEditing(false);
      setCode("");
    } else {
      setMessage(result.message);
    }
  }

  async function clear() {
    setBusy(true);
    setMessage(undefined);
    const result = await onSetJoinCode(null);
    setBusy(false);
    if (result.ok) {
      setEditing(false);
      setCode("");
    } else {
      setMessage(result.message);
    }
  }

  return (
    <Card>
      <p className="text-[16px] font-bold text-text">Join code</p>
      <p className="mt-1 text-[17px] text-text">
        {joinCodeSet ? "••••••" : "No code set"}
      </p>
      {editing ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="New code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            errorText={message}
            className="flex-1"
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
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {joinCodeSet ? "Change" : "Set a code"}
          </Button>
          {joinCodeSet ? (
            <Button variant="danger" busy={busy} onClick={clear}>
              Clear
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function AccountRow({
  account,
  onDeactivate,
  onReactivate,
  onSetRole,
}: {
  account: Account;
  onDeactivate: AdminProps["onDeactivate"];
  onReactivate: AdminProps["onReactivate"];
  onSetRole: AdminProps["onSetRole"];
}) {
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [roleMessage, setRoleMessage] = useState<string | undefined>(undefined);
  const [roleBusy, setRoleBusy] = useState(false);

  async function deactivate() {
    setBusy(true);
    setMessage(undefined);
    const result = await onDeactivate(account.id);
    setBusy(false);
    setConfirmingDeactivate(false);
    if (!result.ok) setMessage(result.message);
  }

  async function reactivate() {
    setBusy(true);
    setMessage(undefined);
    const result = await onReactivate(account.id);
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  async function changeRole(role: Side) {
    if (role === account.role) return;
    setRoleBusy(true);
    setRoleMessage(undefined);
    const result = await onSetRole(account.id, role);
    setRoleBusy(false);
    if (!result.ok) setRoleMessage(result.message);
  }

  const unlinked = isUnlinked(account);

  return (
    <li className={["py-3", account.status === "deactivated" ? "opacity-60" : ""].join(" ")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-text">{account.name}</p>
          <p className="text-[15px] text-muted">{account.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {statusBadge(account.status)}
            {account.status !== "deactivated" && unlinked ? (
              <Badge variant="neutral" icon="＋" label="New — not linked to anyone yet" />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unlinked ? (
            <Select
              label="Role"
              className="w-36"
              value={account.role}
              onChange={(value) => changeRole(value as Side)}
              options={[
                { value: "parent", label: "Parent" },
                { value: "host", label: "Host" },
              ]}
              disabled={roleBusy}
            />
          ) : (
            <span className="text-[15px] text-muted">
              {account.role === "parent" ? "Parent" : "Host"}
            </span>
          )}
          {account.status === "deactivated" ? (
            <Button variant="secondary" busy={busy} onClick={reactivate}>
              Reactivate
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDeactivate(true)}>
              Deactivate
            </Button>
          )}
        </div>
      </div>
      {message ? (
        <p role="alert" className="mt-2 text-[15px] font-semibold text-danger">
          {message}
        </p>
      ) : null}
      {roleMessage ? (
        <p role="alert" className="mt-2 text-[15px] font-semibold text-danger">
          {roleMessage}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmingDeactivate}
        title={`Deactivate ${account.name}?`}
        description="They won't be able to sign in until you reactivate their account."
        confirmLabel="Deactivate"
        danger
        busy={busy}
        onConfirm={deactivate}
        onCancel={() => setConfirmingDeactivate(false)}
      />
    </li>
  );
}

function ChildRow({
  child,
  accounts,
  onRenameChild,
  onLinkParent,
}: {
  child: AdminProps["children"][number];
  accounts: Account[];
  onRenameChild: AdminProps["onRenameChild"];
  onLinkParent: AdminProps["onLinkParent"];
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(child.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [linkToAdd, setLinkToAdd] = useState("");
  const [linkBusy, setLinkBusy] = useState<string | null>(null);

  const linkedParents = accounts.filter((account) => child.parentIds.includes(account.id));
  const availableParents = accounts.filter(
    (account) =>
      account.role === "parent" &&
      account.status === "active" &&
      !child.parentIds.includes(account.id),
  );

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setMessage(undefined);
    const result = await onRenameChild(child.id, name.trim());
    setBusy(false);
    if (result.ok) setRenaming(false);
    else setMessage(result.message);
  }

  async function toggleLink(accountId: string, linked: boolean) {
    setLinkBusy(accountId);
    const result = await onLinkParent(child.id, accountId, linked);
    setLinkBusy(null);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <li className="py-3">
      {renaming ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextField
            label="Child's name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button variant="primary" busy={busy} onClick={save}>
              Save
            </Button>
            <Button variant="secondary" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-bold text-text">{child.name}</p>
          <Button variant="quiet" onClick={() => setRenaming(true)}>
            Rename
          </Button>
        </div>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {linkedParents.map((parent) => (
          <li key={parent.id} className="flex items-center justify-between text-[15px] text-text">
            {parent.name} · {parent.email}
            <Button
              variant="quiet"
              busy={linkBusy === parent.id}
              onClick={() => toggleLink(parent.id, false)}
            >
              Unlink
            </Button>
          </li>
        ))}
      </ul>
      {availableParents.length > 0 ? (
        <div className="mt-2 flex gap-2">
          <Select
            label="Link a parent"
            className="flex-1"
            value={linkToAdd}
            onChange={setLinkToAdd}
            placeholder="Choose a parent account"
            options={availableParents.map((account) => ({ value: account.id, label: `${account.name} · ${account.email}` }))}
          />
          <Button
            variant="secondary"
            className="self-end"
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
    </li>
  );
}

function HomeRow({
  home,
  accounts,
  timeZones,
  onUpdateHome,
  onLinkHost,
}: {
  home: AdminProps["homes"][number];
  accounts: Account[];
  timeZones: string[];
  onUpdateHome: AdminProps["onUpdateHome"];
  onLinkHost: AdminProps["onLinkHost"];
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
    <li className="py-3">
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[17px] font-bold text-text">{home.name}</p>
            <p className="text-[15px] text-muted">
              {home.address ? `${home.address} · ` : ""}
              {home.timeZone}
            </p>
          </div>
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {linkedHosts.map((host) => (
          <li key={host.id} className="flex items-center justify-between text-[15px] text-text">
            {host.name} · {host.email}
            <Button variant="quiet" busy={linkBusy === host.id} onClick={() => toggleLink(host.id, false)}>
              Unlink
            </Button>
          </li>
        ))}
      </ul>
      {availableHosts.length > 0 ? (
        <div className="mt-2 flex gap-2">
          <Select
            label="Link a host"
            className="flex-1"
            value={linkToAdd}
            onChange={setLinkToAdd}
            placeholder="Choose a host account"
            options={availableHosts.map((account) => ({ value: account.id, label: `${account.name} · ${account.email}` }))}
          />
          <Button
            variant="secondary"
            className="self-end"
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
    </li>
  );
}

export function Admin({
  accounts,
  joinCodeSet,
  children,
  homes,
  timeZones,
  onApprove,
  onDecline,
  onSetJoinCode,
  onDeactivate,
  onReactivate,
  onSetRole,
  onRenameChild,
  onUpdateHome,
  onLinkParent,
  onLinkHost,
}: AdminProps) {
  const waiting = accounts.filter((account) => account.status === "waiting");

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Admin</p>

      {waiting.length > 0 ? (
        <>
          <Banner variant="attention" title={`${waiting.length} account${waiting.length === 1 ? "" : "s"} waiting`}>
            Approve or decline them below.
          </Banner>
          <div className="flex flex-col gap-3">
            {waiting.map((account) => (
              <WaitingCard key={account.id} account={account} onApprove={onApprove} onDecline={onDecline} />
            ))}
          </div>
        </>
      ) : null}

      <JoinCodeCard joinCodeSet={joinCodeSet} onSetJoinCode={onSetJoinCode} />

      <Card>
        <p className="text-[16px] font-bold text-text">Accounts</p>
        {accounts.length === 0 ? (
          <p className="mt-2 text-[17px] text-muted">No accounts yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onDeactivate={onDeactivate}
                onReactivate={onReactivate}
                onSetRole={onSetRole}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="text-[16px] font-bold text-text">Children</p>
        {children.length === 0 ? (
          <p className="mt-2 text-[17px] text-muted">No children yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {children.map((child) => (
              <ChildRow
                key={child.id}
                child={child}
                accounts={accounts}
                onRenameChild={onRenameChild}
                onLinkParent={onLinkParent}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="text-[16px] font-bold text-text">Homes</p>
        {homes.length === 0 ? (
          <p className="mt-2 text-[17px] text-muted">No homes yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {homes.map((home) => (
              <HomeRow
                key={home.id}
                home={home}
                accounts={accounts}
                timeZones={timeZones}
                onUpdateHome={onUpdateHome}
                onLinkHost={onLinkHost}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
