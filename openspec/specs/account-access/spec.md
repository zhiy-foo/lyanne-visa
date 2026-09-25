# account-access Specification

## Purpose
Lets people get into the app with their own identity — by email link or Google —
register themselves as a parent or a host — at once with the family join code,
otherwise via a waiting list — and lets the admin account approve, oversee and
deactivate accounts.

## Requirements

### Requirement: Sign in with an email link
The system SHALL let a person sign in by entering their email address and opening
a one-time sign-in link sent to that address. A link SHALL work only once and only
until it expires.

#### Scenario: Valid link signs the person in
- **WHEN** a person requests a sign-in link for their address and opens it before it expires
- **THEN** they are signed in

#### Scenario: Used or expired link is refused
- **WHEN** a person opens a sign-in link that was already used or has expired
- **THEN** they are not signed in and see the sign-in page with a message explaining the link is no longer valid and offering to send a new one

### Requirement: Sign in with Google
The system SHALL let a person sign in with a Google account. It SHALL request only
the person's basic identity (name and email address) and no other Google data.

#### Scenario: Google sign-in succeeds
- **WHEN** a person chooses "Sign in with Google" and approves on Google's screen
- **THEN** they are signed in with the email address of that Google account

#### Scenario: Google sign-in is abandoned
- **WHEN** a person cancels or declines on Google's screen
- **THEN** they are returned to the sign-in page, not signed in, with a message that sign-in was cancelled

### Requirement: Registering an account with one role
The system SHALL ask a signed-in person who has no account, and is not the admin,
to register by choosing exactly one role — parent or host — a display name, and
optionally the family join code. With the correct code the account SHALL be usable
immediately; without a code it SHALL be placed on the waiting list. Each signed-in
identity SHALL have at most one account, and its role SHALL NOT be changeable by the
account holder.

#### Scenario: Person registers as a host with the join code
- **WHEN** a newly signed-in person chooses "Host", enters the name "Grandma" and the correct family join code
- **THEN** an active host account named "Grandma" exists and they land on their home page, prompted to add their home

#### Scenario: Person registers without a code
- **WHEN** a newly signed-in person chooses "Parent", enters a name and leaves the join code empty
- **THEN** a parent account exists on the waiting list and they see the "waiting for approval" page

#### Scenario: Wrong join code is refused
- **WHEN** a person enters an incorrect join code
- **THEN** no account is created and they are told the code is not right, with the options to try again or join the waiting list without a code

#### Scenario: Repeated wrong codes stop being checked
- **WHEN** the same person has entered 5 incorrect join codes
- **THEN** any further code they enter is not checked and they can only join the waiting list

#### Scenario: Registration without a name or role is refused
- **WHEN** a person submits the registration form with no role chosen or an empty name
- **THEN** no account is created and the form shows what is missing

#### Scenario: Registering twice is refused
- **WHEN** a person who already has an account tries to register again, by any means
- **THEN** no second account is created and their existing account is unchanged

### Requirement: The admin account
The system SHALL treat a signed-in person whose email address is on the
deployment's admin list (compared case-insensitively) as the admin. The admin SHALL
NOT have a parent or host account, SHALL see the admin area instead of the
registration page, and SHALL be able to view every account, child and home.

#### Scenario: Admin signs in
- **WHEN** the person signed in as "Lyanne.Stayovers@gmail.com" and that address is on the admin list
- **THEN** they see the admin area listing every account with its name, email, role, status and links

#### Scenario: Admin cannot register as parent or host
- **WHEN** the admin tries to register a parent or host account for their own sign-in
- **THEN** the request is refused and no account is created

#### Scenario: Non-admin cannot open the admin area
- **WHEN** a parent or host opens the admin area or calls an admin action directly
- **THEN** the request is refused and no account data beyond what they may already see is shown

### Requirement: Waiting list
The system SHALL show a person whose account is waiting a "waiting for approval"
page with sign-out, SHALL return no app data to them by any means, and SHALL let the
admin see the waiting accounts and approve (making them active) or decline (making
them deactivated) each one.

#### Scenario: Admin approves a waiting account
- **WHEN** the admin approves the waiting account "Dad"
- **THEN** Dad's account is active and on his next page load he sees his home page

#### Scenario: Admin declines a waiting account
- **WHEN** the admin declines the waiting account "Stranger"
- **THEN** the account is deactivated and that person sees the "account deactivated" page

#### Scenario: Waiting person calls the data service directly
- **WHEN** a person whose account is waiting requests homes, children or accounts directly with their own credentials
- **THEN** nothing is returned

#### Scenario: Waiting account cannot be found as a co-parent
- **WHEN** a parent enters the email of a waiting parent account as a co-parent
- **THEN** nothing changes and the message says there is no parent account with that email

### Requirement: Family join code
The system SHALL let the admin set, change or clear the family join code. The code
SHALL be stored only in a form that cannot be read back. Changing or clearing it
SHALL NOT affect existing accounts; while no code is set, every new registration
SHALL go to the waiting list.

#### Scenario: Admin changes the code
- **WHEN** the admin sets a new join code
- **THEN** the old code no longer activates new registrations and the new one does, and existing accounts are unchanged

#### Scenario: No code set
- **WHEN** no join code is set and a person registers entering any code
- **THEN** their account is placed on the waiting list

#### Scenario: Non-admin cannot change the code
- **WHEN** a parent or host tries to set the join code, including by calling the data service directly
- **THEN** the request is refused

### Requirement: Admin account management
The system SHALL let the admin deactivate and reactivate any account, and change an
account's role only while that account has no links to any child or home.

#### Scenario: Admin deactivates an account
- **WHEN** the admin deactivates the account "Stranger"
- **THEN** the account is marked deactivated and that person can no longer see or change anything

#### Scenario: Admin reactivates an account
- **WHEN** the admin reactivates a deactivated account
- **THEN** that person regains exactly the access their role and links give them

#### Scenario: Role change on a linked account is refused
- **WHEN** the admin tries to change the role of a parent who is linked to a child
- **THEN** the request is refused with a message that the account's links must be removed first

#### Scenario: Role change on an unlinked account succeeds
- **WHEN** the admin changes the role of a host who hosts no home to parent
- **THEN** the account's role is parent

### Requirement: Deactivated accounts see nothing
The system SHALL show a deactivated person who signs in a page saying their account
is deactivated, with sign-out, and SHALL return no app data to them by any means.

#### Scenario: Deactivated person signs in
- **WHEN** a deactivated person signs in
- **THEN** they see the "account deactivated" page

#### Scenario: Deactivated person calls the data service directly
- **WHEN** a deactivated person requests children, homes or accounts directly with their own credentials
- **THEN** nothing is returned

### Requirement: Pages require sign-in
The system SHALL require sign-in for every page except the sign-in page and the
sign-in link landing page, and SHALL let a signed-in person sign out.

#### Scenario: Signed-out visitor opens an app page
- **WHEN** a visitor who is not signed in opens an app page
- **THEN** they are sent to the sign-in page and, after signing in, returned to the page they asked for

#### Scenario: Signing out
- **WHEN** a signed-in person chooses sign out
- **THEN** their session ends and opening any app page sends them to the sign-in page
