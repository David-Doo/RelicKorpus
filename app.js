const STORAGE_KEY = "gesellschaft-project-v1";

const hierarchy = ["User", "Enforcer", "Admin", "Core"];
const canApprove = (user) => ["Admin", "Core"].includes(user.rank);
const isAdminOrCore = canApprove;

const initialState = {
  users: [
    { id: 1, username: "Foolhardy & Gilded Core", rank: "Core", password: "core-pass" },
    { id: 2, username: "Watchful & Amber Admin", rank: "Admin", password: "admin-pass" },
    { id: 3, username: "Stern & Iron Enforcer", rank: "Enforcer", password: "enforcer-pass" },
    { id: 4, username: "Curious & Silver User", rank: "User", password: "user-pass" },
  ],
  activeUserId: 1,
  files: [
    {
      id: crypto.randomUUID(),
      name: "Reliability Doctrine",
      tags: ["policy", "verification"],
      summary: "How the project handles contested information.",
      content: "Every claim must include verifiable support and revision logs.",
      attachments: [],
      visibility: "public",
      history: [],
      enforcerEdits: [],
      locks: [],
    },
  ],
  permissionRequests: [],
  lockRequests: [],
  identityRequests: [],
  tasks: [],
};

let state = loadState();

const activeUserSelect = document.querySelector("#activeUser");
const activeRole = document.querySelector("#activeRole");

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialState);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeUser() {
  return state.users.find((u) => u.id === Number(state.activeUserId));
}

function tabSwitching() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`#${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function renderActiveUsers() {
  activeUserSelect.innerHTML = state.users
    .map((u) => `<option value="${u.id}">${u.username} (#${u.id})</option>`)
    .join("");
  activeUserSelect.value = String(state.activeUserId);
  const user = activeUser();
  activeRole.textContent = user.rank;
}

function hasAccess(file, user) {
  if (file.visibility === "public") return true;
  if (isAdminOrCore(user) || user.rank === "Enforcer") return true;
  return state.permissionRequests.some(
    (r) => r.fileId === file.id && r.userId === user.id && r.status === "approved"
  );
}

function isLockedForUser(user) {
  const now = Date.now();
  return state.files.some((f) =>
    f.locks?.some((lock) => lock.userId === user.id && new Date(lock.until).getTime() > now)
  );
}

function renderFiles() {
  const user = activeUser();
  const list = document.querySelector("#fileList");

  if (!state.files.length) {
    list.innerHTML = `<p class="notice">No files yet.</p>`;
    return;
  }

  list.innerHTML = state.files
    .map((file) => {
      const access = hasAccess(file, user);
      const canDelete = isAdminOrCore(user);
      const needsApproval = file.visibility === "restricted" && !access;

      return `
        <div class="item">
          <h4>${file.name}</h4>
          <div class="meta">Tags: ${file.tags.join(", ")} • Visibility: ${file.visibility}</div>
          <p><strong>Summary:</strong> ${file.summary}</p>
          ${access ? `<p><strong>Content:</strong> ${file.content}</p>` : `<p class="warn">Restricted content hidden.</p>`}
          ${access ? `<p><strong>Attachments:</strong> ${file.attachments.join(", ") || "None"}</p>` : ""}
          <div class="actions">
            <button onclick="editFile('${file.id}')" ${!access && user.rank === "User" ? "disabled" : ""}>Edit</button>
            ${canDelete ? `<button onclick="deleteFile('${file.id}')">Delete</button>` : ""}
            ${needsApproval ? `<button onclick="requestAccess('${file.id}')">Request Access</button>` : ""}
          </div>
        </div>`;
    })
    .join("");
}

window.editFile = (fileId) => {
  const file = state.files.find((f) => f.id === fileId);
  const user = activeUser();
  if (!file) return;
  if (user.rank === "User" && !hasAccess(file, user)) return;
  if (user.rank === "User" && isLockedForUser(user)) {
    alert("Editing is temporarily suspended for your account.");
    return;
  }

  document.querySelector("#fileId").value = file.id;
  document.querySelector("#fileName").value = file.name;
  document.querySelector("#fileTags").value = file.tags.join(", ");
  document.querySelector("#fileSummary").value = file.summary;
  document.querySelector("#fileContent").value = file.content;
  document.querySelector("#fileAttachments").value = file.attachments.join(", ");
  document.querySelector("#fileVisibility").value = file.visibility;
};

window.deleteFile = (fileId) => {
  const user = activeUser();
  if (!isAdminOrCore(user)) return;
  state.files = state.files.filter((f) => f.id !== fileId);
  saveState();
  renderAll();
};

window.requestAccess = (fileId) => {
  const user = activeUser();
  const existing = state.permissionRequests.find(
    (r) => r.fileId === fileId && r.userId === user.id && r.status === "pending"
  );
  if (existing) return;
  state.permissionRequests.push({
    id: crypto.randomUUID(),
    fileId,
    userId: user.id,
    status: "pending",
    requestedAt: new Date().toISOString(),
  });
  saveState();
  renderAll();
};

function renderPermissionRequests() {
  const container = document.querySelector("#permissionRequests");
  const user = activeUser();
  const reqs = state.permissionRequests;

  if (!reqs.length) {
    container.innerHTML = `<p class="notice">No permission requests.</p>`;
    return;
  }

  container.innerHTML = reqs
    .map((req) => {
      const file = state.files.find((f) => f.id === req.fileId);
      const reqUser = state.users.find((u) => u.id === req.userId);
      return `<div class="item">
        <div><strong>${reqUser.username}</strong> requested <em>${file?.name || "missing file"}</em></div>
        <div class="meta">Status: ${req.status}</div>
        ${canApprove(user) && req.status === "pending"
          ? `<div class="actions">
            <button onclick="decidePermission('${req.id}','approved')">Approve</button>
            <button onclick="decidePermission('${req.id}','denied')">Deny</button>
          </div>`
          : ""}
      </div>`;
    })
    .join("");
}

window.decidePermission = (requestId, status) => {
  const user = activeUser();
  if (!canApprove(user)) return;
  const req = state.permissionRequests.find((r) => r.id === requestId);
  if (!req) return;
  req.status = status;
  req.decidedBy = user.id;
  req.decidedAt = new Date().toISOString();
  saveState();
  renderAll();
};

function renderLockRequests() {
  const user = activeUser();
  const container = document.querySelector("#lockRequests");
  const reqs = state.lockRequests;

  if (!reqs.length) {
    container.innerHTML = `<p class="notice">No lock requests.</p>`;
    return;
  }

  container.innerHTML = reqs
    .map((req) => {
      const target = state.users.find((u) => u.id === req.targetUserId);
      return `<div class="item">
        <div>Target: ${target?.username || "unknown"} • Duration: ${req.days} day(s)</div>
        <div class="meta">Reason: ${req.reason} • Status: ${req.status}</div>
        ${canApprove(user) && req.status === "pending"
          ? `<div class="actions">
          <button onclick="decideLock('${req.id}','approved')">Approve</button>
          <button onclick="decideLock('${req.id}','denied')">Deny</button>
        </div>`
          : ""}
      </div>`;
    })
    .join("");
}

window.decideLock = (requestId, status) => {
  const approver = activeUser();
  if (!canApprove(approver)) return;
  const req = state.lockRequests.find((r) => r.id === requestId);
  if (!req) return;
  req.status = status;
  req.decidedBy = approver.id;
  if (status === "approved") {
    const until = new Date(Date.now() + req.days * 24 * 60 * 60 * 1000).toISOString();
    state.files.forEach((file) => {
      file.locks = file.locks || [];
      file.locks.push({ userId: req.targetUserId, until, reason: req.reason });
    });
  }
  saveState();
  renderAll();
};

function renderEnforcerAudit() {
  const user = activeUser();
  const container = document.querySelector("#enforcerAudit");
  if (!isAdminOrCore(user)) {
    container.innerHTML = `<p class="notice">Visible to Admin/Core only.</p>`;
    return;
  }

  const logs = state.files.flatMap((f) =>
    (f.enforcerEdits || []).map((e) => ({
      file: f.name,
      ...e,
    }))
  );

  if (!logs.length) {
    container.innerHTML = `<p class="notice">No enforcer edits recorded yet.</p>`;
    return;
  }

  container.innerHTML = logs
    .map(
      (log) => `<div class="item">
      <div><strong>${log.file}</strong> edited by #${log.userId}</div>
      <div class="meta">${new Date(log.editedAt).toLocaleString()}</div>
      <p>${log.changeNote}</p>
    </div>`
    )
    .join("");
}

function setupFileForm() {
  document.querySelector("#fileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = activeUser();
    const id = document.querySelector("#fileId").value || crypto.randomUUID();
    const payload = {
      id,
      name: document.querySelector("#fileName").value.trim(),
      tags: document
        .querySelector("#fileTags")
        .value.split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      summary: document.querySelector("#fileSummary").value.trim(),
      content: document.querySelector("#fileContent").value.trim(),
      attachments: document
        .querySelector("#fileAttachments")
        .value.split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      visibility: document.querySelector("#fileVisibility").value,
    };

    const existing = state.files.find((f) => f.id === id);
    if (existing) {
      const oldContent = existing.content;
      if (user.rank === "User") {
        payload.content = `<strong>${payload.content}</strong> [UID:${user.id}]`;
      }
      if (user.rank === "Enforcer") {
        existing.enforcerEdits = existing.enforcerEdits || [];
        existing.enforcerEdits.push({
          userId: user.id,
          editedAt: new Date().toISOString(),
          changeNote: `Changed content from \"${oldContent.slice(0, 30)}...\"`,
        });
      }
      Object.assign(existing, payload);
      existing.history = existing.history || [];
      existing.history.push({ by: user.id, at: new Date().toISOString() });
    } else {
      state.files.push({ ...payload, history: [{ by: user.id, at: new Date().toISOString() }], enforcerEdits: [], locks: [] });
    }

    saveState();
    clearFileForm();
    renderAll();
  });

  document.querySelector("#clearFileForm").addEventListener("click", clearFileForm);
}

function clearFileForm() {
  document.querySelector("#fileId").value = "";
  document.querySelector("#fileForm").reset();
}

function setupSearch() {
  const input = document.querySelector("#searchInput");
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const user = activeUser();
    const results = state.files.filter((f) => {
      const text = [f.name, f.summary, f.tags.join(" ")].join(" ").toLowerCase();
      return text.includes(q);
    });

    const container = document.querySelector("#searchResults");
    container.innerHTML = results
      .map((file) => {
        const access = hasAccess(file, user);
        return `<div class="item">
          <h4>${file.name}</h4>
          <p>${file.summary}</p>
          <p class="meta">Tags: ${file.tags.join(", ")}</p>
          ${access ? `<p>${file.content}</p>` : `<p class="warn">Restricted content hidden.</p>`}
        </div>`;
      })
      .join("") || `<p class="notice">No matches.</p>`;
  });
}

function renderIdentity() {
  const user = activeUser();
  document.querySelector("#identityCard").innerHTML = `
    <div class="item">
      <h4>${user.username}</h4>
      <p>Name: ${user.username}</p>
      <p>ID: ${user.id}</p>
      <p>Rank: ${user.rank}</p>
    </div>`;

  const reqList = document.querySelector("#identityRequests");
  reqList.innerHTML = state.identityRequests
    .map((r) => {
      const reqUser = state.users.find((u) => u.id === r.userId);
      return `<div class="item">
        <p>#${r.userId} ${reqUser?.username} requested <strong>${r.newName}</strong> / ${r.newRank}</p>
        <p class="meta">Status: ${r.status}</p>
        ${canApprove(user) && r.status === "pending"
          ? `<div class="actions">
              <button onclick="decideIdentity('${r.id}','approved')">Approve</button>
              <button onclick="decideIdentity('${r.id}','denied')">Deny</button>
            </div>`
          : ""}
      </div>`;
    })
    .join("") || `<p class="notice">No identity requests.</p>`;
}

function setupIdentityRequest() {
  document.querySelector("#identityRequestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = activeUser();
    state.identityRequests.push({
      id: crypto.randomUUID(),
      userId: user.id,
      newName: document.querySelector("#requestedName").value.trim(),
      newRank: document.querySelector("#requestedRank").value,
      status: "pending",
    });
    saveState();
    e.target.reset();
    renderAll();
  });
}

window.decideIdentity = (requestId, status) => {
  const approver = activeUser();
  if (!canApprove(approver)) return;
  const req = state.identityRequests.find((r) => r.id === requestId);
  if (!req) return;
  req.status = status;
  if (status === "approved") {
    const target = state.users.find((u) => u.id === req.userId);
    if (target) {
      target.username = req.newName;
      if (approver.rank === "Core" || req.newRank !== "Core") target.rank = req.newRank;
    }
  }
  saveState();
  renderAll();
};

function setupTasks() {
  document.querySelector("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = activeUser();
    if (!isAdminOrCore(user)) return;

    state.tasks.push({
      id: crypto.randomUUID(),
      title: document.querySelector("#taskTitle").value.trim(),
      description: document.querySelector("#taskDescription").value.trim(),
      forRank: document.querySelector("#taskRank").value,
      status: "open",
      assignedBy: user.id,
    });

    saveState();
    e.target.reset();
    renderAll();
  });
}

function renderTasks() {
  const user = activeUser();
  const taskList = document.querySelector("#taskList");
  const isEligible = (task) => hierarchy.indexOf(user.rank) <= hierarchy.indexOf(task.forRank);

  taskList.innerHTML = state.tasks
    .filter((task) => isEligible(task) || isAdminOrCore(user))
    .map((task) => {
      const showComplete = ["User", "Enforcer"].includes(user.rank) && isEligible(task) && task.status === "open";
      return `<div class="item">
        <h4>${task.title}</h4>
        <p>${task.description}</p>
        <p class="meta">Assigned to: ${task.forRank} • Status: ${task.status}</p>
        ${showComplete ? `<button onclick="completeTask('${task.id}')">Mark Complete</button>` : ""}
      </div>`;
    })
    .join("") || `<p class="notice">No tasks available.</p>`;

  document.querySelector("#taskForm").closest("article").style.display = isAdminOrCore(user) ? "block" : "none";
}

window.completeTask = (taskId) => {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = "completed";
  task.completedBy = activeUser().id;
  saveState();
  renderAll();
};

function setupEnforcerLockRequests() {
  const filePanel = document.querySelector("#files article h2").parentElement;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h3>Submit Edit Lock Request (Enforcer)</h3>
    <form id="lockRequestForm">
      <label>Target User ID <input id="lockTargetUserId" type="number" min="1" required /></label>
      <label>Days (1-7) <input id="lockDays" type="number" min="1" max="7" required /></label>
      <label>Reason <input id="lockReason" required /></label>
      <button type="submit">Submit Lock Request</button>
    </form>
  `;
  filePanel.appendChild(wrap);

  wrap.querySelector("#lockRequestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = activeUser();
    if (user.rank !== "Enforcer") return;

    state.lockRequests.push({
      id: crypto.randomUUID(),
      requestedBy: user.id,
      targetUserId: Number(document.querySelector("#lockTargetUserId").value),
      days: Number(document.querySelector("#lockDays").value),
      reason: document.querySelector("#lockReason").value.trim(),
      status: "pending",
    });

    saveState();
    e.target.reset();
    renderAll();
  });
}

function renderAll() {
  renderActiveUsers();
  renderFiles();
  renderPermissionRequests();
  renderLockRequests();
  renderEnforcerAudit();
  renderIdentity();
  renderTasks();
}

function bootstrap() {
  tabSwitching();
  setupFileForm();
  setupSearch();
  setupIdentityRequest();
  setupTasks();
  setupEnforcerLockRequests();

  activeUserSelect.addEventListener("change", () => {
    state.activeUserId = Number(activeUserSelect.value);
    saveState();
    renderAll();
  });

  renderAll();
}

bootstrap();
