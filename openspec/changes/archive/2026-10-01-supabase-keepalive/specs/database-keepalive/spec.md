# Spec Delta

## Purpose

Keeps the hosted database from pausing through inactivity, without opening any
new way to read family data.

## ADDED Requirements

### Requirement: Only the scheduler may trigger the keepalive
The keepalive endpoint SHALL answer only callers that present the deployment's
cron secret as a Bearer token, and SHALL refuse every caller when no secret is
configured.

#### Scenario: Correct secret is accepted
- **WHEN** the scheduler calls the endpoint with `Authorization: Bearer <CRON_SECRET>`
- **THEN** the request is processed

#### Scenario: Missing or wrong secret is refused
- **WHEN** a caller sends no `Authorization` header, or a different value
- **THEN** the response is 401 and the database is not contacted

#### Scenario: No secret configured never opens the endpoint
- **WHEN** `CRON_SECRET` is unset on the deployment
- **THEN** every call, including one sending an empty or "Bearer undefined" token, gets 401

### Requirement: The keepalive reaches the database and reports honestly
An authorised call SHALL make one cheap read that reaches the database, return
no family data, and report failure with a non-success status so it shows in the
cron logs.

#### Scenario: Database reached
- **WHEN** an authorised call completes its read
- **THEN** the response is 200 with `{ "ok": true }` and nothing else

#### Scenario: Database unreachable or erroring
- **WHEN** the read fails for any reason other than the expected access refusal
- **THEN** the response is 500 so the cron run is shown as failed

### Requirement: The endpoint is not behind sign-in
The endpoint SHALL be reachable by the scheduler without a signed-in session.

#### Scenario: Scheduler is not redirected
- **WHEN** the scheduler calls the endpoint with no session cookie
- **THEN** it is not redirected to the sign-in page
