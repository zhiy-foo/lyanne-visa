"use client";

import { useState } from "react";
import type { AdminChildrenProps } from "../types";
import { Card } from "../Card";
import { Collapsible } from "../Collapsible";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { Select } from "../Select";

type Account = AdminChildrenProps["accounts"][number];

function ChildCard({
  child,
  accounts,
  defaultOpen,
  onRenameChild,
  onLinkParent,
}: {
  child: AdminChildrenProps["children"][number];
  accounts: Account[];
  defaultOpen: boolean;
  onRenameChild: AdminChildrenProps["onRenameChild"];
  onLinkParent: AdminChildrenProps["onLinkParent"];
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
    <Card>
      <Collapsible
        defaultOpen={defaultOpen}
        summary={
          <span className="min-w-0 flex-1 break-words">
            {child.name}
            <span className="ml-2 font-normal text-muted">
              {linkedParents.length} parent{linkedParents.length === 1 ? "" : "s"}
            </span>
          </span>
        }
      >
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
          <Button variant="quiet" onClick={() => setRenaming(true)}>
            Rename
          </Button>
        )}
        <ul className="mt-3 flex flex-col gap-1">
          {linkedParents.map((parent) => (
            <li
              key={parent.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[15px] text-text"
            >
              <span className="min-w-0 flex-1 break-words">
                {parent.name} · {parent.email}
              </span>
              <Button
                variant="quiet"
                className="shrink-0"
                busy={linkBusy === parent.id}
                onClick={() => toggleLink(parent.id, false)}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
        {availableParents.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Link a parent"
              className="w-full min-w-0 sm:flex-1"
              value={linkToAdd}
              onChange={setLinkToAdd}
              placeholder="Choose a parent account"
              options={availableParents.map((account) => ({ value: account.id, label: `${account.name} · ${account.email}` }))}
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

export function AdminChildren({ children, accounts, onRenameChild, onLinkParent }: AdminChildrenProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Children</p>

      {children.length === 0 ? (
        <Card>
          <p className="text-[17px] text-muted">No children yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              accounts={accounts}
              defaultOpen={false}
              onRenameChild={onRenameChild}
              onLinkParent={onLinkParent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
