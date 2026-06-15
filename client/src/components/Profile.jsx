import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { userAPI } from '../services/api';
import '../styles/Profile.css';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LANGUAGES = ['English', 'Telugu', 'Hindi'];

const initialsFor = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

export default function Profile() {
  const { user, refreshProfile, setUser } = useContext(AuthContext);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    institution: '',
    level: 'A1',
    preferredLanguage: 'English',
    profileImageUrl: '',
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      institution: user.institution || '',
      level: user.level || 'A1',
      preferredLanguage: user.preferredLanguage || 'English',
      profileImageUrl: user.profileImageUrl || '',
    });
  }, [user]);

  const isOAuth = user?.authProvider && user.authProvider !== 'email';
  const initials = useMemo(() => initialsFor(form.name), [form.name]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice('');
    setError('');
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('Use an image smaller than 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setField('profileImageUrl', String(reader.result || ''));
    reader.onerror = () => setError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setNotice('');
      const payload = {
        name: form.name,
        phone: form.phone,
        institution: form.institution,
        level: form.level,
        preferredLanguage: form.preferredLanguage,
        profileImageUrl: form.profileImageUrl,
      };
      const response = await userAPI.updateProfile(payload);
      setUser(response.data);
      await refreshProfile?.();
      setNotice('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordError('');
      setPasswordNotice('');
      await userAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordNotice('Password updated successfully.');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Could not update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="profile-page">
      <section className="profile-summary">
        <div className="profile-summary-user">
          <div className="profile-avatar large">
            {form.profileImageUrl ? <img src={form.profileImageUrl} alt="" /> : <span>{initials}</span>}
          </div>
          <div>
            <span className="journey-kicker">Profile</span>
            <h2>{form.name || 'Learner'}</h2>
            <p>{form.email}</p>
          </div>
        </div>
        <div className="profile-summary-stats">
          <div><span>Level</span><strong>{form.level}</strong></div>
          <div><span>Sessions</span><strong>{user?.totalSessions ?? 0}</strong></div>
          <div><span>Streak</span><strong>{user?.streak ?? 0}d</strong></div>
        </div>
      </section>

      <div className="profile-grid">
        <form className="profile-panel" onSubmit={saveProfile}>
          <div className="profile-panel-header">
            <h3>Account Details</h3>
            <span className="level-badge">{form.level}</span>
          </div>

          <div className="profile-avatar-row">
            <div className="profile-avatar">
              {form.profileImageUrl ? <img src={form.profileImageUrl} alt="" /> : <span>{initials}</span>}
            </div>
            <label className="profile-upload-btn">
              Upload photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          </div>

          <div className="profile-form-grid">
            <label>
              <span>Full name</span>
              <input value={form.name} onChange={(event) => setField('name', event.target.value)} required minLength={2} />
            </label>
            <label>
              <span>Email</span>
              <input value={form.email} readOnly />
            </label>
            <label>
              <span>Phone number</span>
              <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="+91..." />
            </label>
            <label>
              <span>Institution / College</span>
              <input value={form.institution} onChange={(event) => setField('institution', event.target.value)} placeholder="College name" />
            </label>
            <label>
              <span>Current CEFR level</span>
              <select value={form.level} onChange={(event) => setField('level', event.target.value)}>
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label>
              <span>Preferred UI language</span>
              <select value={form.preferredLanguage} onChange={(event) => setField('preferredLanguage', event.target.value)}>
                {LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            </label>
          </div>

          {isOAuth && <p className="profile-note">Email is managed by your OAuth provider.</p>}
          {notice && <p className="completion-note">{notice}</p>}
          {error && <p className="error">{error}</p>}

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

        <form className="profile-panel" onSubmit={changePassword}>
          <div className="profile-panel-header">
            <h3>Change Password</h3>
          </div>

          {isOAuth ? (
            <p className="profile-note">Password changes are not available for OAuth accounts.</p>
          ) : (
            <>
              <div className="profile-form-grid single">
                <label>
                  <span>Current password</span>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    required
                    minLength={8}
                  />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    required
                    minLength={8}
                  />
                </label>
              </div>
              {passwordNotice && <p className="completion-note">{passwordNotice}</p>}
              {passwordError && <p className="error">{passwordError}</p>}
              <div className="profile-actions">
                <button type="submit" className="btn-primary" disabled={changingPassword}>
                  {changingPassword ? 'Updating...' : 'Update password'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
