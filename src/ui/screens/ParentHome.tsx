"use client";

import { useState } from "react";
import type { ParentHomeProps } from "../types";
import { Card } from "../Card";
import { Button } from "../Button";
import { TextField } from "../TextField";
import { runAction } from "../runAction";

type ChildCardProps = {
  child: ParentHomeProps["children"][number];
  onRenameChild: ParentHomeProps["onRenameChild"];
  onAddCoParent: ParentHomeProps["onAddCoParent"];
  onRemoveParent: ParentHomeProps["onRemoveParent"];
};

function ChildCard({ child, onRenameChild, onAddCoParent, onRemoveParent }: ChildCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(child.name);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameMessage, setRenameMessage] = useState<string | undefined>(undefined);

  const [addingParent, setAddingParent] = useState(false);
  const [coParentEmail, setCoParentEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState<string | undefined>(undefined);

  const [removeMessage, setRemoveMessage] = useState<string | undefined>(undefined);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function saveRename() {
    if (!name.trim()) return;
    setRenameBusy(true);
    setRenameMessage(undefined);
    const result = await runAction(() => onRenameChild(child.id, name.trim()));
    setRenameBusy(false);
    if (result.ok) {
      setRenaming(false);
    } else {
      setRenameMessage(result.message);
    }
  }

  async function addCoParent() {
    if (!coParentEmail.trim()) return;
    setAddBusy(true);
    setAddMessage(undefined);
    const result = await runAction(() => onAddCoParent(child.id, coParentEmail.trim()));
    setAddBusy(false);
    if (result.ok) {
      setCoParentEmail("");
      setAddingParent(false);
    } else {
      setAddMessage(result.message);
    }
  }

  async function removeParent(memberId: string) {
    setRemovingId(memberId);
    setRemoveMessage(undefined);
    const result = await runAction(() => onRemoveParent(child.id, memberId));
    setRemovingId(null);
    if (!result.ok) {
      setRemoveMessage(result.message);
    }
  }

  return (
    <Card>
      {renaming ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Child's name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            errorText={renameMessage}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button variant="primary" busy={renameBusy} onClick={saveRename}>
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setRenaming(false);
                setName(child.name);
                setRenameMessage(undefined);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 break-words font-display text-[24px] font-semibold text-text">
            {child.name}
          </p>
          <Button variant="quiet" onClick={() => setRenaming(true)}>
            Rename
          </Button>
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {child.parents.map((parent) => (
          <li key={parent.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1 break-words text-[17px] text-text">
              {parent.name} <span className="text-muted">· {parent.email}</span>
            </span>
            <Button
              variant="quiet"
              className="shrink-0"
              busy={removingId === parent.id}
              onClick={() => removeParent(parent.id)}
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

      {addingParent ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Co-parent's email"
            type="email"
            value={coParentEmail}
            onChange={(event) => setCoParentEmail(event.target.value)}
            errorText={addMessage}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button variant="primary" busy={addBusy} onClick={addCoParent}>
              Add
            </Button>
            <Button variant="secondary" onClick={() => setAddingParent(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="mt-4" onClick={() => setAddingParent(true)}>
          Add co-parent
        </Button>
      )}
    </Card>
  );
}

export function ParentHome({
  me,
  children,
  homes,
  onAddChild,
  onRenameChild,
  onAddCoParent,
  onRemoveParent,
}: ParentHomeProps) {
  const [newChildName, setNewChildName] = useState("");
  const [addChildBusy, setAddChildBusy] = useState(false);
  const [addChildMessage, setAddChildMessage] = useState<string | undefined>(undefined);

  async function addChild() {
    if (!newChildName.trim()) return;
    setAddChildBusy(true);
    setAddChildMessage(undefined);
    const result = await runAction(() => onAddChild(newChildName.trim()));
    setAddChildBusy(false);
    if (result.ok) {
      setNewChildName("");
    } else {
      setAddChildMessage(result.message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Hi {me.name}</p>

      {children.length === 0 ? (
        <Card letterhead className="text-center">
          <p className="font-display text-[24px] font-semibold text-text">Add your child</p>
          <p className="mt-2 text-[17px] text-muted">
            Add your child so you can start planning their stays.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-center">
            <TextField
              label="Child's name"
              value={newChildName}
              onChange={(event) => setNewChildName(event.target.value)}
              errorText={addChildMessage}
              className="sm:w-64"
            />
            <Button variant="primary" busy={addChildBusy} onClick={addChild}>
              Add child
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {children.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              onRenameChild={onRenameChild}
              onAddCoParent={onAddCoParent}
              onRemoveParent={onRemoveParent}
            />
          ))}

          <Card>
            <p className="text-[16px] font-bold text-text">Add another child</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <TextField
                label="Child's name"
                value={newChildName}
                onChange={(event) => setNewChildName(event.target.value)}
                errorText={addChildMessage}
                className="flex-1"
              />
              <Button variant="primary" busy={addChildBusy} onClick={addChild}>
                Add child
              </Button>
            </div>
          </Card>
        </>
      )}

      {homes.length > 0 ? (
        <Card>
          <p className="text-[16px] font-bold text-text">Homes</p>
          <ul className="mt-2 flex flex-col gap-1">
            {homes.map((home) => (
              <li key={home.id} className="text-[17px] text-text">
                {home.name} <span className="text-muted">· {home.timeZone}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
