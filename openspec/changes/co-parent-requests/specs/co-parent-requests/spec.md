# Spec Delta

## Purpose

Catches the same child being added twice by two different parents, by asking the
existing parent to confirm the requester as a co-parent instead of silently
creating a duplicate child, without ever revealing the existing parent's identity
to the requester before they consent.

## ADDED Requirements

### Requirement: Duplicate name detected on add-child

The system SHALL, when an active parent adds a child whose name matches
(case-insensitive, trimmed, internal whitespace collapsed to one space) one or
more existing children that parent is not already a parent of, create no new
child and instead open one pending co-parent request per matching child for that
parent. The requester SHALL be told that a child with that name may already be on
the app and that its parent has been asked to confirm them as co-parent, and SHALL
be offered the option to add the child as new anyway. The requester SHALL NOT be
told who the existing child's parents are, how many matches there were, or
anything else about the matched child or account.

#### Scenario: Second parent adds a same-named child

- **WHEN** parent "Dad2" adds a child named "lyanne " and a child "Lyanne" already
  exists with parent "Mum", who is not "Dad2"
- **THEN** no new child is created, a pending co-parent request from "Dad2" for
  "Lyanne" is opened, and "Dad2" sees "Lyanne may already be on the app — we've
  asked their parent to confirm you as co-parent" with an "add anyway" option, and
  is not told "Mum" is the parent

#### Scenario: No match, child is created as usual

- **WHEN** an active parent adds a child whose name matches none of their visible
  or invisible children
- **THEN** a new child is created with that parent as its only parent, exactly as
  before this change

#### Scenario: Adding a child you are already a parent of is not treated as a duplicate

- **WHEN** a parent adds a child whose name matches a child they are already a
  parent of
- **THEN** a new, separate child is created (matching only excludes children the
  requester already parents)

#### Scenario: Add-anyway creates the child regardless

- **WHEN** a parent whose add-child was turned into a pending request chooses
  "add anyway"
- **THEN** a new child is created with that name and that parent as its only
  parent, and any pending request(s) opened by the earlier add-child call for that
  parent are unaffected (they remain open until approved, declined or withdrawn)

#### Scenario: Waiting or deactivated member cannot add a child or trigger a request

- **WHEN** a member whose account is waiting or deactivated calls add-child,
  including by calling the data service directly
- **THEN** the request is refused, no child and no co-parent request are created

### Requirement: Existing parent approves or declines the request

The system SHALL show every approved parent of a matched child a pending request
naming the requester (name and email) and the child, with the options to approve
or decline it. Approving SHALL make the requester a parent of that child.
Declining SHALL close the request without linking the requester, and the requester
SHALL then see that their request was not approved, with the option to add the
child as new. A request SHALL only be actioned by an approved parent of the
matched child, or the admin.

#### Scenario: Parent approves a co-parent request

- **WHEN** "Mum", an approved parent of "Lyanne", approves "Dad2"'s pending
  request
- **THEN** "Dad2" becomes a parent of "Lyanne", the request is closed as
  approved, and "Dad2" sees "Lyanne" appear on their page

#### Scenario: Parent declines a co-parent request

- **WHEN** "Mum" declines "Dad2"'s pending request
- **THEN** the request is closed as declined, "Dad2" is not linked to "Lyanne",
  and "Dad2" sees the request was not approved with the option to add "Lyanne" as
  a new child

#### Scenario: Non-parent cannot approve or decline

- **WHEN** a member who is not an approved parent of the matched child, and is not
  the admin, calls approve or decline on the request directly with their own
  credentials
- **THEN** the request is refused and the request's state is unchanged

#### Scenario: A declined or withdrawn request cannot be approved

- **WHEN** anyone tries to approve a request that has already been declined,
  withdrawn or approved
- **THEN** the request is refused

### Requirement: Requester can withdraw a pending request

The system SHALL let the requester withdraw their own pending co-parent request.
A withdrawn request SHALL grant no link and SHALL NOT be shown to the matched
child's parents as pending any more.

#### Scenario: Requester withdraws before an answer

- **WHEN** "Dad2" withdraws their pending request for "Lyanne" before "Mum"
  answers it
- **THEN** the request is closed as withdrawn, "Dad2" is not linked to "Lyanne",
  and it no longer appears on "Mum"'s page

#### Scenario: Only the requester can withdraw

- **WHEN** someone other than the requester and not the admin tries to withdraw
  the request
- **THEN** the request is refused and remains pending

### Requirement: No duplicate pending requests

The system SHALL NOT create a second pending co-parent request for the same
requester and the same child while one is already pending.

#### Scenario: Requester adds the same-named child again while a request is pending

- **WHEN** "Dad2" already has a pending request for "Lyanne" and adds a child
  named "Lyanne" again
- **THEN** no second request is created; the existing pending request is
  reused/unaffected

### Requirement: Pending requests grant no visibility

The system SHALL treat a pending or closed (declined/withdrawn) co-parent request
as granting the requester no access to the matched child, its other parents'
identities, or anything reachable only through being that child's parent. Only an
approved link grants visibility, exactly as for any other parent link.

#### Scenario: Requester cannot see the matched child while pending

- **WHEN** "Dad2" has a pending request for "Lyanne" and requests "Lyanne"'s
  details, or the list of members connected to "Lyanne", directly with their own
  credentials
- **THEN** nothing about "Lyanne" or her existing parents is returned

#### Scenario: Requester cannot see the matched child's parents' emails while pending

- **WHEN** "Dad2" has a pending request and requests the email addresses visible
  to them
- **THEN** "Mum"'s email is not among them

### Requirement: Admin can merge two children

The system SHALL let the admin merge a source child into a target child: every
approved parent link on the source SHALL be added to the target (if not already
present), every pending request against the source SHALL be closed, and the
source child SHALL be removed. The system SHALL refuse the merge if the source and
target are the same child, or if either does not exist. Every child SHALL keep at
least one parent at every step (merging active parent links onto the target
already satisfies this; it can never make the target parentless).

#### Scenario: Admin merges a duplicate child

- **WHEN** the admin merges child "Lyanne (dup)" (parent "Dad3") into "Lyanne"
  (parent "Mum")
- **THEN** "Mum" and "Dad3" are both parents of "Lyanne", "Lyanne (dup)" no longer
  exists, and any pending requests against "Lyanne (dup)" are closed

#### Scenario: Merge into itself is refused

- **WHEN** the admin tries to merge a child into itself
- **THEN** the request is refused and nothing changes

#### Scenario: Non-admin cannot merge

- **WHEN** a parent, including a parent of either child, calls merge directly with
  their own credentials
- **THEN** the request is refused and neither child is changed

### Requirement: Existing email co-parent path is unaffected

The system SHALL continue to let a child's parent add another registered, active
parent account as co-parent by exact email address, without going through a
request, exactly as before this change.

#### Scenario: Adding a co-parent by email still links immediately

- **WHEN** "Mum", a parent of "Lyanne", adds "dad@example.com" (an active parent
  account) as a co-parent by email
- **THEN** that account becomes a parent of "Lyanne" immediately, with no pending
  request created
