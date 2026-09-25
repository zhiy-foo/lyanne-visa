# children-and-homes Specification

## Purpose
Lets parents record their children and hosts record their homes, link co-parents
and co-hosts, and keeps each person's view limited to the children, homes and
people they are connected to.

## Requirements

### Requirement: Parents add their children
The system SHALL let a parent add a child by name; the parent who adds the child
SHALL become one of its parents. Hosts SHALL NOT be able to add children.

#### Scenario: Parent adds a child
- **WHEN** parent "Mum" adds child "Lyanne"
- **THEN** "Lyanne" appears on Mum's page with Mum as her parent

#### Scenario: Host cannot add a child
- **WHEN** a host tries to add a child, including by calling the data service directly
- **THEN** the request is refused and no child is created

#### Scenario: Child without a name is refused
- **WHEN** a parent submits a child with an empty name
- **THEN** no child is created and a message asks for a name

### Requirement: Co-parents
The system SHALL let a parent of a child add another registered parent account as
that child's parent by entering its email address (case-insensitive), and remove a
co-parent link. A child SHALL always keep at least one parent.

#### Scenario: Parent adds a co-parent
- **WHEN** "Mum", a parent of "Lyanne", enters "dad@example.com", which belongs to the parent account "Dad"
- **THEN** Dad is also shown as Lyanne's parent, and Lyanne appears on Dad's page

#### Scenario: Email that is not a parent account is refused
- **WHEN** a parent enters an address that has no account, or belongs to a host account
- **THEN** nothing changes and a message says there is no parent account with that email

#### Scenario: Removing a child's last parent is refused
- **WHEN** anyone removes the only parent link of a child
- **THEN** the request is refused with a message that every child needs at least one parent

#### Scenario: Someone who is not the child's parent cannot link
- **WHEN** a parent who is not one of Lyanne's parents tries to add or remove Lyanne's parents
- **THEN** the request is refused

### Requirement: Hosts add their homes
The system SHALL let a host add a home with a name, an optional address and a time
zone chosen from the standard time-zone list; the host who adds it SHALL become
one of its hosts. Parents SHALL NOT be able to add homes.

#### Scenario: Host adds a home
- **WHEN** host "Grandma" adds home "Grandma & Grandpa's" with time zone "Asia/Singapore"
- **THEN** the home appears on Grandma's page with Grandma as its host

#### Scenario: Unknown time zone is refused
- **WHEN** a host submits a home with a time zone that is not in the standard list
- **THEN** the home is not saved and a message asks for a valid time zone

#### Scenario: Parent cannot add a home
- **WHEN** a parent tries to add a home, including by calling the data service directly
- **THEN** the request is refused and no home is created

### Requirement: Co-hosts and editing homes
The system SHALL let a host of a home edit its name, address and time zone, add
another registered host account as co-host by email (case-insensitive), and remove
a co-host link. A home SHALL always keep at least one host.

#### Scenario: Host adds a co-host
- **WHEN** "Grandma" enters "grandpa@example.com", which belongs to the host account "Grandpa"
- **THEN** Grandpa is also shown as a host of "Grandma & Grandpa's"

#### Scenario: Removing a home's last host is refused
- **WHEN** anyone removes the only host link of a home
- **THEN** the request is refused with a message that every home needs at least one host

#### Scenario: Someone who is not a host of the home cannot edit it
- **WHEN** a host of a different home tries to edit "Grandma & Grandpa's"
- **THEN** the request is refused and the home is unchanged

### Requirement: Admin can correct children, homes and links
The system SHALL let the admin rename children, edit homes, and add or remove parent
and host links for any account whose role matches, within the same
at-least-one-parent and at-least-one-host limits. The admin SHALL NOT create
children or homes.

#### Scenario: Admin links a host to a home
- **WHEN** the admin adds host "Grandpa" to "Grandma & Grandpa's"
- **THEN** Grandpa is a host of that home

#### Scenario: Admin cannot link a host as a parent
- **WHEN** the admin tries to make a host account a parent of a child
- **THEN** the request is refused with a message that only parent accounts can be a child's parent

### Requirement: Each person sees only what they are connected to
The system SHALL show a parent their own children and those children's parents; a
host their own homes, with addresses, and those homes' hosts; and every active
account the names and time zones of all homes, without addresses. Addresses SHALL
be shown only to a home's hosts and the admin (parents who have applied to a home
gain its address when applications exist). Only the admin SHALL see the list of all
accounts. These limits SHALL hold even when requests bypass the app's pages.

#### Scenario: Parent sees homes without addresses
- **WHEN** a parent who has not applied anywhere views the list of homes
- **THEN** they see each home's name and time zone but no address

#### Scenario: Host sees their own home's address
- **WHEN** Grandma views "Grandma & Grandpa's"
- **THEN** she sees its address

#### Scenario: Stranger parent cannot see another family member's child
- **WHEN** a parent who is not Lyanne's parent requests Lyanne's details directly with their own credentials
- **THEN** nothing is returned

#### Scenario: Non-admin cannot list accounts
- **WHEN** a parent or host requests the list of all accounts directly with their own credentials
- **THEN** only accounts they are connected to (themselves, co-parents, co-hosts) are returned
