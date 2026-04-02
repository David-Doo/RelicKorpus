const STORAGE_KEY = "gesellschaft-project-v2";
const hierarchy = ["User", "Enforcer", "Admin", "Core"];
const rankMap = {
  user: "User",
  enforcer: "Enforcer",
  admin: "Admin",
  core: "Core",
};

const initialState = {
  users: [
    { id: 1, username: "Foolhardy & Gilded Core", rank: "Core", password: "core-pass" },
  ],
  activeUserId: null,
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
  chats: [],
  rules: [
    {
      id: crypto.randomUUID(),
      title: "Verification First",
      content: "Every major claim added to a file must be backed by verifiable evidence.",
      createdBy: 1,
      createdAt: new Date().toISOString(),
    },
  ],
  ruleRequests: [],
};

let state = loadState();
normalizeState(state);
state.activeUserId = null;
saveState();

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

function canonicalRank(rank) {
  return rankMap[String(rank || "").toLowerCase()] || rank;
}

function normalizeState(currentState) {
  currentState.users = (currentState.users || []).map((user) => ({
    ...user,
    rank: canonicalRank(user.rank),
  }));
}

const $ = (selector) => document.querySelector(selector);
const activeUser = () => state.users.find((u) => u.id === Number(state.activeUserId)) || null;
const canApprove = (u) => u && ["Admin", "Core"].includes(canonicalRank(u.rank));
const isAdminOrCore = canApprove;

function hasAccess(file, user) {
  if (!user) return false;
  if (file.visibility === "public") return true;
  if (["Enforcer", "Admin", "Core"].includes(user.rank)) return true;
  return state.permissionRequests.some((r) => r.fileId === file.id && r.userId === user.id && r.status === "approved");
}

function rankAtMost(current, limit) {
  return hierarchy.indexOf(current) <= hierarchy.indexOf(limit);
}

function canManageChatLimit(user) {
  return !!user && ["Admin", "Core"].includes(user.rank);
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      $("#tabDropdown")?.classList.add("hidden");
      const toggleBtn = $("#menuToggleBtn");
      if (toggleBtn) toggleBtn.textContent = "Open Navigation Menu";
    });
  });
}

function setupMenuToggle() {
  const toggleBtn = $("#menuToggleBtn");
  const tabDropdown = $("#tabDropdown");
  if (!toggleBtn || !tabDropdown) return;
  toggleBtn.addEventListener("click", () => {
    tabDropdown.classList.toggle("hidden");
    toggleBtn.textContent = tabDropdown.classList.contains("hidden")
      ? "Open Navigation Menu"
      : "Close Navigation Menu";
  });
}

function renderAuth() {
  const authBlock = $("#authBlock");
  const sessionBlock = $("#sessionBlock");
  const user = activeUser();

  if (!user) {
    sessionBlock.classList.add("hidden");
    authBlock.innerHTML = `
      <form id="loginForm" class="auth-row">
        <label>User ID <input id="loginUserId" type="number" min="1" required /></label>
        <label>Password <input id="loginPassword" type="password" required /></label>
        <button type="submit">Login</button>
      </form>
      <p class="meta">Login is required before any action can be performed.</p>
    `;

    $("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const userId = Number($("#loginUserId").value);
      const password = $("#loginPassword").value;
      const account = state.users.find((u) => u.id === userId);
      if (!account || account.password !== password) {
        alert("Invalid ID/password combination.");
        return;
      }
      state.activeUserId = account.id;
      saveState();
      renderAll();
    });
    return;
  }

  authBlock.innerHTML = "";
  sessionBlock.classList.remove("hidden");
  $("#activeIdentity").textContent = `${user.username} (#${user.id})`;
  $("#activeRole").textContent = user.rank;
  $("#logoutBtn").onclick = () => {
    state.activeUserId = null;
    saveState();
    renderAll();
  };
}

function guardLoggedIn() {
  const user = activeUser();
  if (!user) {
    alert("Please log in first.");
    return null;
  }
  return user;
}

function renderFiles() {
  const user = activeUser();
  const list = $("#fileList");
  if (!user) {
    list.innerHTML = `<p class="notice">Login required.</p>`;
    return;
  }

  list.innerHTML = state.files
    .map((file) => {
      const access = hasAccess(file, user);
      const restricted = file.visibility === "restricted" && !access;
      return `<div class="item">
        <h4>${file.name}</h4>
        <p class="meta">Tags: ${file.tags.join(", ")} • Visibility: ${file.visibility}</p>
        <p><strong>Summary:</strong> ${file.summary}</p>
        ${restricted ? '<p class="warn">Restricted content hidden.</p>' : `<p><strong>Content:</strong> ${file.content}</p>`}
        ${restricted ? "" : `<p><strong>Attachments:</strong> ${file.attachments.join(", ") || "None"}</p>`}
        <div class="actions">
          <button onclick="editFile('${file.id}')" ${restricted ? "disabled" : ""}>Edit</button>
          ${restricted ? `<button onclick="requestAccess('${file.id}')">Request Access</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

window.editFile = (fileId) => {
  const user = guardLoggedIn();
  if (!user) return;
  const file = state.files.find((f) => f.id === fileId);
  if (!file || !hasAccess(file, user)) return;

  const locked = state.files.some((f) =>
    (f.locks || []).some((l) => l.userId === user.id && new Date(l.until).getTime() > Date.now())
  );
  if (user.rank === "User" && locked) {
    alert("Your editing privileges are temporarily locked.");
    return;
  }

  $("#fileId").value = file.id;
  $("#fileName").value = file.name;
  $("#fileTags").value = file.tags.join(", ");
  $("#fileSummary").value = file.summary;
  $("#fileContent").value = file.content;
  $("#fileAttachments").value = file.attachments.join(", ");
  $("#fileVisibility").value = file.visibility;
};

window.requestAccess = (fileId) => {
  const user = guardLoggedIn();
  if (!user) return;
  if (state.permissionRequests.some((r) => r.fileId === fileId && r.userId === user.id && r.status === "pending")) return;
  state.permissionRequests.push({ id: crypto.randomUUID(), fileId, userId: user.id, status: "pending" });
  saveState();
  renderAll();
};

function setupFileForm() {
  $("#fileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user) return;

    const id = $("#fileId").value || crypto.randomUUID();
    const payload = {
      id,
      name: $("#fileName").value.trim(),
      tags: $("#fileTags").value.split(",").map((t) => t.trim()).filter(Boolean),
      summary: $("#fileSummary").value.trim(),
      content: $("#fileContent").value.trim(),
      attachments: $("#fileAttachments").value.split(",").map((a) => a.trim()).filter(Boolean),
      visibility: $("#fileVisibility").value,
    };

    const existing = state.files.find((f) => f.id === id);
    if (existing) {
      if (!hasAccess(existing, user)) return;
      if (user.rank === "User") payload.content = `<strong>${payload.content}</strong> [UID:${user.id}]`;
      if (user.rank === "Enforcer") {
        existing.enforcerEdits.push({
          userId: user.id,
          editedAt: new Date().toISOString(),
          changeNote: `Content updated by Enforcer #${user.id}`,
        });
      }
      Object.assign(existing, payload);
      existing.history.push({ by: user.id, at: new Date().toISOString() });
    } else {
      state.files.push({ ...payload, history: [{ by: user.id, at: new Date().toISOString() }], enforcerEdits: [], locks: [] });
    }

    saveState();
    e.target.reset();
    $("#fileId").value = "";
    renderAll();
  });

  $("#clearFileForm").addEventListener("click", () => {
    $("#fileForm").reset();
    $("#fileId").value = "";
  });
}

function renderPermissionRequests() {
  const user = activeUser();
  const container = $("#permissionRequests");
  if (!isAdminOrCore(user)) {
    container.innerHTML = '<p class="notice">Visible to Admin/Core only.</p>';
    return;
  }
  if (!state.permissionRequests.length) {
    container.innerHTML = '<p class="notice">No permission requests.</p>';
    return;
  }

  container.innerHTML = state.permissionRequests
    .map((r) => {
      const requester = state.users.find((u) => u.id === r.userId);
      const file = state.files.find((f) => f.id === r.fileId);
      return `<div class="item">
        <p>${requester?.username || "Unknown"} requested access to ${file?.name || "Missing file"}</p>
        <p class="meta">Status: ${r.status}</p>
        ${canApprove(user) && r.status === "pending" ? `<button onclick="decidePermission('${r.id}','approved')">Approve</button> <button onclick="decidePermission('${r.id}','denied')">Deny</button>` : ""}
      </div>`;
    })
    .join("");
}

window.decidePermission = (id, status) => {
  const user = guardLoggedIn();
  if (!canApprove(user)) return;
  const req = state.permissionRequests.find((r) => r.id === id);
  if (!req) return;
  req.status = status;
  saveState();
  renderAll();
};

function setupEnforcerLocks() {
  const fileFormArticle = document.querySelector("#files article");
  const block = document.createElement("div");
  block.innerHTML = `
    <h3>Submit Edit Lock Request (Enforcer)</h3>
    <form id="lockRequestForm">
      <label>Target User ID <input id="lockTargetUserId" type="number" min="1" required /></label>
      <label>Days (1-7) <input id="lockDays" type="number" min="1" max="7" required /></label>
      <label>Reason <input id="lockReason" required /></label>
      <button type="submit">Submit Lock Request</button>
    </form>
  `;
  fileFormArticle.appendChild(block);

  $("#lockRequestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user || user.rank !== "Enforcer") return;

    state.lockRequests.push({
      id: crypto.randomUUID(),
      requestedBy: user.id,
      targetUserId: Number($("#lockTargetUserId").value),
      days: Number($("#lockDays").value),
      reason: $("#lockReason").value.trim(),
      status: "pending",
    });

    saveState();
    e.target.reset();
    renderAll();
  });
}

function renderLockRequests() {
  const user = activeUser();
  const list = $("#lockRequests");
  if (!state.lockRequests.length) {
    list.innerHTML = '<p class="notice">No lock requests.</p>';
    return;
  }

  list.innerHTML = state.lockRequests
    .map((r) => {
      const target = state.users.find((u) => u.id === r.targetUserId);
      return `<div class="item">
        <p>Target: ${target?.username || "Unknown"} • ${r.days} day(s)</p>
        <p class="meta">${r.reason} • ${r.status}</p>
        ${canApprove(user) && r.status === "pending" ? `<button onclick="decideLock('${r.id}','approved')">Approve</button> <button onclick="decideLock('${r.id}','denied')">Deny</button>` : ""}
      </div>`;
    })
    .join("");
}

window.decideLock = (id, status) => {
  const user = guardLoggedIn();
  if (!canApprove(user)) return;
  const req = state.lockRequests.find((r) => r.id === id);
  if (!req) return;
  req.status = status;
  if (status === "approved") {
    const until = new Date(Date.now() + req.days * 86400000).toISOString();
    state.files.forEach((f) => f.locks.push({ userId: req.targetUserId, until, reason: req.reason }));
  }
  saveState();
  renderAll();
};

function renderEnforcerAudit() {
  const user = activeUser();
  const list = $("#enforcerAudit");
  if (!isAdminOrCore(user)) {
    list.innerHTML = '<p class="notice">Visible to Admin/Core only.</p>';
    return;
  }
  const logs = state.files.flatMap((f) => f.enforcerEdits.map((e) => ({ file: f.name, ...e })));
  list.innerHTML = logs.map((l) => `<div class="item"><p><strong>${l.file}</strong> edited by #${l.userId}</p><p class="meta">${l.editedAt}</p><p>${l.changeNote}</p></div>`).join("") || '<p class="notice">No enforcer edits yet.</p>';
}

function setupSearch() {
  $("#searchInput").addEventListener("input", () => {
    const user = activeUser();
    const q = $("#searchInput").value.toLowerCase().trim();
    const out = $("#searchResults");
    if (!user) {
      out.innerHTML = '<p class="notice">Login required.</p>';
      return;
    }
    const results = state.files.filter((f) => [f.name, f.summary, f.tags.join(" ")].join(" ").toLowerCase().includes(q));
    out.innerHTML = results.map((f) => `<div class="item"><h4>${f.name}</h4><p>${f.summary}</p>${hasAccess(f, user) ? `<p>${f.content}</p>` : '<p class="warn">Restricted content hidden.</p>'}</div>`).join("") || '<p class="notice">No matches.</p>';
  });
}

function setupIdentity() {
  $("#identityRequestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user) return;
    state.identityRequests.push({
      id: crypto.randomUUID(),
      userId: user.id,
      newName: $("#requestedName").value.trim(),
      newRank: $("#requestedRank").value,
      status: "pending",
    });
    saveState();
    e.target.reset();
    renderAll();
  });

  $("#passwordChangeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user) return;
    const currentPassword = $("#currentPassword").value;
    const newPassword = $("#newPassword").value.trim();

    if (user.password !== currentPassword) {
      $("#passwordStatus").textContent = "Current password is incorrect.";
      return;
    }
    if (newPassword.length < 4) {
      $("#passwordStatus").textContent = "New password must be at least 4 characters.";
      return;
    }

    user.password = newPassword;
    saveState();
    e.target.reset();
    $("#passwordStatus").textContent = "Password updated successfully.";
  });
}

window.decideIdentity = (id, status) => {
  const user = guardLoggedIn();
  if (!canApprove(user)) return;
  const req = state.identityRequests.find((r) => r.id === id);
  if (!req) return;
  req.status = status;
  if (status === "approved") {
    const target = state.users.find((u) => u.id === req.userId);
    if (target) {
      target.username = req.newName;
      if (req.newRank !== "Core" || user.rank === "Core") target.rank = req.newRank;
    }
  }
  saveState();
  renderAll();
};

function renderIdentity() {
  const user = activeUser();
  const card = $("#identityCard");
  const list = $("#identityRequests");
  if (!user) {
    card.innerHTML = '<p class="notice">Login required.</p>';
    list.innerHTML = "";
    return;
  }

  card.innerHTML = `<div class="item"><h4>${user.username}</h4><p>Name: ${user.username}</p><p>ID: ${user.id}</p><p>Rank: ${user.rank}</p></div>`;
  list.innerHTML = state.identityRequests.map((r) => {
    const requester = state.users.find((u) => u.id === r.userId);
    return `<div class="item"><p>#${r.userId} ${requester?.username || "Unknown"} requested <strong>${r.newName}</strong> / ${r.newRank}</p><p class="meta">Status: ${r.status}</p>${canApprove(user) && r.status === "pending" ? `<button onclick="decideIdentity('${r.id}','approved')">Approve</button> <button onclick="decideIdentity('${r.id}','denied')">Deny</button>` : ""}</div>`;
  }).join("") || '<p class="notice">No identity requests.</p>';
}

function setupRules() {
  $("#ruleRequestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user || user.rank !== "Admin") return;

    state.ruleRequests.push({
      id: crypto.randomUUID(),
      title: $("#ruleRequestTitle").value.trim(),
      content: $("#ruleRequestContent").value.trim(),
      requestedBy: user.id,
      status: "pending",
      requestedAt: new Date().toISOString(),
    });

    saveState();
    e.target.reset();
    renderAll();
  });

  $("#coreRuleForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user || user.rank !== "Core") return;

    const title = $("#coreRuleTitle").value.trim();
    const content = $("#coreRuleContent").value.trim();
    if (!title || !content) return;

    state.rules.push({
      id: crypto.randomUUID(),
      title,
      content,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    saveState();
    e.target.reset();
    renderAll();
  });
}

window.decideRuleRequest = (id, status) => {
  const user = guardLoggedIn();
  if (!user || user.rank !== "Core") return;
  const request = state.ruleRequests.find((r) => r.id === id);
  if (!request || request.status !== "pending") return;

  request.status = status;
  request.decidedBy = user.id;
  request.decidedAt = new Date().toISOString();

  if (status === "approved") {
    state.rules.push({
      id: crypto.randomUUID(),
      title: request.title,
      content: request.content,
      createdBy: request.requestedBy,
      createdAt: new Date().toISOString(),
      sourceRequestId: request.id,
    });
  }

  saveState();
  renderAll();
};

function renderRules() {
  const user = activeUser();
  const rulesList = $("#rulesList");
  const requestsList = $("#ruleRequestList");
  const requestForm = $("#ruleRequestForm");
  const coreForm = $("#coreRuleForm");

  if (!state.rules.length) {
    rulesList.innerHTML = '<p class="notice">No rules published yet.</p>';
  } else {
    rulesList.innerHTML = state.rules
      .map((rule) => {
        const author = state.users.find((u) => u.id === rule.createdBy);
        return `<div class="item">
          <h4>${rule.title}</h4>
          <p>${rule.content}</p>
          <p class="meta">Added by ${author?.username || `#${rule.createdBy}`}</p>
        </div>`;
      })
      .join("");
  }

  if (!user) {
    requestForm.style.display = "none";
    coreForm.style.display = "none";
    requestsList.innerHTML = '<p class="notice">Login required to submit or review requests.</p>';
    return;
  }

  requestForm.style.display = user.rank === "Admin" ? "grid" : "none";
  coreForm.style.display = user.rank === "Core" ? "grid" : "none";

  if (!["Admin", "Core"].includes(user.rank)) {
    requestsList.innerHTML = '<p class="notice">Rule request activity is visible to Admin/Core only.</p>';
    return;
  }

  requestsList.innerHTML = state.ruleRequests
    .map((request) => {
      const requester = state.users.find((u) => u.id === request.requestedBy);
      return `<div class="item">
        <h4>${request.title}</h4>
        <p>${request.content}</p>
        <p class="meta">Requested by ${requester?.username || `#${request.requestedBy}`} • ${request.status}</p>
        ${
          user.rank === "Core" && request.status === "pending"
            ? `<button onclick="decideRuleRequest('${request.id}','approved')">Approve</button> <button class="ghost" onclick="decideRuleRequest('${request.id}','denied')">Deny</button>`
            : ""
        }
      </div>`;
    })
    .join("") || '<p class="notice">No rule requests.</p>';
}

function setupChats() {
  const chatCreateForm = $("#chatCreateForm");
  const chatInviteForm = $("#chatInviteForm");
  if (!chatCreateForm || !chatInviteForm) return;

  chatCreateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user) return;

    const name = $("#chatName").value.trim();
    if (!name) return;

    const createdByRestrictedRank = ["User", "Enforcer"].includes(user.rank);
    state.chats.push({
      id: crypto.randomUUID().slice(0, 8),
      name,
      createdBy: user.id,
      members: [user.id],
      memberLimit: createdByRestrictedRank ? 10 : null,
      limitLiftedBy: null,
      createdAt: new Date().toISOString(),
    });

    saveState();
    e.target.reset();
    renderAll();
  });

  chatInviteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!user) return;

    const chatId = $("#inviteChatId").value.trim();
    const targetUserId = Number($("#inviteUserId").value);
    const targetUser = state.users.find((u) => u.id === targetUserId);
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat || !targetUser) return;

    const userIsMember = chat.members.includes(user.id);
    if (!userIsMember && !canManageChatLimit(user)) return;
    if (chat.members.includes(targetUserId)) return;

    if (Number.isFinite(chat.memberLimit) && chat.members.length >= chat.memberLimit) {
      alert("This chat has reached its member limit.");
      return;
    }

    chat.members.push(targetUserId);
    saveState();
    e.target.reset();
    renderAll();
  });
}

window.liftChatLimit = (chatId) => {
  const user = guardLoggedIn();
  if (!canManageChatLimit(user)) return;
  const chat = state.chats.find((c) => c.id === chatId);
  if (!chat) return;
  chat.memberLimit = null;
  chat.limitLiftedBy = user.id;
  saveState();
  renderAll();
};

function renderChats() {
  const user = activeUser();
  const chatList = $("#chatList");
  const createForm = $("#chatCreateForm");
  const inviteForm = $("#chatInviteForm");
  if (!chatList || !createForm || !inviteForm) return;
  if (!user) {
    createForm.style.display = "none";
    inviteForm.style.display = "none";
    chatList.innerHTML = '<p class="notice">Login required.</p>';
    return;
  }

  createForm.style.display = "grid";
  inviteForm.style.display = "grid";

  const visibleChats = state.chats.filter((chat) => chat.members.includes(user.id) || canManageChatLimit(user));
  chatList.innerHTML = visibleChats
    .map((chat) => {
      const creator = state.users.find((u) => u.id === chat.createdBy);
      const memberNames = chat.members
        .map((memberId) => state.users.find((u) => u.id === memberId))
        .filter(Boolean)
        .map((member) => `${member.username} (#${member.id})`)
        .join(", ");
      const limitLabel = Number.isFinite(chat.memberLimit) ? `${chat.members.length}/${chat.memberLimit}` : `${chat.members.length}/∞`;
      const canLift = canManageChatLimit(user) && Number.isFinite(chat.memberLimit);
      return `<div class="item">
        <h4>${chat.name}</h4>
        <p class="meta">Chat ID: <strong>${chat.id}</strong></p>
        <p class="meta">Created by: ${creator?.username || `#${chat.createdBy}`}</p>
        <p class="meta">Members: ${limitLabel}</p>
        <p>${memberNames || "No members"}</p>
        ${canLift ? `<button onclick="liftChatLimit('${chat.id}')">Lift Limit (Admin/Core)</button>` : ""}
      </div>`;
    })
    .join("") || '<p class="notice">No chats available.</p>';
}

function setupTasks() {
  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = guardLoggedIn();
    if (!isAdminOrCore(user)) return;
    state.tasks.push({
      id: crypto.randomUUID(),
      title: $("#taskTitle").value.trim(),
      description: $("#taskDescription").value.trim(),
      forRank: $("#taskRank").value,
      status: "open",
      assignedBy: user.id,
    });
    saveState();
    e.target.reset();
    renderAll();
  });
}

window.completeTask = (id) => {
  const user = guardLoggedIn();
  if (!user) return;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  if (!rankAtMost(user.rank, task.forRank) && !isAdminOrCore(user)) return;
  task.status = "completed";
  task.completedBy = user.id;
  saveState();
  renderAll();
};

function renderTasks() {
  const user = activeUser();
  const board = $("#taskList");
  const formCard = $("#taskForm").closest("article");
  if (!user) {
    board.innerHTML = '<p class="notice">Login required.</p>';
    formCard.style.display = "none";
    return;
  }

  formCard.style.display = isAdminOrCore(user) ? "block" : "none";
  board.innerHTML = state.tasks
    .filter((t) => isAdminOrCore(user) || rankAtMost(user.rank, t.forRank))
    .map((t) => `<div class="item"><h4>${t.title}</h4><p>${t.description}</p><p class="meta">Assigned to ${t.forRank} • ${t.status}</p>${["User", "Enforcer"].includes(user.rank) && t.status === "open" && rankAtMost(user.rank, t.forRank) ? `<button onclick="completeTask('${t.id}')">Mark Complete</button>` : ""}</div>`)
    .join("") || '<p class="notice">No tasks.</p>';
}

function setupAdminMenu() {
  $("#adminCreateUserForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const actor = guardLoggedIn();
    if (!isAdminOrCore(actor)) return;

    const username = $("#adminUserName").value.trim();
    const rank = $("#adminUserRank").value;
    const password = $("#adminUserPassword").value;

    // Admin can only create User accounts directly. Core can create User/Enforcer/Admin.
    if (actor.rank === "Admin" && rank !== "User") return;
    if (actor.rank !== "Core" && rank === "Admin") return;
    if (rank === "Core") return;

    const nextId = Math.max(...state.users.map((u) => u.id), 0) + 1;
    state.users.push({ id: nextId, username, rank, password });
    saveState();
    e.target.reset();
    renderAll();
  });
}

window.adminDeleteUser = (userId) => {
  const actor = guardLoggedIn();
  if (!isAdminOrCore(actor)) return;
  const target = state.users.find((u) => u.id === userId);
  if (!target || target.rank === "Core" || target.id === actor.id) return;
  if (target.rank === "Admin" && actor.rank !== "Core") return;
  state.users = state.users.filter((u) => u.id !== userId);
  saveState();
  renderAll();
};


window.adminPromoteToEnforcer = (userId) => {
  const actor = guardLoggedIn();
  if (!actor || !["Admin", "Core"].includes(actor.rank)) return;
  const target = state.users.find((u) => u.id === userId);
  if (!target || target.rank !== "User") return;
  target.rank = "Enforcer";
  saveState();
  renderAll();
};

window.adminDeleteFile = (fileId) => {
  const actor = guardLoggedIn();
  if (!isAdminOrCore(actor)) return;
  state.files = state.files.filter((f) => f.id !== fileId);
  saveState();
  renderAll();
};

function renderAdminMenu() {
  const user = activeUser();
  const adminTab = document.querySelector('[data-tab="admin"]');
  if (!adminTab) return;
  if (!isAdminOrCore(user)) {
    adminTab.classList.add("hidden");
    $("#adminUserList").innerHTML = '<p class="notice">Admin/Core only.</p>';
    $("#adminFileList").innerHTML = '<p class="notice">Admin/Core only.</p>';
    return;
  }

  adminTab.classList.remove("hidden");

  const rankSelect = $("#adminUserRank");
  rankSelect.innerHTML = user.rank === "Core"
    ? `<option>User</option><option>Enforcer</option><option>Admin</option>`
    : `<option>User</option>`;

  $("#adminUserList").innerHTML = state.users
    .map((u) => {
      const canDelete = u.rank !== "Core" && u.id !== user.id && (user.rank === "Core" || u.rank !== "Admin");
      const canPromote = ["Admin", "Core"].includes(user.rank) && u.rank === "User";
      return `<div class="item"><p>${u.username} (#${u.id}) — ${u.rank}</p>
        ${canPromote ? `<button onclick="adminPromoteToEnforcer(${u.id})">Promote to Enforcer</button>` : ""}
        ${canDelete ? `<button onclick="adminDeleteUser(${u.id})">Delete User</button>` : ""}
      </div>`;
    })
    .join("");

  $("#adminFileList").innerHTML = state.files
    .map((f) => `<div class="item"><p>${f.name}</p><button onclick="adminDeleteFile('${f.id}')">Delete File</button></div>`)
    .join("") || '<p class="notice">No files available.</p>';
}

function renderAll() {
  renderAuth();
  renderFiles();
  renderPermissionRequests();
  renderLockRequests();
  renderEnforcerAudit();
  renderRules();
  renderChats();
  renderIdentity();
  renderTasks();
  renderAdminMenu();
}

function bootstrap() {
  setupMenuToggle();
  setupTabs();
  setupFileForm();
  setupEnforcerLocks();
  setupSearch();
  setupRules();
  setupChats();
  setupIdentity();
  setupTasks();
  setupAdminMenu();
  renderAll();
}

bootstrap();
