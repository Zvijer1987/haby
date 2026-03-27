import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AuthUser } from '../store/useStore';

export default function AccountPanel({
  user,
  onLogout,
  onChangeUsername,
  onChangePassword,
  onListUsers,
  onCreateUser,
  onDisableUser,
  onEnableUser,
  onDeleteUser,
  profilePicture,
  onSaveProfilePicture
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  onChangeUsername: (username: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onListUsers: () => Promise<AuthUser[]>;
  onCreateUser: (username: string, password: string, isAdmin: boolean) => Promise<void>;
  onDisableUser: (userId: number) => Promise<void>;
  onEnableUser: (userId: number) => Promise<void>;
  onDeleteUser: (userId: number) => Promise<void>;
  profilePicture: string;
  onSaveProfilePicture: (value: string) => Promise<void>;
}) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', isAdmin: false });
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function refreshUsers() {
    if (!user.isAdmin) return;
    setUsers(await onListUsers());
  }

  useEffect(() => {
    refreshUsers();
  }, [user.id]);

  return (
    <>
      <div className="account-launch panel">
        <div className="account-launch-copy account-launch-copy-balanced">
          <div>
            <div className="account-launch-top">User</div>
            <div className="account-launch-main">{user.username}</div>
          </div>
          <div className="account-launch-actions account-launch-actions-bottom">
            <button type="button" className="ghost-btn small-btn account-settings-btn" onClick={() => setOpen(true)}>Account settings</button>
          </div>
        </div>
        <div className="profile-picture-column account-launch-profile-column account-launch-copy-balanced">
          <div className="profile-picture-shell">
            <img src={profilePicture || '/default-profile.svg'} alt={`${user.username} profile`} className="profile-picture" />
          </div>
          <div className="account-launch-actions account-launch-actions-bottom">
            <button type="button" className="ghost-btn small-btn account-logout-btn" onClick={() => onLogout()}>Logout</button>
          </div>
        </div>
      </div>

      {open ? createPortal(
        <div className="modal-backdrop account-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-card account-modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <div>
                <div className="field-label">User</div>
                <h3 style={{ margin: 0 }}>{user.username}</h3>
              </div>
              <div className="inline-actions">
                <button className="ghost-btn small-btn" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>

            {error ? <div className="error-box">{error}</div> : null}

            <details className="panel-details" open>
              <summary>Profile</summary>
              <div className="stack-gap inner-pad">
                <div className="profile-inline-row">
                  <div className="stack-gap profile-picture-column">
                    <div className="profile-picture-shell large">
                      <img src={profilePicture || '/default-profile.svg'} alt={`${user.username} profile`} className="profile-picture" />
                    </div>
                  </div>
                  <div className="stack-gap" style={{ flex: 1 }}>
                    <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
                    <div className="inline-actions wrap-gap">
                      <button className="soft-btn" onClick={async () => { try { await onChangeUsername(username); } catch (err: any) { setError(err.message); } }}>Save username</button>
                      <button type="button" className="ghost-btn" onClick={() => fileInputRef.current?.click()}>Upload profile picture</button>
                      <button type="button" className="ghost-btn" onClick={async () => onSaveProfilePicture('')}>Remove picture</button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const result = typeof reader.result === 'string' ? reader.result : '';
                          if (result) await onSaveProfilePicture(result);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>
              </div>
            </details>

            <details className="panel-details" open>
              <summary>Security</summary>
              <div className="stack-gap inner-pad">
                <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
                <label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
                <button className="soft-btn" onClick={async () => { try { await onChangePassword(currentPassword, newPassword); } catch (err: any) { setError(err.message); } }}>Change password</button>
                {user.forcePasswordChange ? <div className="note-box">You must change the default password before continuing.</div> : null}
              </div>
            </details>

            {user.isAdmin ? (
              <details className="panel-details" open>
                <summary>Create User/Admin</summary>
                <div className="stack-gap inner-pad">
                  <label>New user<input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /></label>
                  <label>Password<input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label>
                  <label className="inline-check"><input type="checkbox" checked={newUser.isAdmin} onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })} /> Admin</label>
                  <button className="primary-btn" onClick={async () => { try { await onCreateUser(newUser.username, newUser.password, newUser.isAdmin); setNewUser({ username: '', password: '', isAdmin: false }); await refreshUsers(); } catch (err: any) { setError(err.message); } }}>Create user</button>
                  <div className="stack-gap">
                    {users.map((item) => (
                      <div className="list-row" key={item.id}>
                        <div><strong>{item.username}</strong><div className="muted-text">{item.isAdmin ? 'Admin' : 'Member'}{item.isDisabled ? ' · Disabled' : ''}</div></div>
                        <div className="inline-actions">
                          {item.isDisabled
                            ? <button className="soft-btn small-btn" onClick={async () => { await onEnableUser(item.id); await refreshUsers(); }}>Enable</button>
                            : <button className="ghost-btn small-btn" onClick={async () => { await onDisableUser(item.id); await refreshUsers(); }}>Disable</button>}
                          {item.id !== user.id ? <button className="danger-btn small-btn" onClick={async () => { await onDeleteUser(item.id); await refreshUsers(); }}>Delete</button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
