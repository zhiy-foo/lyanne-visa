## MODIFIED Requirements

### Requirement: The keepalive reaches the database and reports honestly
An authorised call SHALL make one write that Postgres accepts and records, so the
hosting provider counts it as database activity. The write SHALL be authorised by
the deployment's cron secret, which the endpoint presents to the database. The
call SHALL return no family data and SHALL report any failure, including the
database refusing the secret, with a non-success status so it shows in the cron
logs. A refusal by the database SHALL NOT be treated as success.

#### Scenario: Database reached
- **WHEN** an authorised call completes its write
- **THEN** the response is 200 with `{ "ok": true, "last_ping_at": <time>, "previous_ping_at": <time or null> }` and nothing else

#### Scenario: Failure responses carry no times
- **WHEN** the call is refused (401) or the write fails (500)
- **THEN** the body is `{ "ok": false }` with no heartbeat times

#### Scenario: Database unreachable or erroring
- **WHEN** the write fails for any reason
- **THEN** the response is 500 so the cron run is shown as failed

#### Scenario: Database refuses the secret
- **WHEN** the database refuses the write because the presented secret does not match the one it holds, or it holds none
- **THEN** the response is 500, not 200, and the secret does not appear in any log

#### Scenario: Permission refusal is a failure
- **WHEN** the database refuses the write with a permission-denied error
- **THEN** the response is 500, not 200

## ADDED Requirements

### Requirement: Each successful run is visible
Every successful keepalive run SHALL leave a durable record that the project owner
can inspect: the time of the latest heartbeat, the time of the one before it, and a running count of heartbeats,
readable by the owner in the database dashboard and not readable by any app user or
anonymous caller. A successful run SHALL also write a log line stating success and
the heartbeat time.

#### Scenario: Latest heartbeat advances
- **WHEN** an authorised call succeeds and an earlier heartbeat exists
- **THEN** the latest time is set to the current time, the previous time takes the old latest time, and the count increases by one

#### Scenario: First successful run
- **WHEN** the first authorised call succeeds
- **THEN** the latest time is set to the current time, the previous time stays empty, and the count is 1

#### Scenario: Nothing recorded before the first run
- **WHEN** no authorised call has yet succeeded
- **THEN** the record shows no latest time, no previous time, and a count of 0

#### Scenario: Heartbeat is not exposed to app users
- **WHEN** an anonymous or signed-in caller tries to read or change the heartbeat record directly
- **THEN** the database refuses the request

#### Scenario: Failed run leaves the record untouched
- **WHEN** an authorised call fails before the write is accepted
- **THEN** the recorded times and count are unchanged and no success log line is written

### Requirement: Heartbeats cannot be forged
The database SHALL record a heartbeat only for a caller that presents the correct
cron secret, even though the caller holds the app's public key. The database SHALL
hold only a one-way hash of the secret, never the secret itself.

#### Scenario: Call without the correct secret is refused and writes nothing
- **WHEN** a caller with only the public key invokes the heartbeat with a wrong secret
- **THEN** the database refuses with an authorisation error, the recorded times and count are unchanged, and the refusal does not echo the secret

#### Scenario: Empty or missing secret is refused
- **WHEN** a caller invokes the heartbeat with an empty or absent secret
- **THEN** the database refuses and writes nothing

#### Scenario: No secret hash configured refuses every call
- **WHEN** the owner has not yet stored the secret's hash
- **THEN** every call is refused and writes nothing, so a missed setup step shows as failed cron runs

#### Scenario: Rotated secret needs the hash updated
- **WHEN** the cron secret is changed but the stored hash is not
- **THEN** calls with the new secret are refused until the owner stores the new hash
