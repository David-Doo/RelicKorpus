# RelicKorpus — The Gesellschaft Project

A lightweight browser-based archival and management system implementing the Gesellschaft structure:

- **Hierarchy:** User > Enforcer > Admin > Core.
- **Authentication:** users must log in with an account ID + password and can explicitly log out.
- **Identity model:** accounts are created by Admin/Core and include name, password, rank, and numeric ID.
- **File format:** Name, Tags, Summary, Content, Attachments, Edit, and Delete (Admin/Core only).
- **Restricted knowledge flow:** Users can view restricted summaries and submit access requests.
- **Edit governance:**
  - User edits are bold-marked and tagged with their user ID.
  - Enforcer edits are recorded in a dedicated Admin/Core audit view.
- **Moderation flow:** Enforcers can submit lock requests to suspend a User's editing privileges for up to 7 days (requires Admin/Core approval).
- **Administrative coordination:** Scheduled tasks can be created by Admin/Core and completed by Enforcer/User accounts.
- **Admin Menu:** Admin/Core can create and delete users and delete files from a dedicated management tab.

## Run

Open `index.html` in a modern browser.

No server or build system is required.
