"use client";

import { useState } from "react";
import type { AdminAccountsProps, Side } from "../types";
import { Card } from "../Card";
import { Banner } from "../Banner";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Select } from "../Select";
import { Badge } from "../Badge";
import { ConfirmDialog } from "../ConfirmDialog";

type Account = AdminAccountsProps["accounts"][number];

const LINKED_ROLE_HINT = "Unlink from children/homes to change role";

function statusBadge(status: Account["status"]) {
  if (status === "active") return <Badge variant="confirmed" icon="✓" label="Active" />;
  if (status === "waiting") return <Badge variant="attention" icon="!" label="Waiting" />;
  return <Badge variant="neutral" icon="–" label="Deactivated" />;
}

function isLinked(account: Account) {
  return account.childIds.length > 0 || account.homeIds.length > 0;
}

function WaitingCard({
  account,
  onApprove,
  onDecline,
}: {
  account: Account;
  onApprove: AdminAccountsProps["onApprove"];
  onDecline: AdminAccountsProps["onDecline"];
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
        <div className="min-w-0">
          <p className="break-words text-[17px] font-bold text-text">{account.name}</p>
          <p className="break-words text-[15px] text-muted">
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
  onSetJoinCode: AdminAccountsProps["onSetJoinCode"];
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
  onApprove,
  onDecline,
  onDeactivate,
  onReactivate,
  onSetRole,
}: {
  account: Account;
  onApprove: AdminAccountsProps["onApprove"];
  onDecline: AdminAccountsProps["onDecline"];
  onDeactivate: AdminAccountsProps["onDeactivate"];
  onReactivate: AdminAccountsProps["onReactivate"];
  onSetRole: AdminAccountsProps["onSetRole"];
}) {
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [roleMessage, setRoleMessage] = useState<string | undefined>(undefined);
  const [roleBusy, setRoleBusy] = useState(false);
  const [waitingBusy, setWaitingBusy] = useState<"approve" | "decline" | null>(null);

  async function approve() {
    setWaitingBusy("approve");
    setMessage(undefined);
    const result = await onApprove(account.id);
    setWaitingBusy(null);
    if (!result.ok) setMessage(result.message);
  }

  async function decline() {
    setWaitingBusy("decline");
    setMessage(undefined);
    const result = await onDecline(account.id);
    setWaitingBusy(null);
    if (!result.ok) setMessage(result.message);
  }

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

  const linked = isLinked(account);

  return (
    <li className={["py-3", account.status === "deactivated" ? "opacity-60" : ""].join(" ")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[17px] font-bold text-text">{account.name}</p>
          <p className="break-words text-[15px] text-muted">{account.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {statusBadge(account.status)}
            {account.status !== "deactivated" && !linked ? (
              <Badge variant="neutral" icon="＋" label="New — not linked to anyone yet" />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {account.status === "deactivated" ? (
            <span className="text-[15px] text-muted">
              {account.role === "parent" ? "Parent" : "Host"}
            </span>
          ) : (
            <Select
              label="Role"
              className="w-36"
              value={account.role}
              onChange={(value) => changeRole(value as Side)}
              options={[
                { value: "parent", label: "Parent" },
                { value: "host", label: "Host" },
              ]}
              disabled={linked || roleBusy}
              helperText={linked ? LINKED_ROLE_HINT : undefined}
            />
          )}
          {account.status === "waiting" ? (
            <>
              <Button variant="primary" busy={waitingBusy === "approve"} onClick={approve}>
                Approve
              </Button>
              <Button variant="danger" busy={waitingBusy === "decline"} onClick={decline}>
                Decline
              </Button>
            </>
          ) : account.status === "deactivated" ? (
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

export function AdminAccounts({
  accounts,
  joinCodeSet,
  onApprove,
  onDecline,
  onSetJoinCode,
  onDeactivate,
  onReactivate,
  onSetRole,
}: AdminAccountsProps) {
  const waiting = accounts.filter((account) => account.status === "waiting");

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Accounts</p>

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
                onApprove={onApprove}
                onDecline={onDecline}
                onDeactivate={onDeactivate}
                onReactivate={onReactivate}
                onSetRole={onSetRole}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
