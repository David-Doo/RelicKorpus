# RelicKorpus — The Gesellschaft Project

A lightweight browser-based archival and management system implementing the Gesellschaft structure:

- **Meaning:** *Gesellschaft* (German) refers to an organized society structured by formal roles, rules, and institutions.
- **Hierarchy:** User > Enforcer > Admin > Core.
- **Authentication:** users must log in with an account ID + password and can explicitly log out.
- **Identity model:** system starts with a single Core account; additional accounts are created by Core/Admin and include name, password, rank, and numeric ID.
- **Password self-service:** any logged-in user can change their own password from the Identification tab.
- **File format:** Name, Tags, Summary, Content, Attachments, Edit, and Delete (Admin/Core only).
- **Restricted knowledge flow:** Users can view restricted summaries and submit access requests.
- **File request visibility:** permission requests are viewable only by Admin/Core.
- **Edit governance:**
  - User edits are bold-marked and tagged with their user ID.
  - Enforcer edits are recorded in a dedicated Admin/Core audit view.
- **Moderation flow:** Enforcers can submit lock requests to suspend a User's editing privileges for up to 7 days (requires Admin/Core approval).
- **Administrative coordination:** Scheduled tasks can be created by Admin/Core and completed by Enforcer/User accounts.
- **Rules governance:** Admins can submit rule requests that require Core approval; Core can also add rules directly.
- **Chat system:** users can create chats and invite others by chat ID; chats created by User/Enforcer are capped at 10 members unless Admin/Core lifts the limit.
- **Navigation:** tabs are available from a homepage dropdown menu that is hidden by default.
- **Admin Menu permissions:**
  - **Core:** can create User/Enforcer/Admin accounts and delete users/files.
  - **Admin:** can create User accounts, promote Users to Enforcer, and delete users/files (except protected Admin/Core restrictions).

## Run

Open `index.html` in a modern browser.

No server or build system is required.
