# email-delivery Specification

## Purpose
Tells the right people, by email, when it is their turn to answer a stayover
request and keeps their calendars showing the true agreed dates — without ever
blocking or risking the stayover action that triggered it.

## Requirements

### Requirement: A turn notice follows a move
Whenever a move changes whose answer is awaited, the system SHALL email every
active member on the side now awaited, describing who asked for what and any
note left, with a link to the application. Moves that do not change whose answer
is awaited, or that close the application, SHALL notify the side that just acted
instead, per the outcome (declined, or cancelled).

#### Scenario: A parent's proposal notifies the hosts
- **WHEN** a parent opens an application or proposes new dates on one
- **THEN** every active host of that place is emailed that their answer is needed

#### Scenario: A host's counter-proposal notifies the parents
- **WHEN** a host proposes different dates on an application awaiting their answer
- **THEN** every active guardian of that child is emailed that their answer is needed

#### Scenario: A decline notifies the side that proposed
- **WHEN** a host rejects a parent's opening proposal with no prior agreement
- **THEN** the parents are emailed that the request was declined

#### Scenario: A cancellation notifies the other side
- **WHEN** either side cancels an application
- **THEN** every active member on the other side is emailed that it was cancelled

### Requirement: Calendar invites follow the agreed dates only
Whenever a move sets or changes an application's agreed dates, the system SHALL
send every active participant an calendar invite for those dates. Whenever a
confirmed application is cancelled, the system SHALL send every active
participant a calendar cancellation. Proposals that do not change the agreed
dates SHALL NOT send any calendar message.

#### Scenario: First agreement sends an invite
- **WHEN** an application is confirmed for the first time
- **THEN** every active guardian of the child and host of the place receives a calendar invite for those dates

#### Scenario: Agreeing to a change sends an updated invite
- **WHEN** a confirmed application's dates are changed by a later agreement
- **THEN** every active participant receives an updated invite for the new dates, replacing the earlier one in their own calendar rather than adding a second entry

#### Scenario: A proposal under negotiation sends no invite
- **WHEN** either side proposes dates that have not yet been accepted
- **THEN** no calendar message is sent

#### Scenario: Cancelling a confirmed stay sends a cancellation
- **WHEN** a confirmed application is cancelled
- **THEN** every active participant receives a calendar cancellation for that stay

### Requirement: A withdrawn request notifies the hosts
When a parent permanently deletes an unanswered application, the system SHALL
email every active host of that place that the request was withdrawn, naming
the child and the dates that had been proposed.

#### Scenario: Hard delete notifies the hosts
- **WHEN** a parent deletes an application no host has responded to
- **THEN** every active host of that place is emailed that the request was withdrawn

### Requirement: The admin is told about a new waiting account
When a person registers without the family join code, the system SHALL email
the admin that a new account is waiting for approval, naming the person and
their chosen role.

#### Scenario: Registration without a code notifies the admin
- **WHEN** a person registers as a parent or host without the family join code
- **THEN** the admin is emailed that a new account is waiting

#### Scenario: Registration with the code sends no admin notice
- **WHEN** a person registers with the correct join code
- **THEN** the admin receives no waiting-account notice for them

### Requirement: Delivery never blocks or undoes the action that triggered it
The system SHALL durably record every stayover action (move, delete,
registration) before attempting any delivery for it, and a delivery failure of
any kind SHALL NOT undo, retry, or block that action.

#### Scenario: A move succeeds even if every delivery attempt fails
- **WHEN** a host accepts an application and every attempt to email or invite participants fails
- **THEN** the application is still confirmed exactly as accepted

### Requirement: Bounded retry, then a recorded failure
Each planned delivery SHALL be attempted at most four times in total (one send
and up to three retries with backoff); once the fourth attempt fails, the
delivery SHALL be marked failed and SHALL NOT be attempted again automatically.
An invite for an application SHALL be dropped, not sent, if a later revision for
that same application has already been dispatched.

#### Scenario: Persistent failure stops after four attempts
- **WHEN** every attempt to deliver a message fails
- **THEN** after the fourth attempt it is recorded as failed and no further automatic attempt is made

#### Scenario: A stale retry is superseded
- **WHEN** an invite for an application's earlier revision is still pending retry after a newer revision has already been sent
- **THEN** the stale invite is not sent

### Requirement: Every attempted delivery is recorded
The system SHALL keep an auditable record of every delivery attempted: who it
was for, what kind it was, which application (if any) and revision it concerns,
how many attempts were made, and its current status.

#### Scenario: A successful send is recorded
- **WHEN** a notice or invite is sent successfully
- **THEN** its record shows the recipient, kind, revision and a sent status

#### Scenario: A failed delivery is recorded with its error
- **WHEN** a delivery exhausts its retries
- **THEN** its record shows a failed status and the last error encountered

### Requirement: Nobody outside the application's participants is emailed
The system SHALL send notices and invites only to active members who are
guardians of the application's child or hosts of its place (participants), or,
for a waiting-account notice, only to the admin. No one else SHALL ever be
emailed about an application or account they have no connection to.

#### Scenario: An uninvolved member receives nothing
- **WHEN** an application's dates are confirmed
- **THEN** members who are neither guardians of its child nor hosts of its place receive no notice or invite about it

#### Scenario: A deactivated participant receives nothing
- **WHEN** a participant's account is deactivated before a delivery for that application is sent
- **THEN** they receive no further notice or invite

### Requirement: Admin can review recent failed deliveries
The system SHALL let the admin see a list of recently failed deliveries,
including their kind, intended recipient, and last error, without seeing SMTP
credentials or other server configuration.

#### Scenario: Admin views failed deliveries
- **WHEN** the admin opens the failed-deliveries view
- **THEN** they see each recent failure's kind, recipient and last error

#### Scenario: Non-admin cannot view failed deliveries
- **WHEN** a parent or host requests the failed-deliveries view or its data directly
- **THEN** the request is refused
