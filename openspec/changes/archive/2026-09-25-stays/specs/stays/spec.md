# Spec Delta

## Purpose

Lets a parent ask for a child to stay at a host's home over a date range, lets
either side propose, accept, reject or cancel until both agree, and shows both
sides plainly what is happening and what they may do next.

## ADDED Requirements

### Requirement: Parents open an application
The system SHALL let an active parent who is a guardian of a child open a new
application for that child at a home by proposing a date range (a drop-off day
before a pick-up day) and an optional note. Opening an application SHALL create
its first move as a proposal made by the parent's side.

#### Scenario: Parent opens an application
- **WHEN** a parent proposes Lyanne stay at Grandma & Grandpa's from Sat 3 Oct to Tue 6 Oct
- **THEN** a new application exists for Lyanne at that home, awaiting the hosts' answer

#### Scenario: A host cannot open an application
- **WHEN** a host tries to open a new application
- **THEN** the request is refused

#### Scenario: Invalid date range is refused
- **WHEN** a parent proposes a pick-up day on or before the drop-off day
- **THEN** no application is created and they are told the pick-up day must be after the drop-off day

### Requirement: Either side may propose, accept, reject or cancel
The system SHALL let the side whose turn it is act on an open application: accept
the other side's proposed dates, reject it, or propose different dates (a
counter-proposal). Either side, at any time before the application reaches a
terminal state, SHALL be able to cancel it. The system SHALL refuse an accept or
reject from the side that made the open proposal, and SHALL refuse any move once
the application is declined or cancelled.

#### Scenario: Host accepts the parent's proposed dates
- **WHEN** a host accepts an application's open, unanswered proposal
- **THEN** the application is confirmed for those dates

#### Scenario: Host suggests other dates
- **WHEN** a host proposes different dates on an application awaiting their answer
- **THEN** the application now awaits the parent's answer to the new dates, and the previous proposal no longer stands

#### Scenario: A side cannot accept its own proposal
- **WHEN** the side that made the open proposal tries to accept it
- **THEN** the request is refused

#### Scenario: Either side cancels a confirmed stay
- **WHEN** a parent or a host cancels an application that was confirmed
- **THEN** the application is cancelled and its dates are no longer agreed

#### Scenario: No move on a closed application
- **WHEN** anyone tries to propose, accept or reject on an application that is declined or cancelled
- **THEN** the request is refused

### Requirement: Status, turn and agreed dates are deduced
The system SHALL determine an application's status (negotiating, confirmed,
declined or cancelled), whose turn it is to answer (if anyone's), and its
currently agreed dates (if any) entirely from the history of moves made on it,
never from a separately stored value.

#### Scenario: Confirmed application keeps its agreed dates through a pending change
- **WHEN** one side proposes new dates on an application that already has agreed dates
- **THEN** the application still shows confirmed with its previous agreed dates, and separately shows the newly proposed dates awaiting an answer

#### Scenario: Rejecting a proposed change keeps the earlier agreement
- **WHEN** the other side rejects a proposed change to a confirmed application
- **THEN** the application remains confirmed with its dates unchanged

#### Scenario: First rejection with no prior agreement closes the application
- **WHEN** a host rejects the parent's opening proposal before any agreement was reached
- **THEN** the application is declined and no further moves are accepted on it

### Requirement: An application never double-books a child
The system SHALL refuse to accept dates for a child that overlap any other
application's currently agreed dates for that same child.

#### Scenario: Overlapping accept is refused
- **WHEN** a host tries to accept dates for a child that overlap that child's other confirmed stay
- **THEN** the accept is refused and the application's status is unchanged

#### Scenario: Non-overlapping accept succeeds
- **WHEN** a host accepts dates for a child that do not overlap any of that child's other confirmed stays
- **THEN** the application is confirmed

### Requirement: Optional home capacity
The system SHALL let a home's hosts, or the admin, set how many children the home
can host at once, leaving it unset for no limit. The system SHALL refuse to
confirm dates that would put more children with agreed stays at that home on any
single night than its capacity allows, and SHALL warn a parent proposing dates
that include a night the home is already full on.

#### Scenario: Host sets a capacity
- **WHEN** a host sets their home's capacity to 2 children
- **THEN** future accepts at that home are limited by that number

#### Scenario: Accept exceeding capacity is refused
- **WHEN** a host tries to accept dates that would bring a night's count of children with agreed stays at that home above its capacity
- **THEN** the accept is refused and the application's status is unchanged

#### Scenario: Parent is warned proposing dates on a full night
- **WHEN** a parent proposes dates that include a night the home's capacity is already reached on
- **THEN** they see a warning before submitting, and may still submit the proposal

#### Scenario: No capacity set means no limit
- **WHEN** a home's capacity is left blank
- **THEN** accepts at that home are never refused for capacity

### Requirement: Hard delete only while unanswered
The system SHALL let a parent permanently delete an application only while every
move on it was made by the parents' side (no host has responded), removing the
application and its history. Once any host has responded, "delete" SHALL only be
available as a cancel, which keeps the history.

#### Scenario: Parent deletes an unanswered application
- **WHEN** a parent deletes an application no host has moved on
- **THEN** the application and its history are permanently removed

#### Scenario: Parent cannot hard-delete an answered application
- **WHEN** a parent tries to permanently delete an application a host has already responded to
- **THEN** the request is refused and they are told to cancel it instead

#### Scenario: A host can never hard-delete
- **WHEN** a host tries to permanently delete any application
- **THEN** the request is refused

### Requirement: Application visibility is by side
The system SHALL let a member read an application, its moves and its status only
if they are a guardian of its child or a host of its place; nobody else may read
it. The admin SHALL be able to read every application but SHALL NOT be able to
propose, accept, reject or cancel on one.

#### Scenario: An uninvolved member cannot read an application
- **WHEN** a member who is neither a guardian of the child nor a host of the place requests an application directly with their own credentials
- **THEN** nothing is returned

#### Scenario: Admin reads but does not act
- **WHEN** the admin opens an application or calls a move directly
- **THEN** they can see its details, but any attempt to move on it is refused

### Requirement: Hosts see children and parents see addresses through applications
The system SHALL let a host who is not a guardian of a child see that child's
existence and name once an application links that child to a home the host hosts.
The system SHALL let a parent see a home's address once they have applied there,
in addition to hosts and the admin, who already see it.

#### Scenario: Host sees the child once an application exists
- **WHEN** a parent opens an application for their child at a host's home
- **THEN** that host can now see the child's name in connection with the application

#### Scenario: Parent sees the address after applying
- **WHEN** a parent's application to a home is created
- **THEN** that parent can now see the home's address

#### Scenario: No application means no visibility
- **WHEN** a host has no application linking them to a child
- **THEN** they cannot see that child's name

### Requirement: Overview shows what needs the viewer's attention
The system SHALL show a signed-in parent or host, on their landing page, a
greeting, an attention banner naming how many stays need their answer (only when
at least one does), and a month calendar in which each day of a stay is marked
confirmed or not-yet-agreed, with the currently open stay's days visually
distinguished. Selecting a marked day SHALL open that stay's detail.

#### Scenario: Nothing awaiting the viewer
- **WHEN** a member with no application awaiting their answer opens their overview
- **THEN** no attention banner is shown

#### Scenario: One stay awaiting the viewer
- **WHEN** a member has exactly one application awaiting their answer
- **THEN** the attention banner names it and points them to it

### Requirement: Applications list is grouped by what the viewer must do
The system SHALL show every application the viewer may see, grouped into those
needing the viewer's answer, upcoming confirmed stays, and past or closed
applications.

#### Scenario: No applications yet
- **WHEN** a parent with no applications opens the applications list
- **THEN** they see an invitation to plan a stay

#### Scenario: Applications sorted into their groups
- **WHEN** a member has one application awaiting their answer, one confirmed upcoming stay, and one declined application
- **THEN** each appears in its matching group

### Requirement: Application detail shows status, dates and history plainly
The system SHALL show, for a single application the viewer may see: its status in
plain words, its agreed dates and any separately proposed dates, a timeline of its
history in plain language, and only the actions the viewer's side may currently
take, each requiring confirmation for reject, cancel or delete.

#### Scenario: Viewer sees only actions they may take
- **WHEN** a parent opens an application awaiting the host's answer
- **THEN** they see it is waiting on the host and cannot accept or reject it themselves

#### Scenario: Confirmed with a pending change is shown distinctly
- **WHEN** an application is confirmed and a change has been proposed
- **THEN** the viewer sees both the confirmed dates and the proposed change, and which one is which

### Requirement: Stayover events are emitted for delivery
The system SHALL emit an event after each move is durably recorded (carrying the
application, the move, and the status before and after) and after a hard delete
(carrying enough of the deleted application's facts — child, place, hosts and
dates — to notify them), for another part of the system to act on. Emitting this
event SHALL NOT block or fail the move or the delete that triggered it.

#### Scenario: A confirming accept emits an event
- **WHEN** a host's accept confirms an application
- **THEN** an event carrying the application, the accept move, and its before/after status is emitted after the accept is durably recorded

#### Scenario: A hard delete emits an event with a snapshot
- **WHEN** a parent hard-deletes an unanswered application
- **THEN** an event carrying the deleted application's child, place, hosts and dates is emitted, even though the application no longer exists to look up afterwards
