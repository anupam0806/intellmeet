import React, { useState, useEffect } from "react";
import { useAuthStore, UserRole } from "../store/authStore.js";
import { apiFetch, ApiClientError } from "../lib/api.js";
import { Copy, RefreshCw, Check } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface TeamData {
  id: string;
  name: string;
  inviteCode?: string;
  members: TeamMember[];
}

export function Settings(): React.JSX.Element {
  const { user, updateUser } = useAuthStore();

  // Profile Form state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Team state
  const [team, setTeam] = useState<TeamData | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [roleActionError, setRoleActionError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name) {
      setProfileName(user.name);
    }
  }, [user?.name]);

  const fetchTeam = async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const data = await apiFetch<TeamData>("/api/v1/team");
      setTeam(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setTeamError(err.message);
      } else {
        setTeamError("Failed to load team data.");
      }
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const res = await apiFetch<{ user: { name: string } }>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: profileName }),
      });
      updateUser({ name: res.user.name });
      setProfileMessage({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setProfileMessage({ type: "error", text: err.message });
      } else {
        setProfileMessage({ type: "error", text: "Failed to update profile." });
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!team?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!window.confirm("Regenerate team invite code? The previous code will no longer work.")) {
      return;
    }
    setRegenerating(true);
    setRoleActionError(null);
    try {
      const res = await apiFetch<{ inviteCode: string }>("/api/v1/team/invite-code/regenerate", {
        method: "POST",
      });
      if (team) {
        setTeam({ ...team, inviteCode: res.inviteCode });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setRoleActionError(err.message);
      } else {
        setRoleActionError("Failed to regenerate invite code.");
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: UserRole) => {
    setRoleActionError(null);
    try {
      const res = await apiFetch<{ user: { id: string; role: UserRole } }>(
        `/api/v1/team/members/${targetUserId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: newRole }),
        },
      );
      if (team) {
        const updatedMembers = (team.members || []).map((m) =>
          m.id === targetUserId ? { ...m, role: res.user.role } : m,
        );
        setTeam({ ...team, members: updatedMembers });
      }
      if (targetUserId === user?.id) {
        updateUser({ role: res.user.role });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "LAST_ADMIN") {
          setRoleActionError("Cannot demote the last administrator of the team.");
        } else {
          setRoleActionError(err.message);
        }
      } else {
        setRoleActionError("Failed to change member role.");
      }
    }
  };

  const isAdmin = user?.role === "ADMIN";
  const adminCount = (team?.members || []).filter((m) => m.role === "ADMIN").length;

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", paddingBottom: "48px" }}>
      <h1
        style={{
          fontSize: "30px",
          fontWeight: 700,
          margin: "0 0 24px 0",
          color: "var(--ink)",
          letterSpacing: "-0.01em",
          overflowWrap: "anywhere",
        }}
      >
        Settings
      </h1>

      {/* Profile Section */}
      <section
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--rule)",
          padding: "24px 20px",
          marginBottom: "32px",
        }}
      >
        <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 16px 0", color: "var(--ink)" }}>
          Profile
        </h2>

        {profileMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius)",
              backgroundColor: profileMessage.type === "success" ? "var(--ground)" : "var(--ground)",
              border: `1px solid ${profileMessage.type === "success" ? "var(--success)" : "var(--error)"}`,
              color: profileMessage.type === "success" ? "var(--success)" : "var(--error)",
              fontSize: "14px",
              marginBottom: "16px",
            }}
          >
            {profileMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="profileName"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
            >
              Full name
            </label>
            <input
              id="profileName"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              minLength={2}
              maxLength={60}
              required
              style={{
                width: "100%",
                maxWidth: "360px",
                boxSizing: "border-box",
                height: "44px",
                padding: "0 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--rule)",
                backgroundColor: "var(--surface)",
                color: "var(--ink)",
                fontSize: "16px",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="profileEmail"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink-soft)" }}
            >
              Email address (read-only)
            </label>
            <input
              id="profileEmail"
              type="email"
              value={user?.email || ""}
              disabled
              style={{
                width: "100%",
                maxWidth: "360px",
                boxSizing: "border-box",
                height: "44px",
                padding: "0 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--rule)",
                backgroundColor: "var(--ground)",
                color: "var(--ink-soft)",
                fontSize: "16px",
                cursor: "not-allowed",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={profileSaving}
            style={{
              height: "44px",
              padding: "0 18px",
              borderRadius: "var(--radius)",
              border: "none",
              backgroundColor: "var(--ink)",
              color: "var(--ground)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: profileSaving ? "not-allowed" : "pointer",
              opacity: profileSaving ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {profileSaving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>

      {/* Team Section */}
      <section
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--rule)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 4px 0", color: "var(--ink)" }}>
              Team
            </h2>
            {team && (
              <div style={{ fontSize: "15px", color: "var(--ink-soft)" }}>
                {team.name}
              </div>
            )}
          </div>
        </div>

        {teamLoading ? (
          <div style={{ padding: "16px 0", color: "var(--ink-soft)", fontSize: "14px" }}>
            Loading team details...
          </div>
        ) : teamError ? (
          <div style={{ padding: "12px", color: "var(--error)", fontSize: "14px" }}>
            {teamError}
          </div>
        ) : team ? (
          <div>
            {/* Invite Code for Admins */}
            {isAdmin && team.inviteCode && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius)",
                  backgroundColor: "var(--ground)",
                  border: "1px solid var(--rule)",
                  marginBottom: "24px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "8px" }}>
                  TEAM INVITE CODE
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "20px",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      color: "var(--ink)",
                    }}
                  >
                    {team.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius)",
                      padding: "8px 14px",
                      minHeight: "44px",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--ink)",
                    }}
                  >
                    {copiedCode ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    <span>{copiedCode ? "Copied" : "Copy code"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateInviteCode}
                    disabled={regenerating}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius)",
                      padding: "8px 14px",
                      minHeight: "44px",
                      fontSize: "13px",
                      cursor: regenerating ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--ink)",
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>{regenerating ? "Regenerating..." : "Regenerate"}</span>
                  </button>
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "8px" }}>
                  Share this code with teammates so they can join your team during sign up.
                </div>
              </div>
            )}

            {roleActionError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius)",
                  backgroundColor: "var(--ground)",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  fontSize: "14px",
                  marginBottom: "16px",
                }}
              >
                {roleActionError}
              </div>
            )}

            {/* Member List */}
            <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 12px 0", color: "var(--ink)" }}>
              Members ({team.members?.length || 0})
            </h3>
            <div style={{ borderTop: "1px solid var(--rule)" }}>
              {(team.members || []).map((member) => {
                const isLastAdmin = member.role === "ADMIN" && adminCount <= 1;

                return (
                  <div
                    key={member.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid var(--rule)",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)", overflowWrap: "anywhere" }}>
                        {member.name}
                        {member.id === user?.id && (
                          <span style={{ fontSize: "12px", color: "var(--ink-soft)", marginLeft: "8px" }}>
                            (You)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
                        {member.email}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-chip)",
                          backgroundColor: member.role === "ADMIN" ? "var(--ink)" : "var(--ground)",
                          color: member.role === "ADMIN" ? "var(--ground)" : "var(--ink)",
                          border: "1px solid var(--rule)",
                        }}
                      >
                        {member.role}
                      </span>

                      {/* Admin role control */}
                      {isAdmin && (
                        <div>
                          {member.role === "ADMIN" ? (
                            <button
                              type="button"
                              onClick={() => handleChangeRole(member.id, "MEMBER")}
                              disabled={isLastAdmin}
                              title={isLastAdmin ? "Cannot demote the last administrator" : "Demote to Member"}
                              style={{
                                background: "none",
                                border: "1px solid var(--rule)",
                                borderRadius: "var(--radius)",
                                padding: "6px 12px",
                                minHeight: "44px",
                                fontSize: "12px",
                                cursor: isLastAdmin ? "not-allowed" : "pointer",
                                opacity: isLastAdmin ? 0.5 : 1,
                                color: "var(--ink)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              Make Member
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleChangeRole(member.id, "ADMIN")}
                              title="Promote to Admin"
                              style={{
                                background: "none",
                                border: "1px solid var(--rule)",
                                borderRadius: "var(--radius)",
                                padding: "6px 12px",
                                minHeight: "44px",
                                fontSize: "12px",
                                cursor: "pointer",
                                color: "var(--ink)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              Make Admin
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
